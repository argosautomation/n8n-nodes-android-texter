import {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

/**
 * Single-node action surface for Android Texter, organized by resource +
 * operation (the convention n8n's own first-party nodes use, which keeps the
 * canvas clean instead of one tile per endpoint).
 *
 *   - Message       Send | Send Broadcast | Get Status | Get History | Search
 *   - Conversation  List
 *   - Scheduled     List | Cancel
 *   - Contact       Create or Update | List
 *   - Device        List
 *   - Spam          Flag | Unflag
 *
 * The operations from v0.1 (Send, Get Status, Get History, Device List,
 * Contact Create, Spam) keep their paths and their output shape, one item
 * holding the whole response, so existing workflows behave the same. The
 * list operations added in v0.2 return one item per record, the n8n
 * convention, so they feed a Loop or a Split Out without extra steps.
 *
 * Request shapes match the official SDKs (github.com/argosautomation/
 * androidtexter-sdk), which were checked against the server's handlers.
 */
export class AndroidTexter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Android Texter',
		name: 'androidTexter',
		icon: { light: 'file:androidTexter.svg', dark: 'file:androidTexter.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send and read SMS and MMS through your own Android phone with Android Texter',
		defaults: {
			name: 'Android Texter',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
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
					{ name: 'Contact', value: 'contact' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Device', value: 'device' },
					{ name: 'Message', value: 'message' },
					{ name: 'Scheduled Message', value: 'scheduled' },
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
						name: 'Get History',
						value: 'getHistory',
						action: 'Get conversation history with a phone',
						description: 'Paginated history of one conversation, newest first',
					},
					{
						name: 'Get Status',
						value: 'getStatus',
						action: 'Get message delivery status',
						description: 'Look up the status of a previously sent message',
					},
					{
						name: 'Search',
						value: 'search',
						action: 'Search messages',
						description: 'Find sent and received texts containing a word or phrase',
					},
					{
						name: 'Send',
						value: 'send',
						action: 'Send an SMS or MMS',
						description: 'Send a text from your phone, now or scheduled',
					},
					{
						name: 'Send Broadcast',
						value: 'sendBroadcast',
						action: 'Send the same text to many numbers',
						description: 'One separate text per recipient, up to 500',
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
				description:
					'Recipient phone number. Any common format works. Separate several numbers with commas to send one group text.',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['send', 'sendBroadcast'] } },
				description: 'Body text, up to 1600 characters',
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
						description: 'Send from a specific phone. If omitted, an online phone is used.',
					},
					{
						displayName: 'Media URL',
						name: 'mediaUrl',
						type: 'string',
						default: '',
						description: 'Public URL of an image or video. Including this makes the message an MMS.',
					},
					{
						displayName: 'Scheduled At',
						name: 'scheduledAt',
						type: 'dateTime',
						default: '',
						description: 'Send at this future time instead of now',
					},
					{
						displayName: 'SIM Slot',
						name: 'simSlot',
						type: 'number',
						default: 0,
						description: 'On a dual-SIM phone, the SIM to send from (0 or 1)',
					},
				],
			},

			// ─── Message: Send Broadcast ───────────────────────────────────
			{
				displayName: 'Phones',
				name: 'broadcastPhones',
				type: 'string',
				default: '',
				required: true,
				placeholder: '+15551234567, +15557654321',
				displayOptions: { show: { resource: ['message'], operation: ['sendBroadcast'] } },
				description:
					'Recipients separated by commas or new lines, up to 500. Each gets their own text, not a group message. {{first_name}} and other contact fields are filled in per recipient.',
			},
			{
				displayName: 'Broadcast Options',
				name: 'broadcastOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['sendBroadcast'] } },
				options: [
					{
						displayName: 'Device ID',
						name: 'deviceId',
						type: 'string',
						default: '',
						description: 'Send every text from this phone instead of spreading them across your phones',
					},
					{
						displayName: 'Media URL',
						name: 'mediaUrl',
						type: 'string',
						default: '',
						description: 'Public URL of an image to send with each text',
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
				description: 'ID returned by a previous Send operation',
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
			{
				displayName: 'Thread',
				name: 'historyThread',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { resource: ['message'], operation: ['getHistory'] } },
				options: [
					{
						displayName: 'Thread Ref',
						name: 'threadRef',
						type: 'string',
						default: '',
						description: 'The conversation ID from List Conversations. Use it to read a group text.',
					},
				],
			},

			// ─── Message: Search ───────────────────────────────────────────
			{
				displayName: 'Search For',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['message'], operation: ['search'] } },
			},
			{
				displayName: 'Return All',
				name: 'searchReturnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['message'], operation: ['search'] } },
			},
			{
				displayName: 'Limit',
				name: 'searchLimit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: { resource: ['message'], operation: ['search'], searchReturnAll: [false] },
				},
			},

			// ─── Conversation operations ───────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['conversation'] } },
				options: [
					{
						name: 'List',
						value: 'list',
						action: 'List conversations',
						description: 'Conversations with the most recent activity first',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Limit',
				name: 'conversationLimit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { minValue: 1, maxValue: 2000 },
				displayOptions: { show: { resource: ['conversation'], operation: ['list'] } },
			},
			{
				displayName: 'Filters',
				name: 'conversationFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['conversation'], operation: ['list'] } },
				options: [
					{
						displayName: 'Folder',
						name: 'view',
						type: 'options',
						options: [
							{ name: 'All', value: 'all', description: 'Everything except archived and spam' },
							{ name: 'Archived', value: 'archived' },
							{ name: 'Inbox', value: 'inbox', description: 'Conversations where someone has written back' },
							{ name: 'Outbox', value: 'outbox', description: 'Sends nobody has answered yet' },
							{ name: 'Spam', value: 'spam' },
						],
						default: 'all',
					},
				],
			},

			// ─── Scheduled message operations ──────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['scheduled'] } },
				options: [
					{
						name: 'Cancel',
						value: 'cancel',
						action: 'Cancel a scheduled message',
						description: 'Stop a scheduled text before it is sent',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List scheduled messages',
						description: 'Texts waiting to be sent, soonest first',
					},
				],
				default: 'list',
			},
			{
				displayName: 'Message ID',
				name: 'scheduledId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['scheduled'], operation: ['cancel'] } },
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
						description: 'Returns every Android phone linked to the account',
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
						name: 'Create or Update',
						value: 'create',
						action: 'Create or update a contact',
						description: 'Matched by phone. Fields you leave empty are kept; tags are added.',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List contacts',
						description: 'Search contacts, or list those with a tag',
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
				description: 'Comma-separated tags to add to this contact',
				displayOptions: { show: { resource: ['contact'], operation: ['create'] } },
			},
			{
				displayName: 'Return All',
				name: 'contactReturnAll',
				type: 'boolean',
				default: false,
				description: 'Whether to return all results or only up to a given limit',
				displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
			},
			{
				displayName: 'Limit',
				name: 'contactLimit',
				type: 'number',
				description: 'Max number of results to return',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: {
					show: { resource: ['contact'], operation: ['list'], contactReturnAll: [false] },
				},
			},
			{
				displayName: 'Filters',
				name: 'contactFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: { show: { resource: ['contact'], operation: ['list'] } },
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Matches name, phone, email or company',
					},
					{
						displayName: 'Tag',
						name: 'tag',
						type: 'string',
						default: '',
						description: 'Only contacts that have this tag',
					},
				],
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
						description: 'Moves the conversation to Spam and mutes it',
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

		// One helper so every resource shares the same auth + URL logic. The
		// credential's `authenticate` block injects the X-API-Key header.
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

		// List operations added in v0.2 emit one item per record.
		const pushAll = (records: unknown, i: number) => {
			for (const r of (Array.isArray(records) ? records : []) as IDataObject[]) {
				returnData.push({ json: r, pairedItem: { item: i } });
			}
		};

		// Pages through a `page`/`limit` endpoint (which answers with `total`)
		// until `max` records are pushed or the API runs out. The API caps a
		// page at 100, so larger limits always need more than one request.
		const pageAll = async (path: string, qs: IDataObject, key: string, max: number, i: number) => {
			const pageSize = 100;
			let fetched = 0;
			for (let page = 1; fetched < max; page++) {
				const want = Math.min(pageSize, max - fetched);
				// Keep the page size fixed so offsets line up; trim the last page instead.
				const res = await call('GET', path, undefined, { ...qs, page, limit: pageSize });
				const batch = (Array.isArray(res[key]) ? res[key] : []) as IDataObject[];
				pushAll(batch.slice(0, want), i);
				fetched += Math.min(batch.length, want);
				if (batch.length < pageSize || page * pageSize >= Number(res.total ?? 0)) break;
			}
		};

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let response: IDataObject | undefined;

				if (resource === 'message') {
					if (operation === 'send') {
						const phone = this.getNodeParameter('phone', i) as string;
						const message = this.getNodeParameter('message', i) as string;
						const opts = this.getNodeParameter('additionalOptions', i, {}) as {
							deviceId?: string;
							mediaUrl?: string;
							scheduledAt?: string;
							simSlot?: number;
						};
						const body: IDataObject = { phone, message };
						if (opts.deviceId) body.device_id = opts.deviceId;
						if (opts.mediaUrl) body.media_url = opts.mediaUrl;
						if (opts.scheduledAt) body.scheduled_at = opts.scheduledAt;
						if (opts.simSlot !== undefined) body.sim_slot = opts.simSlot;
						response = await call('POST', '/api/v1/messages/send', body);
					} else if (operation === 'sendBroadcast') {
						const phones = (this.getNodeParameter('broadcastPhones', i) as string)
							.split(/[\n,]/)
							.map((s) => s.trim())
							.filter(Boolean);
						const message = this.getNodeParameter('message', i) as string;
						const opts = this.getNodeParameter('broadcastOptions', i, {}) as {
							deviceId?: string;
							mediaUrl?: string;
						};
						const body: IDataObject = { phones, message };
						// The server ignores device_id unless device_mode is
						// "specific", so a chosen phone needs both.
						if (opts.deviceId) {
							body.device_id = opts.deviceId;
							body.device_mode = 'specific';
						}
						if (opts.mediaUrl) body.media_url = opts.mediaUrl;
						response = await call('POST', '/api/messages/broadcast', body);
					} else if (operation === 'getStatus') {
						const id = this.getNodeParameter('messageId', i) as string;
						response = await call('GET', `/api/v1/messages/status/${encodeURIComponent(id)}`);
					} else if (operation === 'getHistory') {
						const phone = this.getNodeParameter('historyPhone', i) as string;
						const page = this.getNodeParameter('page', i) as number;
						const limit = this.getNodeParameter('limit', i) as number;
						const thread = this.getNodeParameter('historyThread', i, {}) as { threadRef?: string };
						const qs: IDataObject = { page, limit };
						if (thread.threadRef) qs.thread_ref = thread.threadRef;
						response = await call(
							'GET',
							`/api/v1/messages/history/${encodeURIComponent(phone)}`,
							undefined,
							qs,
						);
					} else if (operation === 'search') {
						const q = this.getNodeParameter('query', i) as string;
						const returnAll = this.getNodeParameter('searchReturnAll', i) as boolean;
						const limit = returnAll ? Infinity : (this.getNodeParameter('searchLimit', i) as number);
						await pageAll('/api/messages/search', { q }, 'messages', limit, i);
						continue;
					}
				} else if (resource === 'conversation' && operation === 'list') {
					const filters = this.getNodeParameter('conversationFilters', i, {}) as { view?: string };
					const view = filters.view || 'all';
					const limit = this.getNodeParameter('conversationLimit', i) as number;
					const res = await call('GET', '/api/messages/conversations', undefined, { view, limit });
					pushAll(res.conversations, i);
					continue;
				} else if (resource === 'scheduled') {
					if (operation === 'list') {
						const res = await call('GET', '/api/messages/scheduled');
						pushAll(res.scheduled_messages, i);
						continue;
					}
					if (operation === 'cancel') {
						const id = this.getNodeParameter('scheduledId', i) as string;
						response = await call('DELETE', `/api/messages/scheduled/${encodeURIComponent(id)}`);
					}
				} else if (resource === 'device' && operation === 'list') {
					response = await call('GET', '/api/v1/devices');
				} else if (resource === 'contact') {
					if (operation === 'create') {
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
					} else if (operation === 'list') {
						const f = this.getNodeParameter('contactFilters', i, {}) as { search?: string; tag?: string };
						const returnAll = this.getNodeParameter('contactReturnAll', i) as boolean;
						const qs: IDataObject = {};
						if (f.search) qs.search = f.search;
						if (f.tag) qs.tag = f.tag;
						const limit = returnAll ? Infinity : (this.getNodeParameter('contactLimit', i) as number);
						await pageAll('/api/contacts', qs, 'contacts', limit, i);
						continue;
					}
				} else if (resource === 'spam') {
					const phone = this.getNodeParameter('spamPhone', i) as string;
					const path = operation === 'unflag' ? '/api/spam/unflag' : '/api/spam/flag';
					response = await call('POST', path, { phone });
				}

				if (response === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation: ${resource}.${operation}`,
						{ itemIndex: i },
					);
				}
				returnData.push({ json: response, pairedItem: { item: i } });
			} catch (error) {
				// A NodeOperationError (an unsupported resource/operation combo)
				// keeps its own message; anything else is an HTTP or API error,
				// wrapped in NodeApiError so the n8n UI shows the status code
				// and the server's error body.
				const wrapped =
					error instanceof NodeOperationError
						? new NodeOperationError(this.getNode(), error.message, { itemIndex: i })
						: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
				if (this.continueOnFail()) {
					returnData.push({ json: { error: wrapped.message }, pairedItem: { item: i } });
					continue;
				}
				throw wrapped;
			}
		}

		return [returnData];
	}
}
