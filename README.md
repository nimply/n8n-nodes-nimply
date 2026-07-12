# @nimply/n8n-nodes-nimply

This is an n8n community node package for [Nimply](https://nimply.io) — schedule, publish, and measure social media content across Facebook, Instagram, X/Twitter, LinkedIn, TikTok, YouTube, Pinterest, and more.

It contains two nodes:

- **Nimply** — create, schedule, and publish posts, manage media, list channels, and read analytics.
- **Nimply Trigger** — start workflows when events happen in your Nimply workspace (post published, post failed, approval requested, channel disconnected, ...).

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation:

1. In n8n, go to **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `@nimply/n8n-nodes-nimply` and confirm.

For a self-hosted manual install:

```bash
npm install @nimply/n8n-nodes-nimply
```

## Credentials

The nodes use the **Nimply API** credential type:

1. In the Nimply app, go to **Settings → Developers** and create an API key (`nim_live_...`).
   - For creating/scheduling posts you need the `posts:write` scope; publishing (`now`, `next_slot`, or a scheduled time) additionally requires `posts:publish`. The trigger needs `webhooks:write`.
2. In n8n, create a new **Nimply API** credential and paste the key.
3. Leave **Base URL** at `https://api.nimply.io` unless you are testing against another environment.

The credential is verified against `GET /v1/workspace`.

## Operations

### Nimply node

| Resource | Operation | Description |
| --- | --- | --- |
| Post | Create | Create a post on one or more channels (`draft`, `next_slot`, `now`, or a specific datetime) |
| Post | Create Bulk | Create up to 50 posts in one request |
| Post | Get | Get a single post |
| Post | Get Many | List posts, filterable by status and channel (cursor pagination handled for you) |
| Post | Update | Update the content/title of a draft or scheduled post |
| Post | Delete | Delete a draft or scheduled post |
| Post | Schedule | Set or change when a post will publish |
| Post | Unschedule | Move a scheduled post back to draft and clear its publish time |
| Post | Publish | Queue a post for immediate publishing |
| Channel | Get Many | List connected channels |
| Channel | Get Schedule | Get a channel's posting time slots per weekday |
| Media | Upload From URL | Import a file from a public URL into workspace storage |
| Media | Upload Binary | Upload binary data from a previous node (Drive, FTP, …) via a presigned URL |
| Media | Get Many | List media assets, filterable by type |
| Analytics | Get Workspace Analytics | Aggregated metrics across all channels for a date range |
| Analytics | Get Channel Analytics | Daily profile metrics for one channel |
| Analytics | Get Post Analytics | Daily metric snapshots for one post |

### Nimply Trigger node

Subscribes a Nimply webhook to your workflow and fires on the selected events:

`post.created`, `post.updated`, `post.published`, `post.failed`, `post.deleted`, `post.approval_requested`, `post.approved`, `post.rejected`, `channel.connected`, `channel.disconnected`

The webhook is created when the workflow is activated and removed when it is deactivated. Every delivery is verified against the `X-Nimply-Signature` header (HMAC-SHA256) using the signing secret returned at webhook creation; deliveries with a missing or invalid signature are rejected with `401`.

## Compatibility

Requires n8n 1.x and Node.js >= 18.10.

## Resources

- [Nimply API documentation](https://nimply.io/docs/api)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
