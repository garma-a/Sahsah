# COPY/PASTE PROMPT — Add Four New صح صح Question Modes

> Design clarification: the user subsequently requested preserving the original dark green and gold theme across every page. That instruction supersedes the light-only requirements in this archived ZIP prompt. Cream paper cards, dialogs and question tiles remain part of the original design.

You are working on an EXISTING Egyptian Arabic social trivia game named **صح صح**. You MUST inspect the existing codebase before writing code. Add four new question modes **without replacing or breaking the existing 36-question board, standard question mode, host-driven gameplay, QR multiplayer sync, manual timer, manual scoring, and AdminJS-like admin portal**.

I will upload the accompanying `sah_sah_modes_starter_pack.zip` with sample photos, staged images, sound clips, reversed speech demo clips, and JSON manifests. **Implement a working feature, not just static new mockups**. Reuse the existing components and backend services wherever practical. Do not re-create the site from scratch.

## A. Brand and existing gameplay constraints

- Product name: `صح صح`; Arabic-first and right-to-left (`lang="ar" dir="rtl"`).
- Light mode ONLY. Exact brand green `#0D2E1D`, brand gold `#E7A72B`. Supporting off-white/cream backgrounds and accessible contrast.
- The game uses the familiar **6 category columns × 6 tiles each = 36 question tiles**. Existing category/point labels and board functionality remain unchanged.
- Point values shown on standard board tiles: `200 / 200 / 400 / 400 / 600 / 600` per category, or the app's already-configured equivalent. New types are question records in these same board slots, **NOT new boards or mini-games with separate session engines**.
- Exactly two teams. The host operates all critical transitions. There is **no automatic winner detection for verbal guesses**.
- The host manually starts/restarts the question timer; the timer does not auto-start on question open.
- The host manually reveals the answer, awards points to either team or no one, and may correct scores manually.
- Include fullscreen where gameplay already supports it.
- No background music, timer beep, interface button sounds, or unnecessary soundtrack. **Question audio is newly required as CONTENT**, overriding the earlier no-sound rule only for audio questions.
- Very short visible Egyptian Arabic copy. Hide detailed explanations in the admin, not on the gameplay screen.
- Score-award confirmation like `✓ 400 نقطة محسومة للفراعنة` remains.
- No separate power-up system is required. **Lowering image difficulty in these two modes is an internal, host-controlled reveal step, not a reusable power-up.**

## B. Add these four exact question types

### Type 1 — `IMAGE_BLUR` / صورة مشوشة

Public question UI:
- Separate `questionText` element from separate image element. Example question text: `خمن اللي في الصورة`.
- Display the FIRST most-blurred image stage on question open.
- An opaque source asset is uploaded in admin; the system derives 3 stable blur variants from the SAME source image. Blur strength must change but the subject must never change between stages.
- Both teams may discuss/guess verbally. Only the host decides whether a team got it right.
- Host secondary button `وضح الصورة` advances ONE reveal step and **reduces available points**. Display current points prominently.
- No further help beyond the last stage. Host can tap `إظهار الإجابة` / `استسلام` at any time to end with no automatic points.
- Host can manually award the **current stage's** points to Team 1 or Team 2 after revealing the answer.
- Played tile becomes disabled and scores remain updated on the existing board.

### Type 2 — `IMAGE_ZOOM` / صورة مكبّرة

- Same flow as `IMAGE_BLUR`, but stage 1 is an extremely zoomed-in crop from the original image.
- `وسع الصورة` / `صغّر التكبير` shows a progressively wider crop from exactly the SAME source image.
- Use a configurable **focal point** `(x,y)` in 0..1 relative coordinates, because auto center crop may miss the subject.
- The 3 stage examples in the ZIP are already rendered, but the admin workflow should support uploading one source image and deriving zoom stages.
- Keep text as a separate editable field. Do not bake text into image.
- Point value drops at each zoom-out step.
- Host can give up, reveal answer, or manually award points as above.

### Type 3 — `AUDIO_GUESS` / خمن الصوت

- Question has a separate `questionText` and `audioFile`. Default text: `ده صوت إيه؟`.
- Show an accessible audio-play button, waveform/progress bar if available, AND an explicit **global/shared** counter `3 مرات متاحة`.
- **Maximum of THREE host-controlled playback starts per question/session across all devices, not three per device.** Configurable in admin, default = 3.
- Each playback must count **exactly once on accepted start**. Disable repeated clicks until playback finishes. No infinite replay via scrub/loop/seek. Handle browser playback rejection without consuming a play if playback did not start (design a reliable server acknowledgment/state transition).
- Disable Play after counter reaches 3. Do **not** auto-reveal the answer or assign points at limit. Host may manually reveal and award points or choose `ولا حد`.
- The host / designated public game screen is the playback authority; avoid dozens of guests all automatically playing the same sound on their phones. All clients see count/progress, but only host can initiate play. Specify which connected devices output question audio; use one main playback device by default to prevent echo.
- Preserve manual timer independently. Timer and sound play limit are separate features.

### Type 4 — `AUDIO_REVERSE` / الكلام بالمقلوب

- Admin uploads/records a short **forward speech clip** of someone saying a short phrase. The server generates a **reversed playback file** by reversing the actual digital audio SAMPLE ORDER. Do not merely reverse the text characters.
- Admin stores `originalSpeechFile`, `reversedSpeechFile`, transcript/answer privately, and optional content notes. Never expose the original forward file or transcript in public question data until host reveals answer.
- Public gameplay shows only reversed sound player and minimal text, e.g. `تقدر تعرف الكلام بالمقلوب؟`.
- For MVP, default three total host-triggered plays, configurable independently from the regular sound limit.
- After host reveals answer, show actual original phrase and optionally allow one unrestricted original-speech example AFTER reveal (admin preference).
- The included R01–R04 files are **synthetic technical demos using a non-native approximate Arabic voice**. They are NOT production-quality Egyptian speech. Production clips should be recorded by an actual speaker with permission; the back end should reverse those uploads automatically.

## C. Point-stage model — integrate with existing board values

- **Do not turn each reveal stage into a new question tile.** One selected 36-board tile remains ONE question throughout.
- The tile's original value is the maximum possible points.
- For a 600-point tile, recommended stages are `600 → 400 → 200`.
- For a 400-point tile, recommended stages are `400 → 250 → 150`.
- For a 200-point tile, recommended stages are `200 → 150 → 50`.
- These mappings are EXAMPLE configurable defaults, not hardcoded content business rules. Support an admin-editable stage-point schedule or a validated default calculation, and maintain monotonic decrease.
- **Do not allow points to increase by clicking backward.** Once extra help is revealed, the current lower maximum is authoritative.
- Host can assign the currently available score to Team 1 / Team 2 or zero to nobody, once. Existing manual score-correction feature remains available.
- All stages and awards synchronize through the existing host-authoritative session state and socket/broadcast service.
- A question's answer must remain server/admin-only until a reveal event is accepted.

Example state sequence:

```text
36-Board tile 600 → open IMAGE_BLUR
→ stage 1 (very blurred), available = 600
→ host 'وضح الصورة' → stage 2, available = 400
→ host 'وضح الصورة' → stage 3, available = 200
→ host 'إظهار الإجابة' → show original + answer
→ host 'الفراعنة +200' / 'الجدعان +200' / 'ولا حد'
→ board score updates, one tile disabled, toast
```

## D. Data model — implement as a backward-compatible discriminated union

Adapt names to existing code. Do not blindly overwrite existing tables. Example conceptual TypeScript:

```ts
type QuestionType =
  | 'STANDARD'
  | 'IMAGE_BLUR'
  | 'IMAGE_ZOOM'
  | 'AUDIO_GUESS'
  | 'AUDIO_REVERSE';

type QuestionCommon = {
  id: string;
  categoryId: string;
  packageId?: string;
  questionText: string;   // separate UI component; not burned into media
  answerText: string;     // PRIVATE until reveal
  basePoints: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
};

type QuestionContent =
  | (QuestionCommon & { type: 'STANDARD'; imageId?: string; answerOptions?: string[] })
  | (QuestionCommon & { type: 'IMAGE_BLUR'; originalImageId: string; stageImageIds: string[]; pointStages?: number[] })
  | (QuestionCommon & { type: 'IMAGE_ZOOM'; originalImageId: string; stageImageIds: string[]; focalX: number; focalY: number; pointStages?: number[] })
  | (QuestionCommon & { type: 'AUDIO_GUESS'; playableAudioId: string; maxPlays: number })
  | (QuestionCommon & { type: 'AUDIO_REVERSE'; forwardSpeechId: string; reversedAudioId: string; maxPlays: number });

type LiveQuestionSessionState = {
  questionId: string;
  type: QuestionType;
  stageIndex: number;     // 0-based for blur/zoom, monotonically increasing
  currentlyAvailablePoints: number;
  audioPlaysUsed: number;
  audioIsPlaying: boolean;
  timerRemainingMs: number;
  timerRunning: boolean;
  answerRevealed: boolean;
  awardedTeamId: string | null;
  pointsAwarded: number;
  finished: boolean;
  revision: number;
};
```

**SECURITY**: This is a conceptual illustration. Never serialize `QuestionCommon.answerText`, `originalImageId` (if it allows full answer-revealing image), `forwardSpeechId`, answer options' correctness flags, or private admin file URLs in public session payloads until allowed. Use separated public DTOs rather than relying on UI hiding private JSON fields.

## E. AdminJS-style admin form changes

Add `Question Type` selection to the existing Create/Edit Question form. Use conditional inputs:

**Common**:
- `نوع السؤال` (Normal / Blurry Image / Zoom Image / Guess Sound / Reverse Speech)
- `نص السؤال` (editable even when defaults are suggested)
- category / package
- point value (constrained to board configuration)
- answer text and acceptable alternatives (private)
- status Draft/Published
- preview and save

**Blur**:
- original image upload
- stage blur presets, admin preview and override
- point decrease preview at each stage
- show original only after reveal

**Zoom**:
- original image upload
- focal point picker (click on image)
- zoom levels + preview
- same point decrease preview

**Guess Sound**:
- audio upload (WAV/MP3/M4A accepted if decoder supported)
- waveform/preview in admin
- maximum play count default 3
- hidden correct answer

**Reverse Speech**:
- upload/record original speech with microphone permission, or choose file
- type correct transcript
- `توليد الصوت المعكوس` action (server-side audio transformation)
- preview forward and backward **ADMIN ONLY**
- maximum play count default 3

Validate upload MIME by content, file size, duration, and decoding ability. Sanitize text. Add progress/errors. Ensure all question types can be edited without losing their existing question record ID or board position.

## F. Server APIs / events — map onto existing system

```text
POST  /admin/questions                 create typed question
PATCH /admin/questions/:id             edit typed question
POST  /admin/questions/:id/media       upload and transcode original
POST  /admin/questions/:id/generate-stages  generate blur/zoom from source
POST  /admin/questions/:id/generate-reverse generate reversed speech

GET  /sessions/:sessionId/question/current    safe PUBLIC question DTO
POST /sessions/:sessionId/question/:id/start-timer  HOST ONLY
POST /sessions/:sessionId/question/:id/restart-timer HOST ONLY
POST /sessions/:sessionId/question/:id/advance-stage HOST ONLY
POST /sessions/:sessionId/question/:id/start-audio  HOST ONLY + atomic count
POST /sessions/:sessionId/question/:id/reveal-answer HOST ONLY
POST /sessions/:sessionId/question/:id/award HOST ONLY + idempotent
```

Use existing API route styles if available; the above are illustrative contracts.

For multiplayer:
- broadcast `questionStageChanged`, `audioPlayCountChanged`, `answerRevealed`, `pointsAwarded`, `questionCompleted`
- **atomic stage increments** / **atomic audio play increments** with optimistic `revision` or transactional compare-and-swap; duplicate rapid taps must NOT skip stages, exceed play cap, or double-credit points.
- recover synchronized state after reconnect.
- enforce actual HOST permission in backend, not only disabled frontend buttons.
- handle race between timer end, reveal, and audio playback.

## G. Media processing

- Generated media is stored by safe random IDs; do not put `correct-answer`, famous names, or transcript text into public asset filenames/URLs/metadata.
- Derive progressive image stages from one source image. Avoid saving question text on the image. Generated image should not accidentally print or visually expose answer.
- For blur, use a decreasing Gaussian sigma or reliable equivalent, with fixed dimensions.
- For zoom, crop at the stored focal point with decreasing zoom factors and resize to output dimensions. Aspect-ratio-safe, no deformations.
- Keep original high-resolution image private until answer reveal. For a hardened implementation, authorize stage/reveal URLs or return short-lived signed URLs. Do not put unreversed speech files in `/public`.
- Reverse speech offline/server-side: decode audio to PCM, reverse samples, normalize, encode MP3/WAV; do not reverse words or attempt text-to-speech every play.
- Convert unknown formats to predictable audio formats using a backend transcode step. Manage temp file cleanup, retries and content moderation.
- Each audio clue is playable from a signed/authorized file, but game rules still require host-authoritative playback counters. Browser controls alone are not secure against manual network calls. Accept that DRM-level prevention is outside MVP scope.
- Text can be an editable separate component; default concise prompts are suggestions, not mandatory fixed labels.

## H. UI screens / layouts

Re-use the existing gameplay layout:

**IMAGE_BLUR**: small header showing category + score cards, large image region, optional one-line question, `وضح الصورة` secondary CTA, current available points, `إظهار الإجابة`, manual timer, fullscreen. Do not add bulky instructions.

**IMAGE_ZOOM**: identical image-question layout; change image stage treatment and secondary CTA `وسع الصورة`.

**AUDIO_GUESS**: no fake picture. Show branded sound waveform/audio button, one-line prompt, remaining plays `2 من 3`, timer/reveal controls, host score summary. Answer private until reveal.

**AUDIO_REVERSE**: same audio layout, but indicate reverse audio mode and controls.

**ANSWER REVEAL**: existing screen: answer, full image/forward speech if appropriate, `الفراعنة +N`, `الجدعان +N`, `ولا حد` → board.

Brand requirements across all: light cream UI, exact `#0D2E1D` and `#E7A72B`, no new dark mode, responsive desktop and mobile, readable on TV/projector.

## I. Sample asset pack integration

ZIP contents:

```text
images/blur/B01...B06/stage_1.jpg ... stage_3.jpg / answer_reveal.jpg
images/zoom/Z01...Z06/stage_1.jpg ... stage_3.jpg / answer_reveal.jpg
audio/A01...A08/question.mp3 + question.wav
audio/R01...R04/question.mp3 + question.wav
admin_only/reverse_originals/R01...R04/forward_reference.wav
public_manifest.json              sample UI-only metadata (no answer strings)
admin_only/admin_manifest.json     contains answer strings; DO NOT deploy publicly
source_images_contact_sheet.jpg   content team review sheet
README.md                         asset instructions and cautions
```

- Import the `admin_manifest.json` only through a privileged seed/import script.
- For public gameplay, use safe DTOs returned by the real API (the `public_manifest.json` is demo scaffolding only).
- When the answer is revealed, the backend may authorize the `answer_reveal.jpg` or forward audio; otherwise do not expose it in a public manifest.
- Questions are independent text + media fields; nobody should have to edit a generated image to change its question wording.
- All example images are illustrative AI-generated images and should **not** be treated as documentary photographs or guaranteed historical accuracy.
- All generated sound effects are technical demo Foley synthesized locally; professionally recorded sounds will have more realism.
- R01-R04 speech demos use non-native synthetic speech; get real Egyptian Arabic recordings for the final content launch.

## J. Acceptance tests (must pass)

1. Existing STANDARD questions and all 36 board tiles still work without regression.
2. Admin can create an IMAGE_BLUR question by entering separate text, image and private answer.
3. Blur stage never changes the subject; visible points decrease at each host click; used tile occupies one board slot.
4. Admin can click focal point and create IMAGE_ZOOM stages. Zoom-out never changes underlying image.
5. `AUDIO_GUESS` can be played three times total (not per phone), and a fourth start is rejected by server.
6. Double-click/concurrent requests cannot consume multiple unexpected plays or award points twice.
7. `AUDIO_REVERSE` is reversed speech waveform, not text printed backward; original forward speech is never included in public response before reveal.
8. Host manual timer start/restart works independently of blur/zoom/audio controls.
9. Only host can advance stages/reveal/award/trigger shared audio; ordinary players cannot bypass controls by calling endpoints.
10. Refresh/rejoin displays correct synchronized stage, play count, time and score.
11. Host can choose `ولا حد` with zero points from any new mode.
12. Host manually corrects score after a mistaken award.
13. No background music, timer beeps or sound toggle was added.
14. Light mode with exact brand green/gold and short Arabic copy preserved.
15. Test portrait mobile and fullscreen large display; avoid overly tall question pages.
16. No correct answers, originals or transcripts appear in public JSON, image URLs, file metadata, alt text or media titles ahead of reveal.

## K. Implementation expectations

Proceed in phases, coding and testing each phase:

1. Audit existing architecture and how question type, 36-board, realtime state and AdminJS form currently work.
2. Implement database/types + validation + backward-compatible migrations.
3. Extend Admin create/edit forms and upload pipelines.
4. Implement `IMAGE_BLUR` and `IMAGE_ZOOM` with point stages and UI.
5. Implement `AUDIO_GUESS` with 3 global plays and UI.
6. Implement `AUDIO_REVERSE` with admin upload, server reversal, private original, public reversed audio and UI.
7. Integrate host actions, realtime updates, reconnect, score awarding and timer.
8. Seed demo questions from pack, ensure no answers leak.
9. Run meaningful tests, fix regressions, and show a working complete flow.

If environment prevents full audio backend support, clearly identify the limitation and implement the best functional safe version. Do not claim something works without testing. Do not redesign unrelated screens or remove existing game functionality.
