# صح صح — client gameplay prototype

Open `/play`, choose **جرّب الألعاب الجديدة**, name the two teams and start. Each new game costs **1 token**. If your balance is empty, **اشتري توكن وابدأ** takes you through simulated payment and returns you to the same lobby. The preset contains the five new categories plus general knowledge. The regular category chooser can mix all 17 categories.

## Tokens and payments

One token equals one complete game and costs **10 EGP**. The shop offers 1, 2 and 5 tokens plus a custom whole-number quantity. Discounts affect the payment price; the number of game tokens stays the selected quantity. The header, account, lobby, checkout and results all show the number of available games.

Only a successful game start or replay spends one token. Lobby creation, questions, refreshes and continuing the same game spend none. Feedback stores a like/dislike and displays a thank-you; it gives no tokens or prizes. Simulated payment credits the exact quantity once, including after refresh. Gifts are recorded for the recipient and do not add to the sender's balance. Existing prototype bundle balances are converted to small game-token counts, and old feedback rewards are removed. Tabs in the same browser share the presentation wallet.

This is a frontend presentation: sample questions, local browser state and simulated room behavior. New modes are implemented in the demo layer; no new backend, accounts, external speech service or multiplayer service was added.

## Gameplay decisions

| Category          | Before reveal                                                 | On reveal                              |
| ----------------- | ------------------------------------------------------------- | -------------------------------------- |
| مين في الصورة؟    | Only a strip of the portrait is visible                       | Full portrait and the person's name    |
| اللون الأصلي إيه؟  | Grayscale artwork; prompt identifies the item to guess        | Original colors, color name and swatch |
| الصورة بتقول إيه؟ | One illustrated Egyptian proverb                              | Complete proverb                       |
| مين صاحب الصوت؟   | Three accepted audio plays, shared across the round           | Fictional demo character's name        |
| ركز معايا         | Start viewing → countdown → hide image → show detail question | Image returns beside the answer        |

Each new category has six board slots: 200, 200, 400, 400, 600, 600 points. Memory viewing lasts 10, 7 or 5 seconds respectively. Its 30-second answering timer and answer reveal become available after the scene disappears. The host can hide it early or start a fresh viewing attempt for the presentation.

All rounds support answer reveal, team scoring or no winner, manual score correction, returning to the board, results and replay. Viewing progress, hidden memory state, audio play count and scores survive refresh in the same browser. Replay resets them.

## Content and artwork

`src/demo/party-modes.ts` contains all 30 new question/answer entries and asset references. Person questions use six distinct portraits; picture riddles use six distinct illustrations. The color and memory categories intentionally share two scenes to demonstrate different questions about an image. Voice slots use three fictional character samples, repeated at different point levels.

15 final images are saved under `public/game-modes/` as optimized WebP files. They were generated using the built-in image tool, referencing the existing `src/assets/img/cinema.webp` and `src/assets/img/football.webp`. The selected style follows those references: Egyptian vintage print, forest green, ochre gold, warm cream, red accents, halftone shading and distressed paper. Early smooth-rendered drafts were discarded and are not referenced by the app. The complete final prompt set is recorded in `game-art-prompts.json`.

The bundled audio samples are synthetic presentation voices for **المذيع، الكابتن، الحكّاء**, not celebrity recordings. Sample files live in `src/demo/assets/voices/` and reuse short synthetic phrases already included in the prototype.

Reference for format comparisons: [SeenJeem's official category list](https://seenjeemsa.com/start-game/).

## Client review

Decisions to collect during the presentation: category wording, visual style, viewing durations, point values, whether memory replays are allowed, and final question/voice content. Those settings and sample entries are easy to change without adding real services.

Validation: `npm run check`, `npm run build`, `npm run test:demo`. The browser suite covers the existing gameplay and all 36 slots in the new preset, image/color reveal, memory expiration/refresh/reset, three audio plays and rejected playback, scoring/results/replay, mobile layouts and zero `/api` network requests.
