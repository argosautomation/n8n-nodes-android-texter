import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

/**
 * Single-node action surface for Android Texter, organized by resource +
 * operation (the convention n8n's own first-party nodes use — keeps the
 * canvas clean instead of one tile per endpoint).
 *
 * Resources we ship in v0.1.0:
 *   - Message   →  Send | Get Status | Get History
 *   - Device    →  List
 *   - Contact   →  Create
 *   - Spam      →  Flag | Unflag
 *
 * Anything more obscure (broadcast, scheduled messages, webhook CRUD, etc.)
 * is reachable via an HTTP Request node pointed at the OpenAPI spec at
 * https://androidtexter.com/api/openapi.json — we don't need to wrap every
 * endpoint to be useful.
 */
export class AndroidTexter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Android Texter',
		name: 'androidTexter',
		icon: 'file:androidTexter.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send SMS / MMS and manage threads via Android Texter',
		defaults: {
			name: 'Android Texter',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'androidTexterApi',
				required: true,
			},
		],
		properties: [
			// ─── Resource selector ─────────────────────────────────────────
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Message', value: 'message' },
					{ name: 'Device', value: 'device' },
					{ name: 'Contact', value: 'contact' },
					{ name: 'Spam', value: 'spam' },
				],
				default: 'message',
			},

			// ─── Message operations ────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['message'] } },
				options: [
					{
						name: 'Send',
						value: 'send',
						action: 'Send an SMS or MMS',
						description: 'Queue an outbound message to a phone',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						action: 'Get message delivery status',
						description: 'Look up the status of a previously-sent message',
					},
					{
						name: 'Get History',
						value: 'getHistory',
						action: 'Get conversation history with a phone',
						description: 'Paginated history of messages with one phone number',
					},
				],
				default: 'send',
			},

			// ─── Message: Send ─────────────────────────────────────────────
			{
				displayName: 'To Phone',
				name: 'phone',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+15551234567',
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				description: 'Recipient phone number. Any reasonable format works — the server normalizes.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				description: 'Body text. Max 1600 chars.',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['send'] } },
				options: [
					{
						displayName: 'Device ID',
						name: 'deviceId',
						type: 'string',
						default: '',
						description: 'Send from a specific device. If omitted, the first online device is used.',
					},
					{
						displayName: 'Media URL',
						name: 'mediaUrl',
						type: 'string',
						default: '',
						description: 'Public URL to an image/video. Including this makes the message an MMS.',
					},
					{
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
						description: 'Schedule the send for a future time (ISO 8601). Leave blank to send immediately.',
					},
				],
			},

			// ─── Message: Get Status ───────────────────────────────────────
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['getStatus'] } },
				description: 'ID returned by a previous Send Message call',
			},

			// ─── Message: Get History ──────────────────────────────────────
			{
				displayName: 'Phone',
				name: 'historyPhone',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+15551234567',
				displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
				description: 'The other party in the conversation',
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
			},

			// ─── Device operations ─────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['device'] } },
				options: [
					{
						name: 'List',
						value: 'list',
						action: 'List linked devices',
						description: 'Returns every Android device linked to the account',
					},
				],
				default: 'list',
			},

			// ─── Contact operations ────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['contact'] } },
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create or upsert a contact',
						description: 'Upserts by phone — existing contacts are updated',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Phone',
				name: 'contactPhone',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
			},
			{
				displayName: 'Name',
				name: 'contactName',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
			},
			{
				displayName: 'Tags',
				name: 'contactTags',
				type: 'string',
				default: '',
				placeholder: 'lead,vip',
				description: 'Comma-separated tags to attach to this contact',
				displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
			},

			// ─── Spam operations ───────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['spam'] } },
				options: [
					{
						name: 'Flag',
						value: 'flag',
						action: 'Flag a phone as spam',
						description: 'Hides the thread; if live-mode is on, also starts the AI agent',
					},
					{
						name: 'Unflag',
						value: 'unflag',
						action: 'Unflag a phone remove from spam',
					},
				],
				default: 'flag',
			},
			{
				displayName: 'Phone',
				name: 'spamPhone',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['spam'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('androidTexterApi');
		const baseUrl = (credentials.baseUrl as string) || 'https://androidtexter.com';

		// One small helper so all four resources share the same auth + URL logic.
		// Using helpers.httpRequest (not httpRequestWithAuthentication) because
		// the credential's `authenticate` block handles header injection — we
		// just pass credentialsType to opt in.
		const call = async (
			method: IHttpRequestMethods,
			path: string,
			body?: IDataObject,
			qs?: IDataObject,
		): Promise<IDataObject> => {
			return this.helpers.httpRequestWithAuthentication.call(this, 'androidTexterApi', {
				method,
				url: `${baseUrl}${path}`,
				body,
				qs,
				json: true,
			}) as Promise<IDataObject>;
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let response: IDataObject = {};

				if (resource === 'message') {
					if (operation === 'send') {
						const phone = this.getNodeParameter('phone', i) as string;
						const message = this.getNodeParameter('message', i) as string;
						const opts = this.getNodeParameter('additionalOptions', i, {}) as {
							deviceId?: string;
							mediaUrl?: string;
							scheduledAt?: string;
						};
						const body: IDataObject = { phone, message };
						if (opts.deviceId) body.device_id = opts.deviceId;
						if (opts.mediaUrl) body.media_url = opts.mediaUrl;
						if (opts.scheduledAt) body.scheduled_at = opts.scheduledAt;
						response = await call('POST', '/api/v1/messages/send', body);
					} else if (operation === 'getStatus') {
						const id = this.getNodeParameter('messageId', i) as string;
						response = await call('GET', `/api/v1/messages/status/${encodeURIComponent(id)}`);
					} else if (operation === 'getHistory') {
						const phone = this.getNodeParameter('historyPhone', i) as string;
						const page = this.getNodeParameter('page', i) as number;
						const limit = this.getNodeParameter('limit', i) as number;
						response = await call(
							'GET',
							`/api/v1/messages/history/${encodeURIComponent(phone)}`,
							undefined,
							{ page, limit },
						);
					}
				} else if (resource === 'device' && operation === 'list') {
					response = await call('GET', '/api/v1/devices');
				} else if (resource === 'contact' && operation === 'create') {
					const phone = this.getNodeParameter('contactPhone', i) as string;
					const name = this.getNodeParameter('contactName', i, '') as string;
					const tagsRaw = this.getNodeParameter('contactTags', i, '') as string;
					const body: IDataObject = { phone, name };
					if (tagsRaw) {
						body.tags = tagsRaw
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean);
					}
					response = await call('POST', '/api/contacts', body);
				} else if (resource === 'spam') {
					const phone = this.getNodeParameter('spamPhone', i) as string;
					const path = operation === 'unflag' ? '/api/spam/unflag' : '/api/spam/flag';
					response = await call('POST', path, { phone });
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation: ${resource}.${operation}`,
						{ itemIndex: i },
					);
				}

				returnData.push({ json: response, pairedItem: { item: i } });
			} catch (error) {
				// Wrap upstream HTTP / API errors in NodeApiError so the n8n
				// UI can surface the status code, response body, and headers
				// from the Android Texter API rather than just a string
				// `.message`. NodeOperationError (the only other thing thrown
				// above — for unsupported resource/operation combos) is left
				// alone so its richer context isn't downgraded.
				if (this.continueOnFail()) {
					if (error instanceof NodeOperationError) {
						returnData.push({
							json: { error: error.message },
							pairedItem: { item: i },
						});
					} else {
						const wrapped = new NodeApiError(this.getNode(), error as JsonObject, {
							itemIndex: i,
						});
						returnData.push({
							json: { error: wrapped.message },
							pairedItem: { item: i },
						});
					}
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
