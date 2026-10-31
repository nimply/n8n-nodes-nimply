import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

type NimplyContext = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions | IWebhookFunctions;

/**
 * Make an authenticated request to the Nimply API.
 */
export async function nimplyApiRequest(
	this: NimplyContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const credentials = await this.getCredentials('nimplyApi');
	const baseUrl = ((credentials.baseUrl as string) || 'https://api.nimply.io').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		qs,
		body,
		json: true,
	};

	if (Object.keys(body).length === 0) {
		delete options.body;
	}
	if (Object.keys(qs).length === 0) {
		delete options.qs;
	}

	return await this.helpers.httpRequestWithAuthentication.call(this, 'nimplyApi', options);
}

/**
 * Fetch pages of a cursor-paginated Nimply list endpoint ({ data, nextCursor })
 * until exhausted or until `maxItems` results have been collected.
 */
export async function nimplyApiRequestAllItems(
	this: IExecuteFunctions,
	endpoint: string,
	qs: IDataObject = {},
	maxItems?: number,
): Promise<IDataObject[]> {
	const returnData: IDataObject[] = [];
	let cursor: string | undefined;

	do {
		const pageSize =
			maxItems === undefined ? 100 : Math.min(100, Math.max(1, maxItems - returnData.length));
		const query: IDataObject = { ...qs, limit: pageSize };
		if (cursor) query.cursor = cursor;

		const response = (await nimplyApiRequest.call(this, 'GET', endpoint, {}, query)) as {
			data: IDataObject[];
			nextCursor: string | null;
		};

		returnData.push(...(response.data ?? []));
		cursor = response.nextCursor ?? undefined;
	} while (cursor && (maxItems === undefined || returnData.length < maxItems));

	return maxItems === undefined ? returnData : returnData.slice(0, maxItems);
}

/**
 * Parse a JSON parameter that n8n may hand over as a string or as an already-parsed value.
 * Empty input returns `fallback`. Typed `any` like the request helpers: the shape is the API's to check.
 */
export function parseJsonParameter(
	this: IExecuteFunctions,
	raw: unknown,
	field: string,
	itemIndex: number,
	fallback: IDataObject | IDataObject[],
): any {
	if (raw === undefined || raw === null || raw === '') return fallback;
	if (typeof raw !== 'string') return raw;
	try {
		return JSON.parse(raw);
	} catch {
		throw new NodeOperationError(this.getNode(), `${field} must be valid JSON`, { itemIndex });
	}
}

/** Split a comma-separated list of ids, dropping blanks. */
export function splitIds(ids: string): string[] {
	return ids
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');
}

/**
 * Poll an async job (agent run, design job) with the API's long-poll `wait`
 * until it reaches a final status or `maxSeconds` pass. Returns the last state.
 */
export async function waitForCompletion(
	this: IExecuteFunctions,
	endpoint: string,
	initial: IDataObject,
	finalStatuses: string[],
	maxSeconds: number,
): Promise<IDataObject> {
	let state = initial;
	const deadline = Date.now() + maxSeconds * 1000;
	while (!finalStatuses.includes(state.status as string) && Date.now() < deadline) {
		const wait = Math.max(1, Math.min(25, Math.ceil((deadline - Date.now()) / 1000)));
		state = (await nimplyApiRequest.call(this, 'GET', endpoint, {}, { wait })) as IDataObject;
	}
	return state;
}
