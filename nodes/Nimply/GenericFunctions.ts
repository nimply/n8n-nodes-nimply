import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
} from 'n8n-workflow';

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
