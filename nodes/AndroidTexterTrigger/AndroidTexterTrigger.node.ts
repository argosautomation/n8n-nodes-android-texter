import {
	IDataObject,
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

/**
 * Polling trigger: emits one item per new inbound message since the last poll.
 *
 * Why polling (not webhooks) for v0.1.0:
 *   - Polling Just Works™ on the user's first install, no extra deploy, no
 *     n8n public URL configuration, no webhook registration round-trip with
 *     the server.
 *   - Webhooks need an `activate` lifecycle that creates a subscription on
 *     /api/v1/webhooks pointing at the workflow's webhook URL, plus signature
 *     verification. Worth doing for v0.2.0 but not on day one.
 *
 * State: we use `this.getWorkflowStaticData('node')` to remember the latest
 * `created_at` timestamp we've seen, so each poll only emits messages that
 * are strictly newer than the last batch. On first run we seed it to "now"
 *, the trigger does not back-fill history, only forward.
 */
export class AndroidTexterTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Android Texter Trigger',
		name: 'androidTexterTrigger',
		icon: { light: 'file:androidTexter.svg', dark: 'file:androidTexter.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'New SMS received',
		description: 'Starts a workflow when a new SMS arrives at your linked Android device',
		defaults: {
			name: 'Android Texter Trigger',
		},
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'androidTexterApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Filter by Phone',
				name: 'filterPhone',
				type: 'string',
				default: '',
				placeholder: '+15551234567',
				description:
					'If set, only messages from this phone trigger the workflow. Leave blank for all inbound.',
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('androidTexterApi');
		const baseUrl = (credentials.baseUrl as string) || 'https://androidtexter.com';
		const filterPhone = (this.getNodeParameter('filterPhone', '') as string).trim();

		// n8n calls poll() with mode='manual' when the user clicks "Test
		// this trigger" and mode='trigger' for the activated, scheduled run.
		// The two paths need different behavior:
		//
		//   - manual: return a sample of recent messages so the user can see
		//             the event shape on the canvas and wire downstream nodes.
		//             Do NOT seed the high-water mark, repeated tests should
		//             show the same data, and a real activation shouldn't
		//             skip messages that were shown as test samples.
		//
		//   - trigger: seed the high-water mark on first run and return null
		//             so we don't dump every old inbound into the workflow.
		//             Each subsequent poll returns strictly-newer messages.
		const isManual = this.getMode() === 'manual';

		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'androidTexterApi',
			{
				method: 'GET',
				url: `${baseUrl}/api/messages/received`,
				qs: { limit: 50 },
				json: true,
			},
		)) as { messages?: IDataObject[] };

		const messages = response?.messages ?? [];

		if (isManual) {
			// Test mode: return up to 3 most-recent messages (respecting the
			// phone filter) so the canvas can show what real events look like.
			let sample = messages;
			if (filterPhone) {
				sample = messages.filter((m) => m.phone === filterPhone);
			}
			sample = sample.slice(0, 3);
			if (sample.length === 0) return null;
			return [sample.reverse().map((json) => ({ json }))];
		}

		const staticData = this.getWorkflowStaticData('node') as { lastTs?: string };

		// First activated run, seed the high-water mark so we only emit
		// messages that arrive AFTER the trigger was turned on.
		if (!staticData.lastTs) {
			staticData.lastTs = (messages[0]?.created_at as string | undefined) ?? new Date().toISOString();
			return null;
		}

		const lastTs = staticData.lastTs;
		const fresh: IDataObject[] = [];
		for (const msg of messages) {
			const ts = msg.created_at as string | undefined;
			if (!ts) continue;
			if (ts <= lastTs) break; // ISO 8601 strings sort lexically
			if (filterPhone && msg.phone !== filterPhone) continue;
			fresh.push(msg);
		}

		if (fresh.length === 0) return null;

		// Advance the high-water mark to the newest of this batch.
		staticData.lastTs = fresh[0].created_at as string;

		// n8n expects newest-LAST in workflow execution order (so downstream
		// nodes process them chronologically).
		return [fresh.reverse().map((json) => ({ json }))];
	}
}
