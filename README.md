# n8n-nodes-android-texter

n8n community node for [Android Texter](https://androidtexter.com) — send and receive SMS / MMS through your own linked Android phone, without paying Twilio per-message fees.

## What it does

| Node | Operations |
|---|---|
| **Android Texter** | Send SMS/MMS · Get Message Status · Get Conversation History · List Devices · Create Contact · Flag/Unflag Spam |
| **Android Texter Trigger** | Polls every minute for new inbound SMS, starts your workflow when one arrives |

## Quick start

1. **Install the node** in n8n: Settings → Community Nodes → Install → `n8n-nodes-android-texter`
2. **Generate an API key** at [androidtexter.com/dashboard/settings/api-keys](https://androidtexter.com/dashboard/settings/api-keys) (starts with `atx_`)
3. **Create a credential** in n8n: Credentials → New → Android Texter API → paste your key
4. **Drop the node** onto your canvas — the credential test should pass green

## Use cases

- **Lead capture → SMS reply.** Webhook from your form → AT trigger fires → branch on body → reply.
- **Order confirmation.** New Shopify order → send a personalized confirmation SMS from your business phone.
- **Two-way support.** New inbound SMS → ChatGPT for a draft reply → human approves → AT sends.
- **Group blast.** Spreadsheet of phones → loop → send. (Use the HTTP Request node with `/api/messages/broadcast` if you need the bulk endpoint specifically.)

## Authentication

Bearer-style API key, sent as `X-API-Key`. No OAuth flow.

```
X-API-Key: atx_abc123...
```

The credential test hits `GET /api/me` — the cheapest authenticated round-trip — and shows the green check on success.

## Operations reference

### Message → Send

Inputs:
- **To Phone** (required) — recipient. Any format; the server normalizes (`+15551234567`, `5551234567`, `(555) 123-4567` all work).
- **Message** (required) — body, up to 1600 chars.
- **Additional Options:**
  - **Device ID** — pick a specific phone if you have multiple linked. Default: first online device.
  - **Media URL** — public HTTPS URL to an image/video. Including this makes the message an MMS.
  - **Scheduled At** — ISO 8601 datetime; queue the send for later instead of immediately.

Returns: `{ status: 200, message_id, device_id, device_name, phone_number, message }`.

### Message → Get Status

Inputs: **Message ID** (from a previous Send).

Returns: `{ id, status: "queued" | "sent" | "delivered" | "failed", phone }`.

### Message → Get History

Paginated history with one phone. Inputs: **Phone**, **Page**, **Limit** (1–100). Newest-first.

### Device → List

Lists every Android device linked to your account, including online/offline status and last-seen timestamp.

### Contact → Create

Upserts by phone (existing contacts get updated, not duplicated). Inputs: **Phone**, **Name**, **Tags** (comma-separated).

### Spam → Flag / Unflag

Flag a phone as spam. Hides the thread from the inbox and suppresses notifications. If your account has live-mode enabled, this also kicks off the AI evidence-collection agent.

## Trigger reference

**Android Texter Trigger** polls `GET /api/messages/received` once per minute (default n8n polling cadence; configurable in the workflow's "Polling Times" setting). Each new inbound message becomes one execution item.

State is per-workflow: the trigger remembers the most recent `created_at` it's seen and only emits messages newer than that, so reactivating a workflow doesn't replay history.

- **Filter by Phone** — limit triggers to a specific number. Leave blank for all inbound.

## Need an endpoint that isn't here?

Use n8n's built-in **HTTP Request** node pointed at our OpenAPI spec:

- Spec: https://androidtexter.com/api/openapi.json
- Interactive docs: https://androidtexter.com/api/swagger/index.html
- Hand-written docs: https://androidtexter.com/dashboard/docs

Auth header is the same: `X-API-Key: atx_...`.

## License

[MIT](./LICENSE) — fork it, modify it, redistribute it.

## Support

- Issues: https://github.com/argosautomation/android-texter/issues
- Web: https://androidtexter.com
