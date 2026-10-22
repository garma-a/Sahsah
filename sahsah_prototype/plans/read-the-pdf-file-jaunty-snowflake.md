# Sah Sah (صح صح) — MVP Implementation Plan

## Context
The attached 49-page handoff PDF specifies a premium, Arabic-first (RTL), host-controlled Egyptian party quiz game: 2 teams, 6 categories x 6 questions = 36 tiles (200/200/400/400/600/600), manual timer/reveal/scoring, no sound, WhatsApp-OTP host auth, Fawry-only token purchases. The repo is an empty Vite + React 19 + Tailwind v4 scaffold (`src/App.tsx` is a blank div). Goal: build all 20 screen states as real, reusable React components with a local mock state machine, prioritising the playable loop (Play -> Board -> Question -> Answer -> Winner) first.

Source assets are embedded in the PDF (extract with `pdfdetach -saveall`): `IMPLEMENTATION_SPEC.md`, 5 collage JPGs (cinema, curiosity, music, tv/hero, football), 2 logo JPGs (wordmark, badge). No remote hotlinks.

## Design direction (overrides the PDF's look where they differ)
The PDF images are mood references only. Goal: a bespoke, "$5,000 studio" product, not a template. **Stance: "Midnight Broadcast"** — an Egyptian late-night TV channel reimagined as a modern, layered, glassy product. Gameplay rules from the PDF stay untouched; the visual layer is ours to elevate.

- **Canvas:** deep-forest mesh gradient (#0D2E1D / #00241A with warm gold and mint light pools) as the ground for Play, lobby and game; cream/ivory glass panels for forms and utilities. Not dotted, not flat.
- **Layered imagery:** collage art cut into large, unblurred hero subjects, with 2 background copies at 4–8% opacity and 24–44px blur for depth, feathered edges (masks, never hard cuts), subtle grain, slow single-shot parallax on the hero only (transform/opacity, disabled for reduced-motion and on game screens). Etched arch motif + gold hairlines for structure.
- **Fonts (Arabic-first, deliberately not default "AI" picks):** Lalezar for Arabic display and headlines (poster/brush weight echoing the logo), Readex Pro for UI and body (Arabic + Latin, refined and legible), Reem Kufi for scores, tile points, timer digits and codes (geometric, distinctive numerals). Rubik from the PDF is dropped as primary. All via Google Fonts `@import` in `src/index.css`; Noto Sans Arabic as fallback.
- **Hero:** full-bleed TV collage left, feathered into green; 2-line Arabic headline, one-line subcopy, one large red "العب الآن" button with a soft glow, press depth and an arrow nudge on hover. The Play button is reachable in one tap from anywhere (also pinned in header and sticky on mobile).
- **Interaction polish:** category cards tilt/lift on hover with a gold ring and animated check; 0/6→6/6 counter with a radial progress ring; Play button morphs from disabled to ready with a pulse-once; magnetic-feel buttons (transform only); tile open = shared-element-style zoom into question view; timer as a draining ring with last-5-seconds pulse; score numbers roll (tick) on change; toasts slide in with spring easing; winner screen gets a gold sweep and a single confetti burst; QR modal with soft scale-in and copy-link feedback; skeleton/blur-up image loading; focus rings in gold; custom selection colour; hidden scrollbars.
- **Simplicity for any user:** one major action per screen, zero marketing sections, large touch targets (>=48px), plain short Arabic copy, inline helper text instead of manuals, forgiving inputs (auto-format phone, 4-digit PIN auto-advance, paste support), clear empty/error states.
- **Performance guardrails:** backdrop-filter only on a few large panels, pre-blurred/pre-composited static background layers, fixed image dimensions, AVIF/WebP-sized crops via `srcset`.

## Decisions (from the PDF; assumptions flagged)
- Stack: add `react-router-dom` (routes in spec), `lucide-react` (spec: one Lucide stroke set), `qrcode.react` (QR), `motion` (springs, shared-element transitions, number tick). Fonts per Design direction above.
- State: a single in-memory store (React context + reducer, persisted to `localStorage` so refresh restores the session). Mock "realtime" = same store; guest join works in-tab / via `BroadcastChannel` across tabs. No real backend — Fawry and WhatsApp OTP are clearly-labelled demo states, never fake success.
- Assumption: only 6 categories have art (cinema, music, football, general/curiosity, ramadan, comedy). Only 5 collages exist, so reuse the TV hero crop for the 6th with a different crop/tint. Question bank: seed ~6 placeholder Arabic questions per category (editable data file), 36 per game.
- Assumption: Arabic default, with a small translation dictionary (`ar`/`en`) so English mirrors LTR; English is secondary.
- Out of scope: admin portal, sound, Google login, auto-scoring, XP/leaderboards.

## File layout
- `public/assets/` or `src/assets/` — extracted images (logo, 5 collages) + compressed crops.
- `src/index.css` — PDF section 3 tokens (`:root` vars, `.page-shell`, `.glass-surface`, `.brand-hero`, `.action--play`, reduced-motion, `softReveal`), mapped into Tailwind v4 `@theme`.
- `src/App.tsx` — router + `AppShell` (keep default export).
- `src/lib/` — `types.ts` (TeamId, Question, GameSession, ManualTimer from PDF section 10), `store.tsx` (reducer: `createRoom`, `openQuestion`, `startTimer/pauseTimer/resetTimer`, `revealAnswer`, `awardPoints(questionId, teamId|null)` idempotent + version counter, `adjustScore`, `finish`), `i18n.ts`, `categories.ts`, `questions.ts`, `bundles.ts` (configurable 100/400/1000 coins, SAH20), `phone.ts` (Egypt E.164 normalise/validate).
- `src/components/` — `AppShell`, `BackgroundAtmosphere` (aria-hidden, pointer-events none), `SiteHeader` (logo far right, 4-link nav, coin chip far left, identical on all normal routes), `RetroHero`, `CategoryCard`, `CategoryGallery`, `CategoryHelpPopover` (focus trap, Esc), `TeamSetup`, `QRInviteModal`, `Modal`, `Toast`, `Button`.
- `src/pages/` — `PlayPage`, `JoinPage`, `AuthLogin`, `AuthVerify`, `AccountPage`, `TokensPage`, `CheckoutPage`, `ContactPage`, and `game/` (`GameShell`, `QuestionBoard`, `QuestionDisplay`, `AnswerReveal`, `WinnerScreen`).

## Routes
`/play` (selecting, `?help=`, `?step=room`, `?invite=1`) · `/join/:code` · `/auth/login` · `/auth/verify` · `/account` · `/tokens` (`?tab=gift`) · `/checkout/:orderId` · `/contact` · `/game/:sessionId` · `/game/:sessionId/question/:id` (`?answer=1`) · `/game/:sessionId/results`. Game routes use fullscreen `GameShell` (no site header, fullscreen toggle, invite action).

## Milestones (PDF section 14), in build order
1. **A — Shell/brand:** tokens, fonts, header, atmosphere layers, routes skeleton, RetroHero with feathered mask, responsive breakpoints (>=1280 / 1024 / 768 / <=767).
2. **B — Playable loop (priority):** `/play` 6-of-6 selection (toggle, cap at 6, 0/6 counter, help popover) -> team names + QR/PIN lobby -> 36-tile board (6 cols, check/disabled used tiles, score strip, manual score +/-, fullscreen) -> question screen (manual timer ring, pulse last 5s, no autostart/auto-award) -> reveal + award A/B/nobody (double-tap guarded) -> board after scoring -> winner/replay (tie handled, no fake winner). Guest `/join/:code`.
3. **C — Utilities:** host login + WhatsApp OTP (demo-labelled, resend cooldown, errors), account, token bundles + promo, gift flow, Fawry checkout demo states (pending/success/fail; wallet credited only via idempotent mock "server confirmation"), contact/WhatsApp CTA.
4. **D — Polish/QA:** motion contract table (transform/opacity only, 90–650ms), `prefers-reduced-motion`, focus-visible, WCAG AA, 44px targets, `dir="ltr"` spans for numbers/codes/phones, image dimensions fixed (no CLS), `backdrop-filter` only on large light panels with opaque fallback, 390px check.

## Reuse / constraints
- No existing components to reuse (blank scaffold). Follow AGENTS.md: Tailwind utilities in JSX, global CSS only in `src/index.css`, default exports, no unlayered universal resets, double quotes for apostrophes.
- Copy Arabic labels from the PDF microcopy table (pp. 18–19) verbatim.
- Honour all guardrails (p. 20–21): no sound, exactly 36 tiles, canonical ladder only, one major action per state, no dotted backgrounds, no images inside score cells.

## Verification
- Run the dev server (already on `$PORT`) and walk the host flow end-to-end in the preview: select 6 -> room -> start -> open 200 tile -> start/reset timer -> reveal -> award team A once (second click ignored) -> tile disabled with check -> finish -> winner.
- Check the PDF's 11 acceptance tests manually (6-cap, 36 tiles with 200/200/400/400/600/600, timer idle until host starts, guest can't control, idempotent award, refresh restores state, bad PIN error, promo changes total, 390px no horizontal overflow except board, reduced-motion).
- Compare screens against PDF pp. 7, 23–42 and the Figma link for visual fidelity.
- Optional: small reducer unit tests (award idempotency, 36-tile generation, 6-category cap) if a test runner is added.

---

# Phase 2 — Challenge formats ("variety without new screens")

## Context
Visual identity is party-game, but every tile is read, discuss, reveal, award. For an hour with six friends that gets repetitive. Keep the 6-of-12 category pick and the 36-tile board; make the tile's `kind` decide what happens when it opens. No new mode-selection screens, no separate games.

## Decisions (user-confirmed unless marked assumed)
- Four kinds: `classic` (سؤال عادي), `visual` (خمن الصورة), `person` (أنا مين؟), `charades` (من غير كلام). Target mix 20/8/4/4 per game; a proposal, not a client rule.
- Charades prompt goes to a **guest phone** via the existing join link: host picks a joined guest, only that guest's tab shows the secret prompt. Works cross-tab in the demo (localStorage `storage` sync); production needs a realtime backend. The host and other guests never see the prompt text.
- Visual photos: user supplies real photos later. Build the mechanic now with the 12 category collages as placeholders (different crop/zoom per question), in a single `imageUrl` field so swapping is data-only.
- Assumed (change if wrong): mix is **fixed per category**, not shuffled: each category gets 3 classic + 1 visual + 1 person-or-charades + 1 flex so a 6-category board lands near 20/8/4/4; history/football/general stay mostly classic. Unopened tiles do not reveal their kind (surprise). Every kind keeps the 30 s manual timer and the 200/200/400/400/600/600 ladder. Content is drafted placeholder Arabic, to be fact-checked by the user.

## Data model changes (`src/lib/data.ts`)
- `Question` gains `kind: 'classic'|'visual'|'person'|'charades'` and optional `imageUrl`, `crop` (zoom, x, y), `clues: [string,string,string]`, `prompt` doubling as the charades secret. `BANK` entries become small objects instead of `[prompt, answer]` tuples; `buildQuestions` maps them. Keep exactly 6 per category.
- Helper `kindOf(q)` plus Arabic labels in one table (reuse `toAr`).

## State changes (`src/lib/store.tsx`)
- Guests need identity: add `id` to `Session.guests` entries; `joinGuest` creates it and the joining tab stores it in sessionStorage (`sahsah.v1.guest`), mirroring the existing `.host` key. `isHost` stays as is; add `guestId` to context.
- New per-question challenge state on `Session`: `reveal: { step: number }` (visual zoom level / clue count, 0..3) and `charades?: { guestId: string; shown: boolean }`. Actions: `nextReveal` (idempotent, capped), `assignActor {guestId}`, `endCharades`. All bump `version` so existing cross-tab sync carries them.
- Existing `award` idempotency and `startGame` 36-tile check unchanged. Awarding while a challenge is mid-reveal stays manual; no auto-award.
- Privacy: the charades secret lives in `session.questions` (already persisted for all tabs), so it is not truly private; UI only renders it on the chosen guest's tab. Flag this limitation in the UI copy and the plan, since real privacy needs a server.

## UI changes
- `src/pages/GamePage.tsx` `QuestionView`: switch on `q.kind`. Extract small components in `src/components/challenges.tsx`:
  - `VisualChallenge`: image with CSS `transform: scale()` + `mask`/cover grid that peels off per `reveal.step` (host button "اكشف أكتر"); full image on answer reveal.
  - `PersonChallenge`: three clue cards revealed one by one (host button "تلميح تاني"); points copy stays at the tile value.
  - `CharadesChallenge`: host picks an actor from `guests`; host screen shows "التمثيل بيجري على موبايل <name>" with timer; no prompt text. Reveal shows the prompt for scoring.
  - Classic path stays as today.
- `src/pages/JoinPage.tsx` / guest game view (`GamePage` for non-host): if `charades.guestId === guestId`, show a full-screen private card with tap-and-hold-to-reveal prompt; everyone else sees the normal spectator view.
- Board tiles: no format hint (assumed). Optional later: faint icon.
- Respect AGENTS.md: default exports for pages, double quotes for Arabic strings with apostrophes, Tailwind utilities, no unlayered resets, `prefers-reduced-motion` for the peel animation.

## Content work
- Rewrite `BANK` for all 12 categories to the new object shape with the mix above; ~72 questions, including 8 visual (collage placeholder + crop), 4 person (3 clues each), 4 charades prompts (Egyptian films/characters). Placeholder quality; user fact-checks.

## Risks / open items
- Charades privacy is demo-grade until a backend exists; guests who join after a game starts need a defined behavior (assumed: they get an id but are only selectable as actors if present before the tile opens).
- Collage placeholders make weak puzzles; real photos later.
- Solo host with no joined guests: charades tiles must degrade (assumed: host-screen tap-and-hold fallback, labelled) rather than break the 36-tile flow.

## Verification
- `tsc --noEmit` and `vite build`; screenshot board, each kind's question view, and guest charades card (vite preview on 4173, headless chromium as before).
- Manual two-tab test: tab A host starts game with a joined guest in tab B; open a charades tile, assign B; confirm only B shows the prompt, award once, second click ignored, refresh restores state.
- Check every game still has exactly 36 tiles and the 200/200/400/400/600/600 ladder.
