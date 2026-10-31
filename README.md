# @nimply/n8n-nodes-nimply

This is an n8n community node package for [Nimply](https://nimply.io), the AI social media workforce. Hire and run AI agents, build automations, create designs, and schedule, approve, publish and measure posts across Facebook, Instagram, X/Twitter, LinkedIn, TikTok, YouTube, Pinterest, and more.

It contains two nodes:

- **Nimply** — run agents and automations, create designs and brand kits, create, approve, schedule and publish posts, manage media and link pages, and read analytics.
- **Nimply Trigger** — start workflows when events happen in your Nimply workspace (post published, post failed, approval requested, new lead, ...).

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
   - Tick the scopes for what your workflows do:

     | Area | Scopes |
     | --- | --- |
     | Posts | `posts:read`; `posts:write` to create, update and approve; `posts:publish` to publish (`now`, `next_slot`, or a time) |
     | Channels, media, analytics, workspace | `channels:read`, `media:read` / `media:write`, `analytics:read`, `workspace:read` |
     | Link pages | `links:read`, `links:write` |
     | Agents | `agents:read`, `agents:write` (hire, change, remove), `agents:run` (run, cancel) |
     | Automations | `automations:read`, `automations:write` |
     | Designs and brand kits | `designs:read`, `designs:write` |
     | Trigger | `webhooks:manage` |
2. In n8n, create a new **Nimply API** credential and paste the key.
3. Leave **Base URL** at `https://api.nimply.io` unless you are testing against another environment.

The credential is verified against `GET /v1/workspace`.

## Operations

### Nimply node

| Resource | Operation | Description |
| --- | --- | --- |
| Post | Create | Create a post on one or more channels (`draft`, `next_slot`, `now`, or a specific datetime) |
| Post | Create Bulk | Create up to 50 posts in one request |
| Post | Create YouTube Video | Upload a video or Short with full YouTube options — category, visibility, license, subscriber notification, embedding, made-for-kids, AI-made content label |
| Post | Create TikTok Post | Post a video or photos with comment/Duet/Stitch settings and commercial-content disclosure, or send it to the creator's TikTok drafts |
| Post | Create Pinterest Pin | Create a pin on a specific board (picked from a live dropdown) with a destination link and alt text |
| Post | Create LinkedIn Post | Post to a profile or company page with visibility control (public or connections only) |
| Post | Request Approval | Send a draft for approval |
| Post | Approve | Approve a post waiting for approval, with an optional comment |
| Post | Reject | Send a post back with feedback |
| Post | Get | Get a single post |
| Post | Get Many | List posts, filterable by status and channel (cursor pagination handled for you) |
| Post | Update | Update the content/title of a draft or scheduled post |
| Post | Delete | Delete a draft or scheduled post |
| Post | Schedule | Set or change when a post will publish |
| Post | Unschedule | Move a scheduled post back to draft and clear its publish time |
| Post | Publish | Queue a post for immediate publishing |
| Channel | Get | Get one connected channel |
| Channel | Get Many | List connected channels |
| Channel | Get Schedule | Get a channel's posting time slots per weekday |
| Media | Upload From URL | Import a file from a public URL into workspace storage |
| Media | Upload Binary | Upload binary data from a previous node (Drive, FTP, …) via a presigned URL |
| Media | Get | Get one media asset |
| Media | Get Many | List media assets, filterable by type |
| Media | Delete | Delete a media asset that no post or design uses |
| Analytics | Get Workspace Analytics | Aggregated metrics across all channels for a date range |
| Analytics | Get Channel Analytics | Daily profile metrics for one channel |
| Analytics | Get Post Analytics | Daily metric snapshots for one post |
| Link Page | Get Many | List the workspace's nimply.link pages |
| Link Page | Get | Get a page with its blocks |
| Link Page | Add Block | Add a link button, text, section, post card, product, coupon, countdown, notice bar, FAQ or testimonial block (optionally publish right after) |
| Link Page | Update Block | Replace a block's config, switch it on/off, or set its schedule window (optionally publish right after) |
| Link Page | Delete Block | Remove a block from a page |
| Link Page | Get Analytics | Views and clicks for the last 7 days, 28 days or 12 months |
| Link Page | Publish | Publish the page draft so changes go live at nimply.link |
| Agent | Get Templates / Get Template | List the agents you can hire, and the setup fields each one asks for |
| Agent | Hire | Hire an agent from a template on your channels |
| Agent | Get / Get Many | Get your agents, filterable by status and template |
| Agent | Update | Rename, pause or resume an agent, or change its settings and channels |
| Agent | Remove | Remove an agent |
| Agent | Run | Run an agent now and (optionally) wait for the result. Uses AI credits; output lands as posts awaiting approval |
| Agent | Get Run / Get Runs / Cancel Run | Check, list or stop runs |
| Automation | Get Recipes / Get Step Types | List ready-made recipes and the triggers and actions you can use |
| Automation | Create From Recipe / Create | Create an automation as a draft, from a recipe or from a list of steps |
| Automation | Get / Get Many / Update / Delete | Manage automations |
| Automation | Test | Try an automation with sample data; nothing is posted or sent |
| Automation | Switch On / Pause / Run | Switch an automation on or off, or run it now |
| Automation | Get Run / Get Runs | See what each step did |
| Design | Create From Prompt | Design a post or carousel (up to 7 slides) from a short brief, in your brand kit's look, and (optionally) wait for it. Uses AI credits |
| Design | Create From Image | Turn an image into an editable design with separate layers. Uses AI credits |
| Design | Estimate Credits | See the most credits a run can use before starting it |
| Design | Get / Get Many / Get Job / Cancel Job / Get Sizes | Designs, job progress and the available sizes |
| Brand Kit | Get / Get Many / Create / Update | Colours, fonts, logo, voice and guidelines |
| Brand Kit | Import From Website / Import From Sources / Get Import / Save Import | Build a kit from a website, notes, a PDF brand book, a channel or images |
| Brand Kit | Add Look Examples / Learn Look / Get Look / Set Look Rules | Teach a kit your brand's look from your own images and posts |
| Workspace | Get | The workspace your API key belongs to |

#### Agents and designs run in the background

**Agent → Run**, **Design → Create From Prompt** and **Design → Create From Image** start a job that takes from a few seconds to a few minutes. With **Wait for Completion** on (the default), the node waits (up to **Max Wait**) and returns the finished run or job. Turn it off to return straight away, then check later with **Get Run** / **Get Job**.

Agents never publish on their own: what they make lands in Nimply as posts awaiting approval. Use **Post → Approve** when you are ready. Settings that skip a human check (auto-reply, agent auto-scheduling, comment-to-DM auto-send) can only be switched on in the Nimply app; the API refuses them with `SET_IN_APP`.

#### Platform-specific posting

The generic **Create** operation covers the fields every platform understands. For
platforms with their own options, use the dedicated operations instead — they expose the
full option set with dropdowns populated live from your account:

- **Create YouTube Video** — title (required), video or Short, category, visibility (public/unlisted/private), license, notify subscribers, allow embedding, made for kids, contains AI-made content.
- **Create TikTok Post** — allow comments/Duet/Stitch, branded-content and your-brand disclosure, or **Send to TikTok Drafts** to finish the post in the TikTok app (the only option for private accounts). TikTok posts publish publicly; the old privacy-level setting is no longer used.
- **Create Pinterest Pin** — board (required; picked from the channel's boards), title, description, destination link, alt text.
- **Create LinkedIn Post** — content (required), media, visibility (public or connections only).

Facebook, Instagram, X/Twitter, and Threads have no extra options — use the generic **Create** operation for those.

### Nimply Trigger node

Subscribes a Nimply webhook to your workflow and fires on the selected events:

`post.created`, `post.updated`, `post.published`, `post.failed`, `post.deleted`, `post.approval_requested`, `post.approved`, `post.rejected`, `channel.connected`, `channel.disconnected`, `lead.created`, `lead.stage_changed`

The webhook is created when the workflow is activated and removed when it is deactivated. Every delivery is verified against the `X-Nimply-Signature` header (HMAC-SHA256) using the signing secret returned at webhook creation; deliveries with a missing or invalid signature are rejected with `401`.

## Upgrading from 0.4.x or earlier

- **Create TikTok Post** no longer has the required **Privacy Level** field. TikTok ignores it now; existing workflows keep working without changes.

## Compatibility

Requires n8n 1.x and Node.js >= 18.10.

## Resources

- [Nimply API documentation](https://nimply.io/docs/api)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)

## License

[MIT](LICENSE.md)
