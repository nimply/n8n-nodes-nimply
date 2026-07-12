import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { nimplyApiRequest, nimplyApiRequestAllItems } from './GenericFunctions';

export class Nimply implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nimply',
		name: 'nimply',
		icon: 'file:nimply.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Schedule, publish, and measure social media content with Nimply.io',
		defaults: {
			name: 'Nimply',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'nimplyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Channel', value: 'channel' },
					{ name: 'Media', value: 'media' },
					{ name: 'Post', value: 'post' },
				],
				default: 'post',
			},

			// ----------------------------------------------------------------
			//                             post
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['post'] },
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description: 'Create a post on one or more channels',
						action: 'Create a post',
					},
					{
						name: 'Create Bulk',
						value: 'createBulk',
						description: 'Create up to 50 posts in one request',
						action: 'Create posts in bulk',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a draft or scheduled post',
						action: 'Delete a post',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a single post',
						action: 'Get a post',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List posts',
						action: 'Get many posts',
					},
					{
						name: 'Publish',
						value: 'publish',
						description: 'Queue a post for immediate publishing',
						action: 'Publish a post',
					},
					{
						name: 'Schedule',
						value: 'schedule',
						description: 'Set or change when a post will publish',
						action: 'Schedule a post',
					},
					{
						name: 'Unschedule',
						value: 'unschedule',
						description: 'Move a scheduled post back to draft and clear its publish time',
						action: 'Unschedule a post',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Update the content or title of a post',
						action: 'Update a post',
					},
				],
				default: 'create',
			},

			// post:create
			{
				displayName: 'Channel Names or IDs',
				name: 'channelIds',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getChannels',
				},
				required: true,
				default: [],
				displayOptions: {
					show: { resource: ['post'], operation: ['create'] },
				},
				description:
					'Channels to publish to — one post is created per channel. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['create'] },
				},
				description: 'Post text/caption',
			},
			{
				displayName: 'Schedule',
				name: 'schedule',
				type: 'options',
				options: [
					{
						name: 'Draft',
						value: 'draft',
						description: 'Create the post as a draft (no publishing)',
					},
					{
						name: 'Next Free Slot',
						value: 'next_slot',
						description: "Publish at the next free slot of each channel's posting schedule",
					},
					{
						name: 'Now',
						value: 'now',
						description: 'Publish immediately',
					},
					{
						name: 'At a Specific Time',
						value: 'custom',
						description: 'Publish at the given date and time',
					},
				],
				default: 'draft',
				displayOptions: {
					show: { resource: ['post'], operation: ['create'] },
				},
				description:
					'When to publish. Anything except Draft requires an API key with the posts:publish scope.',
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['create'], schedule: ['custom'] },
				},
				description: 'When to publish the post (must be in the future)',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['create'] },
				},
				options: [
					{
						displayName: 'Content Type',
						name: 'contentType',
						type: 'options',
						options: [
							{ name: 'Post', value: 'POST' },
							{ name: 'Reel', value: 'REEL' },
							{ name: 'Story', value: 'STORY' },
							{ name: 'Video', value: 'VIDEO' },
						],
						default: 'POST',
						description: 'Content type. Multiple media on a POST become a carousel.',
					},
					{
						displayName: 'Media IDs',
						name: 'mediaIds',
						type: 'string',
						default: '',
						description:
							'Comma-separated media asset IDs in display order (upload via the Media resource first)',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Title (used by YouTube and Pinterest)',
					},
				],
			},

			// post:createBulk
			{
				displayName: 'Posts',
				name: 'posts',
				type: 'json',
				required: true,
				default:
					'[\n  {\n    "channelIds": ["<channel-id>"],\n    "content": "Hello from n8n",\n    "schedule": "draft"\n  }\n]',
				displayOptions: {
					show: { resource: ['post'], operation: ['createBulk'] },
				},
				description:
					'JSON array of 1–50 posts. Each item follows the create-post body (channelIds, content, title, contentType, mediaIds, schedule).',
			},

			// post:get / delete / publish / schedule / update
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['post'],
						operation: ['get', 'delete', 'publish', 'schedule', 'unschedule', 'update'],
					},
				},
			},

			// post:schedule
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['schedule'] },
				},
				description: 'When to publish the post (ISO 8601, must be in the future)',
			},

			// post:update
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['update'] },
				},
				options: [
					{
						displayName: 'Content',
						name: 'content',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description: 'New post text/caption',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'New title (used by YouTube and Pinterest)',
					},
				],
			},

			// post:getAll
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: { resource: ['post'], operation: ['getAll'] },
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				displayOptions: {
					show: { resource: ['post'], operation: ['getAll'], returnAll: [false] },
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['getAll'] },
				},
				options: [
					{
						displayName: 'Channel Name or ID',
						name: 'channelId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getChannels' },
						default: '',
						description:
							'Only return posts of this channel. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Archived', value: 'ARCHIVED' },
							{ name: 'Draft', value: 'DRAFT' },
							{ name: 'Failed', value: 'FAILED' },
							{ name: 'Pending Approval', value: 'PENDING_APPROVAL' },
							{ name: 'Published', value: 'PUBLISHED' },
							{ name: 'Scheduled', value: 'SCHEDULED' },
						],
						default: 'DRAFT',
						description: 'Only return posts with this status',
					},
				],
			},

			// ----------------------------------------------------------------
			//                            channel
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['channel'] },
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List connected channels',
						action: 'Get many channels',
					},
					{
						name: 'Get Schedule',
						value: 'getSchedule',
						description: "Get a channel's posting time slots per weekday",
						action: 'Get a channel schedule',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['channel'], operation: ['getSchedule'] },
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},

			// ----------------------------------------------------------------
			//                             media
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['media'] },
				},
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List media assets',
						action: 'Get many media assets',
					},
					{
						name: 'Upload Binary',
						value: 'uploadBinary',
						description:
							'Upload binary data from a previous node (e.g. Google Drive, FTP) via a presigned URL',
						action: 'Upload binary media',
					},
					{
						name: 'Upload From URL',
						value: 'upload',
						description: 'Import a file from a public URL into workspace storage',
						action: 'Upload media from a URL',
					},
				],
				default: 'upload',
			},
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				hint: 'The name of the input field containing the binary file data',
				displayOptions: {
					show: { resource: ['media'], operation: ['uploadBinary'] },
				},
			},
			{
				displayName: 'URL',
				name: 'url',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/images/banner.png',
				displayOptions: {
					show: { resource: ['media'], operation: ['upload'] },
				},
				description: 'Publicly reachable http(s) URL of the file to import',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['media'], operation: ['upload'] },
				},
				options: [
					{
						displayName: 'Name',
						name: 'name',
						type: 'string',
						default: '',
						description: 'File name to store (defaults to the URL basename)',
					},
				],
			},
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: { resource: ['media'], operation: ['getAll'] },
				},
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 50,
				displayOptions: {
					show: { resource: ['media'], operation: ['getAll'], returnAll: [false] },
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { resource: ['media'], operation: ['getAll'] },
				},
				options: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Document', value: 'DOCUMENT' },
							{ name: 'GIF', value: 'GIF' },
							{ name: 'Image', value: 'IMAGE' },
							{ name: 'Video', value: 'VIDEO' },
						],
						default: 'IMAGE',
						description: 'Only return media assets of this type',
					},
				],
			},

			// ----------------------------------------------------------------
			//                           analytics
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['analytics'] },
				},
				options: [
					{
						name: 'Get Channel Analytics',
						value: 'channel',
						description: 'Daily profile metrics for one channel',
						action: 'Get channel analytics',
					},
					{
						name: 'Get Post Analytics',
						value: 'post',
						description: 'Daily metric snapshots for one post',
						action: 'Get post analytics',
					},
					{
						name: 'Get Workspace Analytics',
						value: 'workspace',
						description: 'Aggregated metrics across all channels',
						action: 'Get workspace analytics',
					},
				],
				default: 'workspace',
			},
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['analytics'], operation: ['channel'] },
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Post ID',
				name: 'postId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['analytics'], operation: ['post'] },
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: { resource: ['analytics'], operation: ['workspace', 'channel'] },
				},
				options: [
					{
						displayName: 'From',
						name: 'from',
						type: 'dateTime',
						default: '',
						description: 'Range start. Defaults to 30 days ago.',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'dateTime',
						default: '',
						description: 'Range end. Defaults to now.',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const channels = (await nimplyApiRequest.call(this, 'GET', '/v1/channels')) as Array<{
					id: string;
					name: string;
					type: string;
				}>;
				return channels.map((channel) => ({
					name: `${channel.name} (${channel.type})`,
					value: channel.id,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[];

				if (resource === 'post') {
					if (operation === 'create') {
						const body: IDataObject = {
							channelIds: this.getNodeParameter('channelIds', i) as string[],
						};

						const content = this.getNodeParameter('content', i) as string;
						if (content) body.content = content;

						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						if (additionalFields.title) body.title = additionalFields.title;
						if (additionalFields.contentType) body.contentType = additionalFields.contentType;
						if (additionalFields.mediaIds) {
							body.mediaIds = (additionalFields.mediaIds as string)
								.split(',')
								.map((id) => id.trim())
								.filter((id) => id !== '');
						}

						const schedule = this.getNodeParameter('schedule', i) as string;
						if (schedule === 'custom') {
							body.schedule = this.getNodeParameter('scheduledAt', i) as string;
						} else if (schedule !== 'draft') {
							body.schedule = schedule;
						}

						responseData = await nimplyApiRequest.call(this, 'POST', '/v1/posts', body);
					} else if (operation === 'createBulk') {
						const postsParameter = this.getNodeParameter('posts', i);
						let posts: IDataObject[];
						if (typeof postsParameter === 'string') {
							try {
								posts = JSON.parse(postsParameter);
							} catch {
								throw new NodeOperationError(this.getNode(), 'Posts must be valid JSON', {
									itemIndex: i,
								});
							}
						} else {
							posts = postsParameter as IDataObject[];
						}
						if (!Array.isArray(posts)) {
							throw new NodeOperationError(this.getNode(), 'Posts must be a JSON array', {
								itemIndex: i,
							});
						}

						responseData = await nimplyApiRequest.call(this, 'POST', '/v1/posts/bulk', { posts });
					} else if (operation === 'get') {
						const postId = this.getNodeParameter('postId', i) as string;
						responseData = await nimplyApiRequest.call(this, 'GET', `/v1/posts/${postId}`);
					} else if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i) as IDataObject;
						const qs: IDataObject = { ...filters };

						if (returnAll) {
							responseData = await nimplyApiRequestAllItems.call(this, '/v1/posts', qs);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = await nimplyApiRequestAllItems.call(this, '/v1/posts', qs, limit);
						}
					} else if (operation === 'update') {
						const postId = this.getNodeParameter('postId', i) as string;
						const body = this.getNodeParameter('updateFields', i) as IDataObject;
						responseData = await nimplyApiRequest.call(this, 'PATCH', `/v1/posts/${postId}`, body);
					} else if (operation === 'delete') {
						const postId = this.getNodeParameter('postId', i) as string;
						responseData = await nimplyApiRequest.call(this, 'DELETE', `/v1/posts/${postId}`);
					} else if (operation === 'schedule') {
						const postId = this.getNodeParameter('postId', i) as string;
						const scheduledAt = this.getNodeParameter('scheduledAt', i) as string;
						responseData = await nimplyApiRequest.call(
							this,
							'POST',
							`/v1/posts/${postId}/schedule`,
							{ scheduledAt },
						);
					} else if (operation === 'unschedule') {
						const postId = this.getNodeParameter('postId', i) as string;
						responseData = await nimplyApiRequest.call(
							this,
							'POST',
							`/v1/posts/${postId}/unschedule`,
						);
					} else if (operation === 'publish') {
						const postId = this.getNodeParameter('postId', i) as string;
						responseData = await nimplyApiRequest.call(this, 'POST', `/v1/posts/${postId}/publish`);
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`The operation "${operation}" is not supported`,
							{ itemIndex: i },
						);
					}
				} else if (resource === 'channel') {
					if (operation === 'getAll') {
						responseData = await nimplyApiRequest.call(this, 'GET', '/v1/channels');
					} else if (operation === 'getSchedule') {
						const channelId = this.getNodeParameter('channelId', i) as string;
						responseData = await nimplyApiRequest.call(
							this,
							'GET',
							`/v1/channels/${channelId}/schedule`,
						);
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`The operation "${operation}" is not supported`,
							{ itemIndex: i },
						);
					}
				} else if (resource === 'media') {
					if (operation === 'upload') {
						const body: IDataObject = {
							url: this.getNodeParameter('url', i) as string,
						};
						const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
						if (additionalFields.name) body.name = additionalFields.name;

						responseData = await nimplyApiRequest.call(this, 'POST', '/v1/media', body);
					} else if (operation === 'uploadBinary') {
						const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
						const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
						const contentType = binaryData.mimeType || 'application/octet-stream';
						const fileName = binaryData.fileName || 'upload';

						// Presigned flow: ticket → PUT the raw bytes → complete.
						const ticket = (await nimplyApiRequest.call(this, 'POST', '/v1/media/uploads', {
							fileName,
							contentType,
							sizeBytes: buffer.length,
						})) as IDataObject;

						await this.helpers.httpRequest({
							method: 'PUT',
							url: ticket.uploadUrl as string,
							body: buffer,
							headers: (ticket.headers as IDataObject) ?? { 'Content-Type': contentType },
						});

						responseData = await nimplyApiRequest.call(
							this,
							'POST',
							`/v1/media/uploads/${ticket.mediaId}/complete`,
							{ sizeBytes: buffer.length },
						);
					} else if (operation === 'getAll') {
						const returnAll = this.getNodeParameter('returnAll', i) as boolean;
						const filters = this.getNodeParameter('filters', i) as IDataObject;
						const qs: IDataObject = { ...filters };

						if (returnAll) {
							responseData = await nimplyApiRequestAllItems.call(this, '/v1/media', qs);
						} else {
							const limit = this.getNodeParameter('limit', i) as number;
							responseData = await nimplyApiRequestAllItems.call(this, '/v1/media', qs, limit);
						}
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`The operation "${operation}" is not supported`,
							{ itemIndex: i },
						);
					}
				} else if (resource === 'analytics') {
					if (operation === 'workspace') {
						const options = this.getNodeParameter('options', i) as IDataObject;
						responseData = await nimplyApiRequest.call(
							this,
							'GET',
							'/v1/analytics/workspace',
							{},
							options,
						);
					} else if (operation === 'channel') {
						const channelId = this.getNodeParameter('channelId', i) as string;
						const options = this.getNodeParameter('options', i) as IDataObject;
						responseData = await nimplyApiRequest.call(
							this,
							'GET',
							`/v1/analytics/channels/${channelId}`,
							{},
							options,
						);
					} else if (operation === 'post') {
						const postId = this.getNodeParameter('postId', i) as string;
						responseData = await nimplyApiRequest.call(
							this,
							'GET',
							`/v1/analytics/posts/${postId}`,
						);
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`The operation "${operation}" is not supported`,
							{ itemIndex: i },
						);
					}
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The resource "${resource}" is not supported`,
						{ itemIndex: i },
					);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
