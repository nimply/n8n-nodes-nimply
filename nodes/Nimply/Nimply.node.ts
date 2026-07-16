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

async function loadChannelsByType(
	this: ILoadOptionsFunctions,
	types: string[],
): Promise<INodePropertyOptions[]> {
	const channels = (await nimplyApiRequest.call(this, 'GET', '/v1/channels')) as Array<{
		id: string;
		name: string;
		type: string;
	}>;
	return channels
		.filter((channel) => types.includes(channel.type))
		.map((channel) => ({
			name: types.length > 1 ? `${channel.name} (${channel.type})` : channel.name,
			value: channel.id,
		}));
}

/** Copy collection fields into the body, skipping fields left empty. */
function assignSetFields(body: IDataObject, fields: IDataObject): void {
	for (const [key, value] of Object.entries(fields)) {
		if (value !== '' && value !== undefined) body[key] = value;
	}
}

function splitIds(ids: string): string[] {
	return ids
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');
}

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
						name: 'Create LinkedIn Post',
						value: 'createLinkedIn',
						description: 'Post to a LinkedIn profile or company page with visibility control',
						action: 'Create a linked in post',
					},
					{
						name: 'Create Pinterest Pin',
						value: 'createPinterest',
						description: 'Create a pin on a specific board with link and alt text',
						action: 'Create a pinterest pin',
					},
					{
						name: 'Create TikTok Post',
						value: 'createTikTok',
						description: 'Post a video or photos to TikTok with privacy and interaction settings',
						action: 'Create a tiktok post',
					},
					{
						name: 'Create YouTube Video',
						value: 'createYouTube',
						description: 'Upload a video or Short with full YouTube options',
						action: 'Create a you tube video',
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
					show: {
						resource: ['post'],
						operation: ['create', 'createYouTube', 'createTikTok', 'createPinterest', 'createLinkedIn'],
					},
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
					show: {
						resource: ['post'],
						operation: ['create', 'createYouTube', 'createTikTok', 'createPinterest', 'createLinkedIn'],
						schedule: ['custom'],
					},
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

			// post:createYouTube
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getYouTubeChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createYouTube'] },
				},
				description:
					'YouTube channel to upload to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createYouTube'] },
				},
				description: 'Video title (required by YouTube, max 100 characters)',
			},
			{
				displayName: 'Video Media ID',
				name: 'mediaId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createYouTube'] },
				},
				description: 'Media asset ID of the video (upload via the Media resource first)',
			},
			{
				displayName: 'Additional Fields',
				name: 'youtubeFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['createYouTube'] },
				},
				options: [
					{
						displayName: 'Allow Embedding',
						name: 'allowEmbedding',
						type: 'boolean',
						default: true,
						description: 'Whether the video can be embedded on other sites',
					},
					{
						displayName: 'Category',
						name: 'category',
						type: 'options',
						options: [
							{ name: 'Autos & Vehicles', value: '2' },
							{ name: 'Comedy', value: '23' },
							{ name: 'Education', value: '27' },
							{ name: 'Entertainment', value: '24' },
							{ name: 'Film & Animation', value: '1' },
							{ name: 'Gaming', value: '20' },
							{ name: 'Howto & Style', value: '26' },
							{ name: 'Music', value: '10' },
							{ name: 'News & Politics', value: '25' },
							{ name: 'People & Blogs', value: '22' },
							{ name: 'Pets & Animals', value: '15' },
							{ name: 'Science & Technology', value: '28' },
							{ name: 'Sports', value: '17' },
							{ name: 'Travel & Events', value: '19' },
						],
						default: '22',
						description: 'YouTube video category',
					},
					{
						displayName: 'Description',
						name: 'description',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description: 'Video description',
					},
					{
						displayName: 'License',
						name: 'license',
						type: 'options',
						options: [
							{ name: 'Creative Commons', value: 'creativeCommon' },
							{ name: 'Standard YouTube License', value: 'youtube' },
						],
						default: 'youtube',
					},
					{
						displayName: 'Made for Kids',
						name: 'madeForKids',
						type: 'boolean',
						default: false,
						description: 'Whether to self-declare the video as made for kids (COPPA)',
					},
					{
						displayName: 'Notify Subscribers',
						name: 'notifySubscribers',
						type: 'boolean',
						default: true,
						description: 'Whether to notify channel subscribers about the new video',
					},
					{
						displayName: 'Video Type',
						name: 'videoType',
						type: 'options',
						options: [
							{ name: 'Video', value: 'video' },
							{ name: 'Short', value: 'short' },
						],
						default: 'video',
						description: 'Regular video upload or a YouTube Short',
					},
					{
						displayName: 'Visibility',
						name: 'visibility',
						type: 'options',
						options: [
							{ name: 'Private', value: 'private' },
							{ name: 'Public', value: 'public' },
							{ name: 'Unlisted', value: 'unlisted' },
						],
						default: 'public',
						description: 'Who can see the video',
					},
				],
			},

			// post:createTikTok
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getTikTokChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createTikTok'] },
				},
				description:
					'TikTok channel to post to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Media IDs',
				name: 'mediaIds',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createTikTok'] },
				},
				description:
					'Comma-separated media asset IDs in display order: 1 video or up to 35 photos (upload via the Media resource first)',
			},
			{
				displayName: 'Privacy Level Name or ID',
				name: 'privacyLevel',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTikTokPrivacyLevels',
					loadOptionsDependsOn: ['channelId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createTikTok'] },
				},
				description:
					'Who can view the post — only the levels the account allows are listed. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Additional Fields',
				name: 'tiktokFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['createTikTok'] },
				},
				options: [
					{
						displayName: 'Allow Comments',
						name: 'allowComments',
						type: 'boolean',
						default: false,
						description: 'Whether viewers can comment on the post',
					},
					{
						displayName: 'Allow Duet',
						name: 'allowDuet',
						type: 'boolean',
						default: false,
						description: 'Whether viewers can Duet the video (video posts only)',
					},
					{
						displayName: 'Allow Stitch',
						name: 'allowStitch',
						type: 'boolean',
						default: false,
						description: 'Whether viewers can Stitch the video (video posts only)',
					},
					{
						displayName: 'Branded Content',
						name: 'brandContent',
						type: 'boolean',
						default: false,
						description:
							'Whether to disclose the post as branded content (paid partnership). Not allowed with Only Me privacy.',
					},
					{
						displayName: 'Caption',
						name: 'content',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description: 'Post caption',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Post title (max 100 characters)',
					},
					{
						displayName: 'Your Brand',
						name: 'brandOrganic',
						type: 'boolean',
						default: false,
						description: 'Whether to disclose the post as promoting your own brand or business',
					},
				],
			},

			// post:createPinterest
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getPinterestChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createPinterest'] },
				},
				description:
					'Pinterest channel to pin with. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Board Name or ID',
				name: 'boardId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getPinterestBoards',
					loadOptionsDependsOn: ['channelId'],
				},
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createPinterest'] },
				},
				description:
					'Board to pin to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Media IDs',
				name: 'mediaIds',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createPinterest'] },
				},
				description:
					'Comma-separated media asset IDs in display order: up to 5 images (carousel) or 1 video (upload via the Media resource first)',
			},
			{
				displayName: 'Additional Fields',
				name: 'pinterestFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['createPinterest'] },
				},
				options: [
					{
						displayName: 'Alt Text',
						name: 'altText',
						type: 'string',
						default: '',
						description: 'Alt text for accessibility (max 500 characters)',
					},
					{
						displayName: 'Description',
						name: 'content',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description: 'Pin description',
					},
					{
						displayName: 'Destination Link',
						name: 'link',
						type: 'string',
						default: '',
						description: 'URL the pin links to',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Pin title (max 100 characters)',
					},
				],
			},

			// post:createLinkedIn
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLinkedInChannels' },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createLinkedIn'] },
				},
				description:
					'LinkedIn profile or company page to post to. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Content',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 4 },
				required: true,
				default: '',
				displayOptions: {
					show: { resource: ['post'], operation: ['createLinkedIn'] },
				},
				description: 'Post text (max 3000 characters)',
			},
			{
				displayName: 'Additional Fields',
				name: 'linkedinFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: { resource: ['post'], operation: ['createLinkedIn'] },
				},
				options: [
					{
						displayName: 'Media IDs',
						name: 'mediaIds',
						type: 'string',
						default: '',
						description:
							'Comma-separated media asset IDs in display order: up to 20 images or 1 video (upload via the Media resource first)',
					},
					{
						displayName: 'Visibility',
						name: 'visibility',
						type: 'options',
						options: [
							{ name: 'Public', value: 'PUBLIC' },
							{ name: 'Connections Only', value: 'CONNECTIONS' },
						],
						default: 'PUBLIC',
						description: 'Who can see the post (Connections Only works on personal profiles)',
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

			async getYouTubeChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChannelsByType.call(this, ['YOUTUBE']);
			},

			async getTikTokChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChannelsByType.call(this, ['TIKTOK_BUSINESS', 'TIKTOK_PERSONAL']);
			},

			async getPinterestChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChannelsByType.call(this, ['PINTEREST']);
			},

			async getLinkedInChannels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				return loadChannelsByType.call(this, ['LINKEDIN_PROFILE', 'LINKEDIN_PAGE']);
			},

			async getPinterestBoards(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const channelId = this.getCurrentNodeParameter('channelId') as string;
				if (!channelId) return [];
				const boards = (await nimplyApiRequest.call(
					this,
					'GET',
					`/v1/channels/${channelId}/pinterest/boards`,
				)) as Array<{ id: string; name: string; privacy: string }>;
				return boards.map((board) => ({
					name: board.privacy === 'PUBLIC' ? board.name : `${board.name} (${board.privacy})`,
					value: board.id,
				}));
			},

			async getTikTokPrivacyLevels(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const channelId = this.getCurrentNodeParameter('channelId') as string;
				if (!channelId) return [];
				const info = (await nimplyApiRequest.call(
					this,
					'GET',
					`/v1/channels/${channelId}/tiktok/creator-info`,
				)) as { privacyLevelOptions: string[] };
				const labels: Record<string, string> = {
					PUBLIC_TO_EVERYONE: 'Public',
					MUTUAL_FOLLOW_FRIENDS: 'Friends',
					FOLLOWER_OF_CREATOR: 'Followers',
					SELF_ONLY: 'Only Me',
				};
				return info.privacyLevelOptions.map((level) => ({
					name: labels[level] ?? level,
					value: level,
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
					} else if (
						operation === 'createYouTube' ||
						operation === 'createTikTok' ||
						operation === 'createPinterest' ||
						operation === 'createLinkedIn'
					) {
						const body: IDataObject = {
							channelId: this.getNodeParameter('channelId', i) as string,
						};

						if (operation === 'createYouTube') {
							body.title = this.getNodeParameter('title', i) as string;
							body.mediaId = this.getNodeParameter('mediaId', i) as string;
							assignSetFields(body, this.getNodeParameter('youtubeFields', i) as IDataObject);
						} else if (operation === 'createTikTok') {
							body.mediaIds = splitIds(this.getNodeParameter('mediaIds', i) as string);
							body.privacyLevel = this.getNodeParameter('privacyLevel', i) as string;
							assignSetFields(body, this.getNodeParameter('tiktokFields', i) as IDataObject);
						} else if (operation === 'createPinterest') {
							body.boardId = this.getNodeParameter('boardId', i) as string;
							body.mediaIds = splitIds(this.getNodeParameter('mediaIds', i) as string);
							assignSetFields(body, this.getNodeParameter('pinterestFields', i) as IDataObject);
						} else {
							body.content = this.getNodeParameter('content', i) as string;
							const linkedinFields = this.getNodeParameter('linkedinFields', i) as IDataObject;
							if (linkedinFields.mediaIds) {
								body.mediaIds = splitIds(linkedinFields.mediaIds as string);
							}
							if (linkedinFields.visibility) body.visibility = linkedinFields.visibility;
						}

						const schedule = this.getNodeParameter('schedule', i) as string;
						if (schedule === 'custom') {
							body.schedule = this.getNodeParameter('scheduledAt', i) as string;
						} else if (schedule !== 'draft') {
							body.schedule = schedule;
						}

						const endpoints: Record<string, string> = {
							createYouTube: '/v1/posts/youtube',
							createTikTok: '/v1/posts/tiktok',
							createPinterest: '/v1/posts/pinterest',
							createLinkedIn: '/v1/posts/linkedin',
						};
						responseData = await nimplyApiRequest.call(this, 'POST', endpoints[operation], body);
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
