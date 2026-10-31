import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { nimplyApiRequest, parseJsonParameter } from '../GenericFunctions';

export const automationProperties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: { resource: ['automation'] },
		},
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create an automation from a list of steps (saved as a draft)',
				action: 'Create an automation',
			},
			{
				name: 'Create From Recipe',
				value: 'createFromRecipe',
				description: 'Create an automation from a ready-made recipe (saved as a draft)',
				action: 'Create an automation from a recipe',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an automation',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get an automation with its steps',
				action: 'Get an automation',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'List automations',
				action: 'Get many automations',
			},
			{
				name: 'Get Recipes',
				value: 'getRecipes',
				description: 'List the ready-made automation recipes',
				action: 'Get automation recipes',
			},
			{
				name: 'Get Run',
				value: 'getRun',
				description: 'Get one run with what each step did',
				action: 'Get an automation run',
			},
			{
				name: 'Get Runs',
				value: 'getRuns',
				description: 'List recent runs of an automation',
				action: 'Get automation runs',
			},
			{
				name: 'Get Step Types',
				value: 'getStepTypes',
				description: 'List the triggers and actions an automation can use, with their settings',
				action: 'Get automation step types',
			},
			{
				name: 'Pause',
				value: 'pause',
				description: 'Switch an automation off',
				action: 'Pause an automation',
			},
			{
				name: 'Run',
				value: 'run',
				description: 'Run an active automation now',
				action: 'Run an automation',
			},
			{
				name: 'Switch On',
				value: 'activate',
				description: 'Switch an automation on so its trigger starts it',
				action: 'Switch on an automation',
			},
			{
				name: 'Test',
				value: 'test',
				description: 'Try an automation with sample data; nothing is posted or sent',
				action: 'Test an automation',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Rename an automation or replace its steps',
				action: 'Update an automation',
			},
		],
		default: 'getAll',
	},

	// automation:createFromRecipe
	{
		displayName: 'Recipe Name or ID',
		name: 'recipeId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAutomationRecipes' },
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['automation'], operation: ['createFromRecipe'] },
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Blanks (JSON)',
		name: 'values',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { resource: ['automation'], operation: ['createFromRecipe'] },
		},
		description:
			"The recipe's blanks by key (see Get Recipes). Agent blanks take an agent ID. Blanks left out stay empty.",
	},

	// automation:create
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['automation'], operation: ['create'] },
		},
	},
	{
		displayName: 'Steps (JSON)',
		name: 'steps',
		type: 'json',
		required: true,
		default:
			'[\n  { "type": "trigger.schedule", "params": { "cron": "0 9 * * 1" } },\n  { "type": "<action step type>", "params": {} }\n]',
		displayOptions: {
			show: { resource: ['automation'], operation: ['create'] },
		},
		description:
			'One trigger first, then the actions (at most 30). Step types and their settings come from Get Step Types. Steps run in order unless you add Connections.',
	},

	// automation:create / createFromRecipe options
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['automation'], operation: ['create'] },
		},
		options: [
			{
				displayName: 'Connections (JSON)',
				name: 'edges',
				type: 'json',
				default: '[]',
				description:
					'How the steps connect, needed for If branches: [{"source":"check","target":"notify","sourceHandle":"true"}]',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['automation'], operation: ['createFromRecipe'] },
		},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: "Defaults to the recipe's name",
			},
		],
	},

	// automation:get / update / delete / activate / pause / run / test / getRuns
	{
		displayName: 'Automation Name or ID',
		name: 'automationId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getAutomations' },
		required: true,
		default: '',
		displayOptions: {
			show: {
				resource: ['automation'],
				operation: ['get', 'update', 'delete', 'activate', 'pause', 'run', 'test', 'getRuns'],
			},
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},

	// automation:getRun
	{
		displayName: 'Run ID',
		name: 'runId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['automation'], operation: ['getRun'] },
		},
	},

	// automation:update
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: { resource: ['automation'], operation: ['update'] },
		},
		options: [
			{
				displayName: 'Connections (JSON)',
				name: 'edges',
				type: 'json',
				default: '[]',
				description: 'Only with Steps: how the steps connect (needed for If branches)',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
			},
			{
				displayName: 'Steps (JSON)',
				name: 'steps',
				type: 'json',
				default: '[]',
				description: 'Replaces what the automation does (same format as Create)',
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 0,
				description:
					'The version you last read. If the automation changed since, nothing is saved and you get a conflict error.',
			},
		],
	},

	// automation:test
	{
		displayName: 'Sample Trigger Data (JSON)',
		name: 'triggerData',
		type: 'json',
		default: '{}',
		displayOptions: {
			show: { resource: ['automation'], operation: ['test'] },
		},
		description:
			'Data the trigger hands to the steps as {{trigger.…}}. Leave empty to use realistic sample data.',
	},

	// automation:getAll
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: {
			show: { resource: ['automation'], operation: ['getAll'] },
		},
		options: [
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				options: [
					{ name: 'Active', value: 'ACTIVE' },
					{ name: 'Draft', value: 'DRAFT' },
					{ name: 'Paused', value: 'PAUSED' },
				],
				default: 'ACTIVE',
			},
		],
	},

	// automation:getRuns
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: { resource: ['automation'], operation: ['getRuns'] },
		},
		description: 'Max number of results to return',
	},
];

export async function executeAutomation(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	const list = async (endpoint: string, qs: IDataObject = {}) =>
		((await nimplyApiRequest.call(this, 'GET', endpoint, {}, qs)) as { data: IDataObject[] }).data;

	if (operation === 'getRecipes') return await list('/v1/automation-recipes');
	if (operation === 'getStepTypes') return await list('/v1/automation-step-types');
	if (operation === 'getAll') {
		const filters = this.getNodeParameter('filters', i) as IDataObject;
		return await list('/v1/automations', filters.status ? { status: filters.status } : {});
	}
	if (operation === 'getRun') {
		const runId = this.getNodeParameter('runId', i) as string;
		return await nimplyApiRequest.call(this, 'GET', `/v1/automation-runs/${runId}`);
	}
	if (operation === 'createFromRecipe') {
		const body: IDataObject = {
			recipeId: this.getNodeParameter('recipeId', i) as string,
		};
		const values = parseJsonParameter.call(this, this.getNodeParameter('values', i), 'Blanks', i, {});
		if (Object.keys(values).length) body.values = values;
		const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
		if (additionalFields.name) body.name = additionalFields.name;
		return await nimplyApiRequest.call(this, 'POST', '/v1/automations/from-recipe', body);
	}
	if (operation === 'create') {
		const body: IDataObject = {
			name: this.getNodeParameter('name', i) as string,
			steps: parseJsonParameter.call(this, this.getNodeParameter('steps', i), 'Steps', i, []),
		};
		const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;
		if (additionalFields.description) body.description = additionalFields.description;
		const edges = parseJsonParameter.call(this, additionalFields.edges, 'Connections', i, []);
		if (Array.isArray(edges) && edges.length) body.edges = edges;
		return await nimplyApiRequest.call(this, 'POST', '/v1/automations', body);
	}

	const automationId = this.getNodeParameter('automationId', i) as string;
	const base = `/v1/automations/${automationId}`;

	if (operation === 'get') return await nimplyApiRequest.call(this, 'GET', base);
	if (operation === 'delete') return await nimplyApiRequest.call(this, 'DELETE', base);
	if (operation === 'activate') return await nimplyApiRequest.call(this, 'POST', `${base}/activate`);
	if (operation === 'pause') return await nimplyApiRequest.call(this, 'POST', `${base}/pause`);
	if (operation === 'run') return await nimplyApiRequest.call(this, 'POST', `${base}/run`);
	if (operation === 'getRuns') {
		return await list(`${base}/runs`, { limit: this.getNodeParameter('limit', i) as number });
	}
	if (operation === 'test') {
		const triggerData = parseJsonParameter.call(
			this,
			this.getNodeParameter('triggerData', i),
			'Sample Trigger Data',
			i,
			{},
		);
		const body: IDataObject = Object.keys(triggerData).length ? { triggerData } : {};
		return await nimplyApiRequest.call(this, 'POST', `${base}/test`, body);
	}
	if (operation === 'update') {
		const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;
		const body: IDataObject = {};
		if (updateFields.name) body.name = updateFields.name;
		if (updateFields.description !== undefined) body.description = updateFields.description;
		const steps = parseJsonParameter.call(this, updateFields.steps, 'Steps', i, []);
		if (Array.isArray(steps) && steps.length) body.steps = steps;
		const edges = parseJsonParameter.call(this, updateFields.edges, 'Connections', i, []);
		if (Array.isArray(edges) && edges.length) body.edges = edges;
		if (updateFields.version) body.version = updateFields.version;
		if (Object.keys(body).length === 0) {
			throw new NodeOperationError(this.getNode(), 'Set at least one field to update', {
				itemIndex: i,
			});
		}
		return await nimplyApiRequest.call(this, 'PATCH', base, body);
	}

	throw new NodeOperationError(this.getNode(), `The operation "${operation}" is not supported`, {
		itemIndex: i,
	});
}
