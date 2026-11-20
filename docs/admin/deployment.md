# Admin service deployment

The staff dashboard is a second Railway service built from `web_app/backend` (ADR 0021). It shares the repository and database with the gameplay API but never runs inside the API process.

## Service

- Root directory: `web_app/backend`. Config file: `railway.admin.json` (set it in the service's settings as the config-as-code path).
- Build: `pnpm install --frozen-lockfile && pnpm build:admin` compiles the code and bundles the dashboard screens once into `.adminjs/`. Start: `pnpm start:admin`. Health check: `/health` (returns 503 when the database is unreachable).
- Serverless: enable "Serverless" on the service (`sleepApplication`). The first request after idle takes a few seconds while the service wakes. Sessions live in PostgreSQL, so staff stay signed in across sleeps. The in-memory login lockout resets on sleep.
- Database: `DATABASE_URL` is the same restricted runtime role as the API. Run migrations first (`pnpm db:migrate` with `MIGRATION_DATABASE_URL`, then `pnpm db:grant-runtime`); the admin refuses to start on pending migrations. The admin pool is small (`ADMIN_DATABASE_POOL_MAX`, default 3).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime role connection string (required). |
| `ADMIN_SESSION_SECRET` | 32+ characters; signs the session cookie (required). |
| `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` | Create the first Super Admin on first boot only (password 12+ characters). Remove them from the service after the first sign-in; they are ignored once any staff account exists. |
| `TRUSTED_PROXY_HOPS` | `1` on Railway, so rate limits and cookies see the real client address. |
| `NODE_ENV` | `production`: Secure cookies, requires `DATABASE_URL`. |
| `ADMIN_DATABASE_POOL_MAX`, `ADMIN_LOGIN_ATTEMPTS_PER_MINUTE` | Optional tuning (defaults 3 and 10). |

### Media storage (content uploads)

Staff upload category covers and question files through the dashboard, which validates them and writes them to R2. Without storage configured the dashboard still edits text and says uploads are unavailable.

| Variable | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id (32 hex characters). |
| `R2_GAMEPLAY_BUCKET` | Private bucket for question media. Must be the same bucket the API reads (`R2_GAMEPLAY_BUCKET` there), because the bucket name is stored on each asset. |
| `R2_PUBLIC_BUCKET` | Bucket whose public address serves category covers. |
| `GAMEPLAY_PUBLIC_MEDIA_BASE_URL` | Public https address of that bucket, the same value the API uses to build cover URLs. |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | An API token with Object Read & Write on both buckets. This is a different, more powerful token than the API's read-only one; keep it only on this service. |
| `GAMEPLAY_LOCAL_MEDIA_DIR` | Development and tests only: store files in a directory instead of R2 (refused in production). The dashboard serves it at `/dev-media`. Use the same directory as the API's local setup to preview in the game. |

Rules the dashboard enforces on upload: the file type is read from its bytes (PNG, JPEG or WebP pictures; MP3 audio), pictures are 32 to 8192 pixels per side and at most 10 MB, audio is at most 25 MB and 10 minutes, and a category cover is a portrait 4:5 picture 400 to 2400 pixels wide and at most 5 MB. Sahsah does not resize, recode or otherwise process files: staff upload the finished file. Every upload gets a new random object key (`content/<id>.<ext>` private, `covers/<id>.<ext>` public) and never replaces an existing object. Only the key and the measured metadata go in `media_assets`. A file whose save fails or is abandoned stays in the bucket unreferenced; cleaning up unreferenced objects is a later maintenance task.

## Support replies (email)

Messages sent from the contact form appear under Messages. Staff reply from the dashboard; the email goes out through Resend's HTTPS API (Railway Hobby blocks SMTP, so there is no SMTP setting). Each reply is stored against the message with its outcome (`sending`, `sent`, `failed` or `external`) and an audit event; the player's answer arrives in the support mailbox, not in the dashboard.

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend API key with "Sending access". Empty: email sending is off. |
| `SUPPORT_FROM_EMAIL` | Sender, for example `Sahsah Support <support@your-domain>`. Required when the key is set; the service refuses to start without it. |
| `SUPPORT_REPLY_TO` | Optional address players' answers go to; defaults to the sender. |

Without `RESEND_API_KEY` the message page says plainly that email sending is not configured, offers "Reply in your email app" (a `mailto:` with the address, subject and the original quoted) and "Mark replied", which records the answer with status `external`. Nothing is sent from the service in that mode.

Setting up Resend (free tier, 100 emails a day and 3,000 a month at the time of writing):

1. Create a Resend account, then Domains, Add domain: enter the domain that will send the mail (a subdomain such as `mail.your-domain` keeps it apart from your normal mailbox).
2. In Cloudflare DNS for that domain, add the records Resend shows (SPF and DKIM `TXT`/`MX` records; set them to "DNS only", not proxied), then press Verify in Resend. Verification usually takes minutes.
3. Create an API key (Sending access, limited to that domain), put it in `RESEND_API_KEY` with `SUPPORT_FROM_EMAIL` on the admin service, and redeploy.

If a send fails the reply is kept as failed with a plain reason (key or domain refused, address rejected, service unreachable, timed out) and staff can send it again. A request repeated with the same request key never sends twice: the provider also receives an `Idempotency-Key` derived from it. A timeout is reported as "may or may not have been delivered"; check the Resend log before sending that reply again. Email addresses and message text are never written to service logs.

## Public site

Public site has three tabs. Announcements are dated messages the website shows to everyone (not push notifications): title and message in Arabic (Franco optional), an optional link (an https address or a path such as `/faq`), a start, an optional end and an on/off switch. An announcement that was ever shown cannot be deleted, only deactivated. Pages edits About, Privacy, Terms and FAQ (question and answer items); a page is hidden from the website until it is published, and text pages are plain text (blank line = paragraph, `## ` heading, `- ` list item), never HTML. Site settings holds the logo (public bucket, PNG/JPEG/WebP up to 2 MB) and the support phone, WhatsApp, email and social addresses shown in the footer.

| Variable | Service | Purpose |
| --- | --- | --- |
| `CLOUDFLARE_ANALYTICS_URL` | admin | Optional https link to the Cloudflare Web Analytics dashboard, shown on the Public site page. |
| `GAMEPLAY_CONTACT_PER_HOUR` | API | Contact form submissions per client per hour (default 5, also the burst). |
| `NEXT_PUBLIC_CF_ANALYTICS_TOKEN` | frontend | Cloudflare Web Analytics beacon token. The beacon script is added only when it is set. |

The API keeps live announcements and site settings in process for 30 to 60 seconds, so a change can take that long to reach the website.

## Content

Content (sections, categories, packs, questions) is under Content for every staff role. Publishing a pack checks the same rules the game start checks, so a published pack always starts. Editing a published pack asks for confirmation, is validated as a whole and saves atomically; each save raises the pack's revision so a lobby that already picked it asks the host to confirm again. Games that are already running keep the copy they started with.

## Staff accounts

Sign in at `/admin`. A Super Admin adds staff, deactivates or reactivates them, changes roles and resets passwords under Staff & audit. A temporary password is shown once on screen; share it privately. There is no email-based password recovery: a Super Admin resets it. The last active Super Admin cannot be demoted or deactivated, and nobody can deactivate or re-role themselves. Every change appears in the audit log.
