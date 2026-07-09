import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { nimplyApiRequest } from './GenericFunctions';

/**
 * Verify a Nimply webhook signature.
 * Header format: X-Nimply-Signature: t=<unix seconds>,v1=<hex hmac-sha256 of "<t>.<rawBody>">
 */
function isSignatureValid(secret: string, signatureHeader: string, rawBody: string): boolean {
	const parts = new Map<string, string>();
	for (const pair of signatureHeader.split(',')) {
		const index = pair.indexOf('=');
		if (index === -1) continue;
		parts.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
	}

	const timestamp = parts.get('t');
	const signature = parts.get('v1');
	if (!timestamp || !signature) return false;

	// Reject deliveries older than 5 minutes to limit replay attacks
	const toleranceSeconds = 300;
	const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
	if (!Number.isFinite(age) || age > toleranceSeconds) return false;

	const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

	const expectedBuffer = Buffer.from(expected, 'utf8');
	const signatureBuffer = Buffer.from(signature, 'utf8');
	if (expectedBuffer.length !== signatureBuffer.length) return false;
	return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export class NimplyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nimply Trigger',
		name: 'nimplyTrigger',
		icon: 'file:nimply.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Nimply events occur',
		defaults: {
			name: 'Nimply Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'nimplyApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: [],
				options: [
					{
						name: 'Channel Connected',
						value: 'channel.connected',
						description: 'A social channel was connected to the workspace',
					},
					{
						name: 'Channel Disconnected',
						value: 'channel.disconnected',
						description: 'A social channel was disconnected',
					},
					{
						name: 'Post Approval Requested',
						value: 'post.approval_requested',
						description: 'A post was submitted for approval',
					},
					{
						name: 'Post Approved',
						value: 'post.approved',
						description: 'A pending post was approved',
					},
					{
						name: 'Post Created',
						value: 'post.created',
						description: 'A post was created',
					},
					{
						name: 'Post Deleted',
						value: 'post.deleted',
						description: 'A post was deleted',
					},
					{
						name: 'Post Failed',
						value: 'post.failed',
						description: 'Publishing a post failed',
					},
					{
						name: 'Post Published',
						value: 'post.published',
						description: 'A post was published',
					},
					{
						name: 'Post Rejected',
						value: 'post.rejected',
						description: 'A pending post was rejected',
					},
					{
						name: 'Post Updated',
						value: 'post.updated',
						description: 'A post was updated',
					},
				],
				description: 'The Nimply events that should trigger this workflow',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId === undefined) {
					return false;
				}

				try {
					const webhook = (await nimplyApiRequest.call(
						this,
						'GET',
						`/v1/webhooks/${webhookData.webhookId}`,
					)) as IDataObject;

					const webhookUrl = this.getNodeWebhookUrl('default');
					if (webhook.url !== webhookUrl) {
						// Registered for a different URL (e.g. instance URL changed) — recreate
						return false;
					}
					return true;
				} catch (error) {
					if ((error as { httpCode?: string }).httpCode === '404') {
						delete webhookData.webhookId;
						delete webhookData.webhookSecret;
						return false;
					}
					throw error;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const events = this.getNodeParameter('events') as string[];

				const body: IDataObject = {
					name: `n8n trigger (${this.getWorkflow().name ?? 'workflow'})`,
					url: webhookUrl,
					events,
				};

				const response = (await nimplyApiRequest.call(
					this,
					'POST',
					'/v1/webhooks',
					body,
				)) as IDataObject;

				const webhookData = this.getWorkflowStaticData('node');
				webhookData.webhookId = response.id as string;
				// The signing secret is only returned on creation — keep it to verify deliveries
				webhookData.webhookSecret = response.secret as string;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				if (webhookData.webhookId !== undefined) {
					try {
						await nimplyApiRequest.call(this, 'DELETE', `/v1/webhooks/${webhookData.webhookId}`);
					} catch (error) {
						if ((error as { httpCode?: string }).httpCode !== '404') {
							return false;
						}
					}
					delete webhookData.webhookId;
					delete webhookData.webhookSecret;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const webhookData = this.getWorkflowStaticData('node');
		const secret = webhookData.webhookSecret as string | undefined;

		if (secret !== undefined) {
			const signatureHeader = this.getHeaderData()['x-nimply-signature'] as string | undefined;
			const rawBody =
				(req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
				JSON.stringify(req.body ?? {});

			if (!signatureHeader || !isSignatureValid(secret, signatureHeader, rawBody)) {
				const res = this.getResponseObject();
				res.status(401).json({ error: 'Invalid webhook signature' });
				return { noWebhookResponse: true };
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(req.body as IDataObject)],
		};
	}
}
