import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { nimplyApiRequest, parseJsonParameter, waitForCompletion } from '../GenericFunctions';

const RUN_FINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export const agentProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['agent'] },
		},
		options: [
			{
				name: 'Cancel Run',
				value: 'cancelRun',
				description: 'Stop a run that has not finished',
				action: 'Cancel an agent run',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get one of your agents',
				action: 'Get an agent',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List the agents working in your workspace',
				action: 'Get many agents',
			},
			{
				name: 'Get Run',
				value: 'getRun',
				description: 'Get the status and results of a run',
				action: 'Get an agent run',
			},
			{
				name: 'Get Runs',
				value: 'getRuns',
				description: "List an agent's recent runs",
				action: 'Get agent runs',
			},
			{
				name: 'Get Template',
				value: 'getTemplate',
				description: 'Get one agent template with the setup fields it asks for',
				action: 'Get an agent template',
			},
			{
				name: 'Get Templates',
				value: 'getTemplates',
				description: 'List the agents you can hire',
				action: 'Get agent templates',
			},
			{
				name: 'Hire',
				value: 'hire',
				description: 'Hire an agent from a template',
				action: 'Hire an agent',
			},
			{
				name: 'Remove',
				value: 'remove',
				description: 'Remove an agent from your workspace',
				action: 'Remove an agent',
			},
			{
				name: 'Run',
				value: 'run',
				description:
					'Run an agent now. Uses AI credits; what it makes lands as posts awaiting approval.',
				action: 'Run an agent',
			},
			{
				name: 'Update',
				value: 'update',
				description: "Rename an agent, pause or resume it, or change its settings",
				action: 'Update an agent',
			},
		],
		default: 'run',
	},

	// agent:getTemplate / hire
	{
		displayName: 'Template Name or ID',
		name: 'templateId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAgentTemplates' },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['agent'], operation: ['getTemplate', 'hire'] },
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Channel Names or IDs',
		name: 'channelIds',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getAllChannels' },
		default: [],
		displayOptions: {
			show: { resource: ['agent'], operation: ['hire'] },
		},
		description:
			'Channels the agent works on: one, unless the template works across several. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['agent'], operation: ['hire'] },
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Defaults to the template name',
			},
			{
				displayName: 'Preset',
				name: 'preset',
				type: 'string',
				default: '',
				description: 'Preset key from the template (see Get Template)',
			},
			{
				displayName: 'Settings (JSON)',
				name: 'config',
				type: 'json',
				default: '{}',
				description:
					'Setup values keyed by field key (see Get Template). Settings that need a human check, such as auto-reply, can only be set in the Nimply app.',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Comma-separated labels of your own (up to 10)',
			},
		],
	},

	// agent:get / update / remove / run / getRuns
	{
		displayName: 'Agent Name or ID',
		name: 'agentId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAgents' },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['agent'], operation: ['get', 'update', 'remove', 'run', 'getRuns'] },
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},

	// agent:getRun / cancelRun
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['agent'], operation: ['getRun', 'cancelRun'] },
		},
		description: 'Run ID returned by the Run operation',
	},

	// agent:update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['agent'], operation: ['update'] },
		},
		options: [
			{
				displayName: 'Channel Names or IDs',
				name: 'channelIds',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getAllChannels' },
				default: [],
				description:
					'Replaces the channels the agent works on. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Settings (JSON)',
				name: 'config',
				type: 'json',
				default: '{}',
				description:
					'Settings to change, merged into the current ones. Use null to clear a setting. Settings not sent are kept.',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Paused', value: 'PAUSED' },
				],
				default: 'ACTIVE',
				description:
					'Paused stops the agent and the automations that use it. Active resumes the agent only; its automations stay paused until you switch them on.',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'string',
				default: '',
				description: 'Comma-separated labels; replaces the current ones',
			},
		],
	},

	// agent:run
	{
		displayName: 'Input (JSON)',
		name: 'input',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { resource: ['agent'], operation: ['run'] },
		},
		description:
			'Optional run input for agents that take one, e.g. {"topic":"Autumn menu"} or {"sourceUrl":"https://…"}',
	},
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: { resource: ['agent'], operation: ['run'] },
		},
		description:
			'Whether to wait until the run finishes and return its results; otherwise return straight away and check later with Get Run',
	},
	{
		displayName: 'Max Wait (Seconds)',
		name: 'maxWait',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 900 },
		default: 300,
		displayOptions: {
			show: { resource: ['agent'], operation: ['run'], waitForCompletion: [true] },
		},
		description: 'Stop waiting after this long and return the run as it is',
	},

	// agent:getAll
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: ['agent'], operation: ['getAll'] },
		},
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Paused', value: 'PAUSED' },
				],
				default: 'ACTIVE',
			},
			{
				displayName: 'Template Name or ID',
				name: 'templateId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgentTemplates' },
				default: '',
				description:
					'Only agents hired from this template. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},

	// agent:getRuns
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: { resource: ['agent'], operation: ['getRuns'] },
		},
		description: 'Max number of results to return',
	},
];

function splitTags(tags: unknown): string[] | undefined {
	if (typeof tags !== 'string' || tags.trim() === '') return undefined;
	return tags
		.split(',')
		.map((tag) => tag.trim())
		.filter((tag) => tag !== '');
}

export async function executeAgent(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'getTemplates') {
		const response = (await nimplyApiRequest.call(this, 'GET', '/v1/agent-templates')) as {
			data: IDataObject[];
		};
		return response.data;
	}
	if (operation === 'getTemplate') {
		const templateId = this.getNodeParameter('templateId', i) as string;
		return await nimplyApiRequest.call(this, 'GET', `/v1/agent-templates/${templateId}`);
	}
	if (operation === 'getAll') {
		const filters = this.getNodeParameter('filters', i) as IDataObject;
		const qs: IDataObject = {};
		if (filters.status) qs.status = filters.status;
		if (filters.templateId) qs.templateId = filters.templateId;
		const response = (await nimplyApiRequest.call(this, 'GET', '/v1/agents', {}, qs)) as {
			data: IDataObject[];
		};
		return response.data;
	}
	if (operation === 'hire') {
		const body: IDataObject = {
			templateId: this.getNodeParameter('templateId', i) as string,
		};
		const channelIds = this.getNodeParameter('channelIds', i, []) as string[];
		if (channelIds.length) body.channelIds = channelIds;
		const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
		if (additionalFields.name) body.name = additionalFields.name;
		if (additionalFields.preset) body.preset = additionalFields.preset;
		const config = parseJsonParameter.call(this, additionalFields.config, 'Settings', i, {});
		if (Object.keys(config).length) body.config = config;
		const tags = splitTags(additionalFields.tags);
		if (tags) body.tags = tags;
		return await nimplyApiRequest.call(this, 'POST', '/v1/agents', body);
	}

	if (operation === 'getRun' || operation === 'cancelRun') {
		const runId = this.getNodeParameter('runId', i) as string;
		return operation === 'getRun'
			? await nimplyApiRequest.call(this, 'GET', `/v1/agent-runs/${runId}`)
			: await nimplyApiRequest.call(this, 'POST', `/v1/agent-runs/${runId}/cancel`);
	}

	const agentId = this.getNodeParameter('agentId', i) as string;

	if (operation === 'get') {
		return await nimplyApiRequest.call(this, 'GET', `/v1/agents/${agentId}`);
	}
	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.name) body.name = updateFields.name;
		if (updateFields.status) body.status = updateFields.status;
		if (Array.isArray(updateFields.channelIds) && updateFields.channelIds.length) {
			body.channelIds = updateFields.channelIds;
		}
		const config = parseJsonParameter.call(this, updateFields.config, 'Settings', i, {});
		if (Object.keys(config).length) body.config = config;
		const tags = splitTags(updateFields.tags);
		if (tags) body.tags = tags;
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Set at least one field to update', {
				itemIndex: i,
			});
		}
		return await nimplyApiRequest.call(this, 'PATCH', `/v1/agents/${agentId}`, body);
	}
	if (operation === 'remove') {
		return await nimplyApiRequest.call(this, 'DELETE', `/v1/agents/${agentId}`);
	}
	if (operation === 'getRuns') {
		const limit = this.getNodeParameter('limit', i) as number;
		const response = (await nimplyApiRequest.call(
			this,
			'GET',
			`/v1/agents/${agentId}/runs`,
			{},
			{ limit },
		)) as { data: IDataObject[] };
		return response.data;
	}
	if (operation === 'run') {
		const input = parseJsonParameter.call(this, this.getNodeParameter('input', i), 'Input', i, {});
		const body: IDataObject = Object.keys(input).length ? { input } : {};
		const run = (await nimplyApiRequest.call(
			this,
			'POST',
			`/v1/agents/${agentId}/runs`,
			body,
		)) as IDataObject;
		if (!(this.getNodeParameter('waitForCompletion', i) as boolean)) return run;
		const maxWait = this.getNodeParameter('maxWait', i) as number;
		return await waitForCompletion.call(
			this,
			`/v1/agent-runs/${run.id}`,
			run,
			RUN_FINAL_STATUSES,
			maxWait,
		);
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}
