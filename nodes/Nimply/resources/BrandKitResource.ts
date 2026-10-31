import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { nimplyApiRequest, parseJsonParameter, splitIds } from '../GenericFunctions';

const brandKitIdField = (operations: string[]): INodeProperties => ({
	displayName: 'Brand Kit Name or ID',
	name: 'brandKitId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getBrandKits' },
	required: true,
	default: '',
	displayOptions: {
		show: { resource: ['brandKit'], operation: operations },
	},
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
});

const kitFields: INodeProperties[] = [
	{
		displayName: 'Colors',
		name: 'palette',
		type: 'string',
		default: '',
		placeholder: '#F0530F, #1B1815',
		description:
			'Comma-separated hex colours, most important first (primary, then secondary). Replaces the whole list.',
	},
	{
		displayName: 'Guidelines',
		name: 'guidelines',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'Brand guidelines (Markdown)',
	},
	{
		displayName: 'Logo Media ID',
		name: 'logoMediaId',
		type: 'string',
		default: '',
		description: 'An image media ID from the media library',
	},
	{
		displayName: 'Voice',
		name: 'voice',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'How the brand sounds, in plain words',
	},
];

export const brandKitProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['brandKit'] },
		},
		options: [
			{
				name: 'Add Look Examples',
				value: 'addStyleExamples',
				description: "Add your own images or published posts to learn the brand's look from",
				action: 'Add look examples to a brand kit',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a brand kit',
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a brand kit',
			},
			{
				name: 'Get Import',
				value: 'getImport',
				description: 'Get a brand import and its draft once ready',
				action: 'Get a brand import',
			},
			{
				name: 'Get Look',
				value: 'getStyle',
				description: "Get the brand kit's learned look, examples and rules",
				action: 'Get a brand kit look',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many brand kits',
			},
			{
				name: 'Import From Sources',
				value: 'importFromSources',
				description:
					'Build a brand kit draft from a website, notes, a PDF brand book, a channel or images. Uses AI credits.',
				action: 'Import a brand from sources',
			},
			{
				name: 'Import From Website',
				value: 'importFromWebsite',
				description: "Read a brand's colours, fonts and logo from its website",
				action: 'Import a brand from a website',
			},
			{
				name: 'Learn Look',
				value: 'learnStyle',
				description: 'Learn the look from the examples (needs at least 3). Uses AI credits.',
				action: 'Learn a brand kit look',
			},
			{
				name: 'Save Import',
				value: 'saveImport',
				description: 'Save a ready brand import as a brand kit',
				action: 'Save a brand import',
			},
			{
				name: 'Set Look Rules',
				value: 'setStyleRules',
				description: 'Replace your own rules for the look, e.g. "Never use script fonts"',
				action: 'Set brand kit look rules',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a brand kit',
			},
		],
		default: 'getAll',
	},

	brandKitIdField(['get', 'update', 'getStyle', 'addStyleExamples', 'learnStyle', 'setStyleRules']),

	// brandKit:create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['create'] },
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['create'] },
		},
		options: kitFields,
	},

	// brandKit:update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['update'] },
		},
		options: [
			...kitFields,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
		],
	},

	// brandKit:importFromWebsite
	{
		displayName: 'Website',
		name: 'website',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'brewhaus.coffee',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['importFromWebsite'] },
		},
	},

	// brandKit:importFromSources
	{
		displayName: 'Sources (JSON)',
		name: 'sources',
		type: 'json',
		required: true,
		default: '[\n  { "kind": "website", "website": "brewhaus.coffee" }\n]',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['importFromSources'] },
		},
		description:
			'1–6 sources in any mix. Kinds: website (website), text (text), pdf (mediaId), channel (channelId), images (mediaIds).',
	},
	{
		displayName: 'Add to Brand Kit ID',
		name: 'targetBrandKitId',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['importFromSources'] },
		},
		description: 'Add to this existing brand kit instead of making a new one (leave empty for new)',
	},

	// brandKit:getImport / saveImport
	{
		displayName: 'Import ID',
		name: 'importId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['getImport', 'saveImport'] },
		},
	},
	{
		displayName: 'Save Options (JSON)',
		name: 'saveOptions',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['saveImport'] },
		},
		description:
			'Optional choices from the draft, e.g. {"picks":{"name":"Brewhaus"},"logo":0,"channelIds":["…"],"learn":true}',
	},

	// brandKit:addStyleExamples
	{
		displayName: 'Image Media IDs',
		name: 'mediaIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['addStyleExamples'] },
		},
		description: 'Comma-separated image media IDs from the media library',
	},
	{
		displayName: 'Post IDs',
		name: 'postIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['addStyleExamples'] },
		},
		description: 'Comma-separated IDs of published posts with an image',
	},

	// brandKit:learnStyle
	{
		displayName: 'Relearn From All Examples',
		name: 'relearnAll',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['learnStyle'] },
		},
		description: 'Whether to learn from every example again, not only the new ones (costs more)',
	},

	// brandKit:setStyleRules
	{
		displayName: 'Rules (JSON)',
		name: 'rules',
		type: 'json',
		required: true,
		default: '[\n  { "text": "Never use script fonts." }\n]',
		displayOptions: {
			show: { resource: ['brandKit'], operation: ['setStyleRules'] },
		},
		description:
			'The whole list of your own rules (as Get Look returns them, with your changes). Your rules left out are deleted.',
	},
];

function kitBody(fields: IDataObject): IDataObject {
	const body: IDataObject = {};
	if (fields.name) body.name = fields.name;
	if (fields.palette) body.colors = splitIds(fields.palette as string);
	for (const key of ['voice', 'guidelines', 'logoMediaId']) {
		if (fields[key]) body[key] = fields[key];
	}
	return body;
}

export async function executeBrandKit(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'getAll') {
		const response = (await nimplyApiRequest.call(this, 'GET', '/v1/brand-kits')) as {
			data: IDataObject[];
		};
		return response.data;
	}
	if (operation === 'create') {
		const body = {
			...kitBody(this.getNodeParameter('additionalFields', i) as IDataObject),
			name: this.getNodeParameter('name', i) as string,
		};
		return await nimplyApiRequest.call(this, 'POST', '/v1/brand-kits', body);
	}
	if (operation === 'importFromWebsite') {
		const website = this.getNodeParameter('website', i) as string;
		return await nimplyApiRequest.call(this, 'POST', '/v1/brand-kits/import', { website });
	}
	if (operation === 'importFromSources') {
		const body: IDataObject = {
			sources: parseJsonParameter.call(this, this.getNodeParameter('sources', i), 'Sources', i, []),
		};
		const target = this.getNodeParameter('targetBrandKitId', i, '') as string;
		if (target) body.brandKitId = target;
		return await nimplyApiRequest.call(this, 'POST', '/v1/brand-kits/imports', body);
	}
	if (operation === 'getImport' || operation === 'saveImport') {
		const importId = this.getNodeParameter('importId', i) as string;
		if (operation === 'getImport') {
			return await nimplyApiRequest.call(this, 'GET', `/v1/brand-kits/imports/${importId}`);
		}
		const body = parseJsonParameter.call(
			this,
			this.getNodeParameter('saveOptions', i),
			'Save Options',
			i,
			{},
		);
		return await nimplyApiRequest.call(this, 'POST', `/v1/brand-kits/imports/${importId}/save`, body);
	}

	const brandKitId = this.getNodeParameter('brandKitId', i) as string;
	const base = `/v1/brand-kits/${brandKitId}`;

	if (operation === 'get') return await nimplyApiRequest.call(this, 'GET', base);
	if (operation === 'getStyle') return await nimplyApiRequest.call(this, 'GET', `${base}/style`);
	if (operation === 'update') {
		const body = kitBody(this.getNodeParameter('updateFields', i) as IDataObject);
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Set at least one field to update', {
				itemIndex: i,
			});
		}
		return await nimplyApiRequest.call(this, 'PATCH', base, body);
	}
	if (operation === 'addStyleExamples') {
		const body: IDataObject = {};
		const mediaIds = splitIds(this.getNodeParameter('mediaIds', i, '') as string);
		const postIds = splitIds(this.getNodeParameter('postIds', i, '') as string);
		if (mediaIds.length) body.mediaIds = mediaIds;
		if (postIds.length) body.postIds = postIds;
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Add at least one image or post ID', {
				itemIndex: i,
			});
		}
		return await nimplyApiRequest.call(this, 'POST', `${base}/style/examples`, body);
	}
	if (operation === 'learnStyle') {
		const relearnAll = this.getNodeParameter('relearnAll', i) as boolean;
		return await nimplyApiRequest.call(
			this,
			'POST',
			`${base}/style/learn`,
			relearnAll ? { relearnAll } : {},
		);
	}
	if (operation === 'setStyleRules') {
		const rules = parseJsonParameter.call(this, this.getNodeParameter('rules', i), 'Rules', i, []);
		return await nimplyApiRequest.call(this, 'PUT', `${base}/style/rules`, { rules });
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}
