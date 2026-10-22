All pages retain the original dark green background, gold accents, ivory text, artwork and typography. Gameplay uses the original translucent score panels and cream question tiles. The new question modes and `/admin` editor follow the same theme; form cards and dialogs retain the original cream paper treatment. This follows the user's design clarification and supersedes the ZIP's light-only theme requirement.

The 36-question board displays two rows of three categories on desktop. Each category has a large landscape image, an enlarged title and six question tiles grouped into three pairs (200/200, 400/400, 600/600). Tablet and mobile layouts adapt to two columns and one column respectively. Eleven category headers use the user's original 1672 × 941 artwork, preserving each illustration and decorative border. The display viewport hides the outer white canvas in the Alexandria, general knowledge, street food and childhood images; the original files remain intact. Cinema retains its original matching artwork.

## Client presentation / Vercel (default)

The default build is a standalone browser simulation. It needs no API server, database service, admin password, or hosting account besides the static frontend host. Deploy to Vercel with the Vite preset, build command `npm run build` and output directory `dist`. The included `vercel.json` handles deep links. Leave `VITE_DEMO_MODE` unset or set it to `true`.

The client can choose six categories, name two teams, play all ten question formats, start/pause/reset the timer, reveal answers, award/correct points, replay, preview the admin editor and simulate login/payment. Use **جرّب الألعاب الجديدة** to preview cropped portraits, grayscale color questions, illustrated proverbs, fictional character voices and a timed memory challenge. See [the client gameplay plan](prototype-gameplay.md) for the new sample content and artwork. Included sound clues play up to three times; image stages, memory viewing state and scores persist across refresh. Admin edits and uploaded media stay in this browser (localStorage / IndexedDB). The new formats are presentation additions in the demo layer.

Tabs in the same browser can show a host/guest preview and share state. A QR link opened on another device shows a sample guest view. **This is a presentation of multiplayer, not real synchronization between devices.** Login and payments remain simulations. Sample answers/media are bundled publicly for the presentation; do not use confidential quiz content in demo mode.

The wallet uses **1 token = 1 complete game**, at **10 EGP per token**. Buy 1, 2, 5 or a custom quantity; the checkout calculates the total. Starting a new game or replay spends exactly one token. Questions, refreshes and feedback spend or award none. An empty wallet links to simulated checkout and then back to the existing lobby/results. Old prototype coin bundles are migrated to game tokens and old feedback bonuses are removed. The balance is shared across tabs in the same browser.

To test exactly the deployed prototype, use `npm run build`, `npm run preview`, then `npm run test:demo` (Chromium required). The demo browser test uses the built static site and fails if any `/api` network request is made.

## Optional Node service mode

Set `VITE_DEMO_MODE=false` when starting development or building the optional backend version. Demo content/assets are excluded from this build; browser requests go to the existing protected session API. The following notes apply to service mode.

## Running

Node 22.18+ or Node 24+ is required (native TypeScript execution). Install dependencies with `npm install`, then use `npm run dev`. Vite serves both the React app and the session API. `npm run preview` also serves the API.

For a deployed app, run `npm run build` then `npm start`. **A static-only host cannot provide the session API, media processing or multiplayer.** Deploy the Node process with a persistent disk and HTTPS. This implementation supports one server process; use a shared transactional database and event broker before running multiple replicas.

`SAHSAH_DATA_DIR` sets the private persistence directory (default `server/private`). Back it up with its `media` directory. The database has a schema version and saves atomically. Session snapshots retain their original content when admin questions change. Existing category choices, account settings, coins and orders remain in the client store. The original host tab automatically migrates a saved browser-only game into a server session: scores, played tiles, active standard question, manual timer and room code are retained. The server recreates private answers from its standard bank and issues a new host credential; imported browser answers are never trusted. A failed migration keeps a separate retry backup until connectivity returns. Previous guest tabs should rejoin with the QR code after migration.

## Admin

Open `/admin`. On a local server, create a password of at least ten characters on the first visit. For remote hosting, set `SAHSAH_ADMIN_PASSWORD` on the first startup instead. There is no default password. Password hashes stay on disk; admin login uses an HttpOnly, SameSite cookie. First setup without an environment password is restricted to loopback connections. Restarting the server signs admins out, but preserves questions and games. Never expose the private directory, server sources, starter ZIP, or seed manifests in a static asset host.

The editor supports all five question types, draft/published/archived states, six fixed board positions per category, private alternatives and notes, stage-point schedules, blur strengths, zoom factors and focal coordinates. Uploads derive stages from the same image using Sharp. Image content is decoded and validated rather than trusted by MIME. Maximum image size: 15 MB / 24 megapixels. Image metadata is stripped on encoding.

Audio uploads are decoded by the browser (WAV/MP3/M4A/WebM according to browser decoder support) and converted to PCM WAV. The backend validates the container, sample format, size, channel count and 0.2–30 second duration. Reverse speech reverses actual PCM frames on the server, preserves stereo channels, normalizes the waveform and stores the forward file privately. Microphone capture needs HTTPS or localhost. Unsupported/corrupt audio is rejected with an editor error.

## Gameplay and privacy

The board remains six columns with six tiles each (200/200/400/400/600/600). The seed contains 72 category records, including all 24 media demos in the supplied pack. Unmodified slots keep the existing standard questions; the original standard bank remains as a server-only fallback.

Sessions issue an unguessable host capability, stored per browser tab and checked on every critical mutation. One server-authoritative state controls points, image stages, playback counts and the timer. Server-sent events send snapshots on changes and reconnect; guests join by the existing four-digit QR code. Stale mutations return 409, duplicate awards are idempotent, image stages never move backward, and media/player state persists when returning to the board.

Audio plays only on the host device that first starts that question. Other clients observe the shared count and progress. Playback reserves a short lease, calls `HTMLMediaElement.play()`, and acknowledges the accepted start with an idempotent request ID. Rejected playback cancels the lease without consuming an attempt. The server limits three accepted starts by default and refuses overlapping starts. An expired playback lock recovers after a disconnected/reloaded host. Timer, reveal and scoring remain manual. Enable score editing to use ±100, or tap a team score to enter an exact corrected total (including 50/150/250-point amounts). The final audio attempt does not reveal or award anything. Repeated original-speech examples are available only after reveal when enabled in admin.

Public snapshots exclude answers, originals, transcripts, media source IDs, acceptable alternatives and host secrets before reveal. Public media routes check the session's authorized stage or revealed state. Original and forward-media routes reject requests before reveal even if their random ID is known. Audio rules are not DRM: a person able to hear/download a clue can replay a saved copy outside the game.

The included images are illustrative AI art, effects are synthesized demos, and reversed phrases use non-native synthetic speech. Replace these with reviewed content and consented Egyptian Arabic recordings before a content launch. Demo caveats appear only in admin.

## Checks

`npm run check`, `npm run test`, `npm run build`. Tests exercise real API authorization, public DTO/media privacy, the 36-tile board, concurrent requests, reveal/award ordering, shared audio limits, persistence, timer independence, image generation and PCM reversal.

Browser verification: install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. `SAHSAH_CHROMIUM_PATH` may point to an already installed Chromium executable. The browser suite uses an isolated temporary database and port 8455; it does not create an admin password or alter content in the running app. Screenshots are written to `test-results/`.
