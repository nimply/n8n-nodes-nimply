import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	nimplyApiRequest,
	nimplyApiRequestAllItems,
	splitIds,
	waitForCompletion,
} from '../GenericFunctions';

const JOB_FINAL_STATUSES = ['done', 'failed', 'cancelled'];

const waitFields = (operations: string[]): INodeProperties[] => [
	{
		displayName: 'Wait for Completion',
		name: 'waitForCompletion',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: { resource: ['design'], operation: operations },
		},
		description:
			'Whether to wait until the designs are ready (usually 1–3 minutes per size) and return them; otherwise return the job straight away and check later with Get Job',
	},
	{
		displayName: 'Max Wait (Seconds)',
		name: 'maxWait',
		type: 'number',
		typeOptions: { minValue: 5, maxValue: 900 },
		default: 420,
		displayOptions: {
			show: { resource: ['design'], operation: operations, waitForCompletion: [true] },
		},
		description: 'Stop waiting after this long and return the job as it is',
	},
];

export const designProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['design'] },
		},
		options: [
			{
				name: 'Cancel Job',
				value: 'cancelJob',
				description: 'Stop a design job that has not finished',
				action: 'Cancel a design job',
			},
			{
				name: 'Create From Image',
				value: 'fromImage',
				description:
					'Turn an image into an editable design with separate layers. Uses AI credits.',
				action: 'Create a design from an image',
			},
			{
				name: 'Create From Prompt',
				value: 'generate',
				description: 'Design a post or carousel from a short brief. Uses AI credits.',
				action: 'Create a design from a prompt',
			},
			{
				name: 'Estimate Credits',
				value: 'estimate',
				description: 'See the most credits a design run can use before starting it',
				action: 'Estimate design credits',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a design with its edit link and preview images',
				action: 'Get a design',
			},
			{
				name: 'Get Job',
				value: 'getJob',
				description: 'Get the progress and results of a design job',
				action: 'Get a design job',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List designs',
				action: 'Get many designs',
			},
			{
				name: 'Get Sizes',
				value: 'getSizes',
				description: 'List the design sizes (Instagram post, story, LinkedIn, …)',
				action: 'Get design sizes',
			},
		],
		default: 'generate',
	},

	// design:generate
	{
		displayName: 'Prompt',
		name: 'prompt',
		type: 'string',
		typeOptions: { rows: 4 },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['design'], operation: ['generate'] },
		},
		description:
			'What the design is about: audience, offer, dates, prices. The first line becomes its name.',
	},
	{
		displayName: 'Size Names or IDs',
		name: 'sizes',
		type: 'multiOptions',
		typeOptions: { loadOptionsMethod: 'getDesignSizes' },
		default: [],
		displayOptions: {
			show: { resource: ['design'], operation: ['generate'] },
		},
		description:
			'Up to 3 sizes; one design is made per size. Defaults to Instagram post (4:5). Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['design'], operation: ['generate'] },
		},
		options: [
			{
				displayName: 'Brand Kit Name or ID',
				name: 'brandKitId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getBrandKits' },
				default: '',
				description:
					'Brand kit to design with. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Call to Action',
				name: 'cta',
				type: 'string',
				default: '',
				placeholder: 'Book a table',
			},
			{
				displayName: 'Channel Name or ID',
				name: 'channelId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAllChannels' },
				default: '',
				description:
					'Channel the design is for; its brand kit is used. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'Single Image', value: 'single' },
					{ name: 'Carousel', value: 'carousel' },
				],
				default: 'single',
			},
			{
				displayName: 'Language',
				name: 'locale',
				type: 'string',
				default: '',
				placeholder: 'en',
				description: 'Language of the copy',
			},
			{
				displayName: 'Max Credits',
				name: 'maxCredits',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 500,
				description: 'Refuse to start if the run could cost more than this many credits',
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 7 },
				default: 5,
				description: 'Carousel slides (at most 7). Defaults to 1, or 5 for a carousel.',
			},
			{
				displayName: 'Photo Media IDs',
				name: 'photoMediaIds',
				type: 'string',
				default: '',
				description: 'Comma-separated media IDs of up to 4 images to feature, e.g. a product shot',
			},
			{
				displayName: 'Style Hint',
				name: 'styleHint',
				type: 'string',
				default: '',
				placeholder: 'Bold, minimal, lots of white space',
			},
			{
				displayName: 'Use Learned Look',
				name: 'useLearnedStyle',
				type: 'boolean',
				default: true,
				description:
					"Whether to apply the brand kit's learned look when it has one; off uses only its colours, fonts and logo",
			},
		],
	},

	// design:fromImage
	{
		displayName: 'Image Source',
		name: 'imageSource',
		type: 'options',
		options: [
			{ name: 'Media Library', value: 'media' },
			{ name: 'Image URL', value: 'url' },
		],
		default: 'media',
		displayOptions: {
			show: { resource: ['design'], operation: ['fromImage'] },
		},
	},
	{
		displayName: 'Media ID',
		name: 'mediaId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['design'], operation: ['fromImage'], imageSource: ['media'] },
		},
		description: 'Image media ID (upload via the Media resource first)',
	},
	{
		displayName: 'Image URL',
		name: 'imageUrl',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'https://example.com/flyer.png',
		displayOptions: {
			show: { resource: ['design'], operation: ['fromImage'], imageSource: ['url'] },
		},
		description: 'Public image URL; it is imported into the media library first',
	},
	{
		displayName: 'What to Make Editable',
		name: 'mode',
		type: 'options',
		options: [
			{ name: 'Text Only (Cheaper)', value: 'text' },
			{ name: 'Objects Only', value: 'objects' },
			{ name: 'Everything', value: 'everything' },
		],
		default: 'text',
		displayOptions: {
			show: { resource: ['design'], operation: ['fromImage'] },
		},
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['design'], operation: ['fromImage'] },
		},
	},

	...waitFields(['generate', 'fromImage']),

	// design:getJob / cancelJob
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['design'], operation: ['getJob', 'cancelJob'] },
		},
	},

	// design:get
	{
		displayName: 'Design ID',
		name: 'designId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['design'], operation: ['get'] },
		},
	},

	// design:estimate
	{
		displayName: 'Kind',
		name: 'kind',
		type: 'options',
		options: [
			{ name: 'Create From Prompt', value: 'generate' },
			{ name: 'Create From Image', value: 'layers' },
		],
		default: 'generate',
		displayOptions: {
			show: { resource: ['design'], operation: ['estimate'] },
		},
	},
	{
		displayName: 'Options',
		name: 'estimateOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: { resource: ['design'], operation: ['estimate'] },
		},
		options: [
			{
				displayName: 'Brand Kit Name or ID',
				name: 'brandKitId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getBrandKits' },
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: [
					{ name: 'Everything', value: 'everything' },
					{ name: 'Objects Only', value: 'objects' },
					{ name: 'Text Only', value: 'text' },
				],
				default: 'text',
				description: 'For Create From Image: what becomes editable',
			},
			{
				displayName: 'Pages',
				name: 'pages',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 7 },
				default: 1,
			},
			{
				displayName: 'Size Names or IDs',
				name: 'sizes',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getDesignSizes' },
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
		],
	},

	// design:getAll
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: { resource: ['design'], operation: ['getAll'] },
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
			show: { resource: ['design'], operation: ['getAll'], returnAll: [false] },
		},
		description: 'Max number of results to return',
	},
];

async function finishJob(
	this: IExecuteFunctions,
	job: IDataObject,
	i: number,
): Promise<IDataObject> {
	if (!(this.getNodeParameter('waitForCompletion', i) as boolean)) return job;
	const maxWait = this.getNodeParameter('maxWait', i) as number;
	return await waitForCompletion.call(
		this,
		`/v1/design-jobs/${job.id}`,
		job,
		JOB_FINAL_STATUSES,
		maxWait,
	);
}

export async function executeDesign(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'generate') {
		const body: IDataObject = { prompt: this.getNodeParameter('prompt', i) as string };
		const sizes = this.getNodeParameter('sizes', i, []) as string[];
		if (sizes.length) body.sizes = sizes;
		const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
		for (const key of [
			'brandKitId',
			'channelId',
			'cta',
			'format',
			'locale',
			'maxCredits',
			'pages',
			'styleHint',
			'useLearnedStyle',
		]) {
			const value = additionalFields[key];
			if (value !== undefined && value !== '') body[key] = value;
		}
		if (additionalFields.photoMediaIds) {
			body.photoMediaIds = splitIds(additionalFields.photoMediaIds as string);
		}
		const job = (await nimplyApiRequest.call(this, 'POST', '/v1/designs/generate', body)) as IDataObject;
		return await finishJob.call(this, job, i);
	}
	if (operation === 'fromImage') {
		const body: IDataObject = { mode: this.getNodeParameter('mode', i) as string };
		if ((this.getNodeParameter('imageSource', i) as string) === 'url') {
			body.imageUrl = this.getNodeParameter('imageUrl', i) as string;
		} else {
			body.mediaId = this.getNodeParameter('mediaId', i) as string;
		}
		const name = this.getNodeParameter('name', i, '') as string;
		if (name) body.name = name;
		const job = (await nimplyApiRequest.call(this, 'POST', '/v1/designs/from-image', body)) as IDataObject;
		return await finishJob.call(this, job, i);
	}
	if (operation === 'getJob') {
		const jobId = this.getNodeParameter('jobId', i) as string;
		return await nimplyApiRequest.call(this, 'GET', `/v1/design-jobs/${jobId}`);
	}
	if (operation === 'cancelJob') {
		const jobId = this.getNodeParameter('jobId', i) as string;
		return await nimplyApiRequest.call(this, 'POST', `/v1/design-jobs/${jobId}/cancel`);
	}
	if (operation === 'get') {
		const designId = this.getNodeParameter('designId', i) as string;
		return await nimplyApiRequest.call(this, 'GET', `/v1/designs/${designId}`);
	}
	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
		return await nimplyApiRequestAllItems.call(this, '/v1/designs', {}, limit);
	}
	if (operation === 'getSizes') {
		const response = (await nimplyApiRequest.call(this, 'GET', '/v1/design-sizes')) as {
			data: IDataObject[];
		};
		return response.data;
	}
	if (operation === 'estimate') {
		const qs: IDataObject = { kind: this.getNodeParameter('kind', i) as string };
		const options = this.getNodeParameter('estimateOptions', i) as IDataObject;
		if (options.brandKitId) qs.brandKitId = options.brandKitId;
		if (options.pages) qs.pages = options.pages;
		if (options.mode && qs.kind === 'layers') qs.mode = options.mode;
		if (Array.isArray(options.sizes) && options.sizes.length) qs.sizes = options.sizes.join(',');
		return await nimplyApiRequest.call(this, 'GET', '/v1/designs/estimate', {}, qs);
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}
