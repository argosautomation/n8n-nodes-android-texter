# n8n-nodes-android-texter

n8n community node for [Android Texter](https://androidtexter.com): send and receive SMS and MMS through your own Android phone and number. No Twilio account, no 10DLC registration, no per-message fees.

## What it does

| Node | Operations |
|---|---|
| **Android Texter** | Send SMS/MMS, Send Broadcast, Get Message Status, Get Conversation History, Search Messages, List Conversations, List or Cancel Scheduled Messages, Create or Update Contact, List Contacts, List Devices, Flag or Unflag Spam |
| **Android Texter Trigger** | Polls for new incoming texts and starts your workflow when one arrives |

The Android Texter node can also be used as a tool by n8n's AI Agent.

## Quick start

1. **Install the node** in n8n: Settings, Community Nodes, Install, then enter `n8n-nodes-android-texter`.
2. **Pair a phone** and **create an API key** at [androidtexter.com/dashboard/settings/api-keys](https://androidtexter.com/dashboard/settings/api-keys). Keys start with `atx_`.
3. **Create a credential** in n8n: Credentials, New, Android Texter API, then paste your key. The credential test checks it.
4. **Add the node** to your workflow.

## Use cases

- **Lead capture to text reply.** A form submission arrives, the node texts the lead from your business number.
- **Order confirmations.** A new order triggers a personalized text from your phone.
- **Two-way support.** A new incoming text starts the Trigger, an AI step drafts a reply, a person approves, the node sends it.
- **Reminders to a group.** Send Broadcast texts a list of numbers, each as its own message, with `{{first_name}}` filled in per contact.

## Authentication

An API key sent as the `X-API-Key` header. No OAuth. The credential test calls `GET /api/me`.

## Operations

### Message

- **Send.** To Phone (separate several numbers with commas for one group text), Message (up to 1600 characters). Options: Device ID, Media URL (makes it an MMS), Scheduled At, SIM Slot (dual-SIM phones). Returns the queued message, including `message_id`.
- **Send Broadcast.** Phones (commas or new lines, up to 500) and Message. Each recipient gets a separate text. Options: Device ID (send all from one phone), Media URL.
- **Get Status.** Message ID from a previous Send. Status is `queued`, `sent`, `failed` or `cancelled`.
- **Get History.** One conversation, newest first: Phone, Page, Limit. For a group text, add the Thread Ref from List Conversations.
- **Search.** Sent and received texts containing a word or phrase. Return All, or set a Limit. One item per message.

### Conversation

- **List.** Most recent first, up to Limit. Optional Folder filter: All (the default, everything except archived and spam), Inbox, Outbox, Archived, Spam. One item per conversation.

### Scheduled Message

- **List.** Texts waiting to be sent. One item per message.
- **Cancel.** Stop a scheduled text by its message ID.

### Contact

- **Create or Update.** Matched by phone. Fields you leave empty are kept, and tags are added rather than replaced.
- **List.** Return All, or set a Limit. Optional search (name, phone, email, company) and tag filter. One item per contact.

### Device

- **List.** Your paired phones with online status and last check-in.

### Spam

- **Flag / Unflag.** Moves a conversation to Spam and mutes it, or brings it back.

## Trigger

**Android Texter Trigger** polls `GET /api/messages/received` on n8n's polling schedule (set it under Poll Times). Each new incoming text is one item. It remembers the newest message it has seen, so turning a workflow off and on does not replay old texts. **Filter by Phone** limits it to one sender.

## Anything else

Every API endpoint is documented at [androidtexter.com/docs](https://androidtexter.com/docs), with the OpenAPI spec at `https://androidtexter.com/api/openapi.json`. Use n8n's HTTP Request node with the same `X-API-Key` header for anything this node does not cover.

## Changelog

- **0.2.1.** Contact List and Search can return every result (Return All) instead of stopping at the first page; Conversation List's Folder moved under Filters.
- **0.2.0.** Send Broadcast, Search, List Conversations, Scheduled Messages, List Contacts, SIM slot and group thread support; usable as an AI Agent tool; meets n8n's current community-node checks. Existing operations are unchanged.
- **0.1.4.** API errors shown through n8n's error display.

## License

[MIT](./LICENSE)

## Support

- Issues: https://github.com/argosautomation/n8n-nodes-android-texter/issues
- Email: support@androidtexter.com
- Web: https://androidtexter.com
