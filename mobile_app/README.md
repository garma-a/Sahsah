# Sahsah mobile app

Flutter application for **iOS and Android**. It copies the design of the web prototype (`../sahsah_prototype`) and talks to the same NestJS backend as the web app (`../web_app/backend`) over HTTP.

## What it does today

A mobile game lobby laid out as a phone game, first built from the prototype (`../sahsah_prototype`, live at [sahsah.vercel.app](https://sahsah.vercel.app)). It now takes its look from the website in `../web_app/frontend`: the same colours (charcoal and cream paper, an orange-red main button with a cyan ring, cyan and yellow teams), the same fonts, and cards with chunky ink outlines and solid offset shadows. Screens and button positions stay the app's own. The research, audit and reasoning are in [docs/mobile-game-design.md](docs/mobile-game-design.md).

- **Landscape only, full screen:** the whole app plays sideways like a game on the table (`lib/core/ui/orientation.dart`, plus `sensorLandscape` in the Android manifest and landscape-only orientations in the iOS `Info.plist`). The system bars are hidden; a swipe brings them back.
- **Backgrounds:** every screen stands in front of the website's cinema lobby wall of faded film posters (`assets/cinema/wall-posters.webp`, from `web_app/frontend/public/cinema`), dimmer behind games. Menu pages (categories, shop, more, account, contact) sit on a sheet of cream paper pinned to the wall; the board, packs, questions and results are played on a slim retro TV with a teal-trimmed, faintly scanlined screen (`lib/core/ui/brand_background.dart`).
- **Text follows its surface:** text without its own colour is cream on dark and ink on paper (`AppText` reads the surrounding `DefaultTextStyle`; `context.mutedText` and `context.accentText` give the matching secondary and accent colours).
- **Scores in a game:** cream cards with an ink edge, the team name on a ribbon of its colour and a big ink score; the leader gets a crown and a deeper drop.
- **Game top bar:** the website's red header bar with an ink outline. Logo (the client's retro mark, `assets/logo/logo-retro.svg`; its top layer is split into an outline and a fill, because Flutter's SVG renderer ignores `paint-order`) and a guest badge in the lobby (a back button and the screen title elsewhere), the wallet (it reads **اللعب مجاني**, play is free, while the shop is closed; the "+" to buy more shows only when there is a balance) and the language switch on the other side (`lib/features/shell/hud.dart`).
- **Lobby (one screen, no scrolling):** three calm menu tiles (categories, shop, more) at the start, a banner space in the middle, and the big red **ابدأ لعبة** button with **ادخل بكود** under it at the end. An unfinished game shows a "continue" tile above the play button (`lib/features/home/lobby.dart`). With a game in progress the big button becomes **كمّلوا لعبتكم** (continue) with both scores on it, and a smaller **لعبة جديدة** (new game) sits under it. Gifts have no tile: they are bought on the website, and the shop keeps its gift tab for now.
- **Banners and the launch pop-up** (`lib/data/promos.dart`, `lib/features/home/promo_banner.dart`): the lobby's centre is a carousel of ad banners on the paper sheet, turning every six seconds (not with animations off) and swipeable (it holds still with animations off or a screen reader on): the new challenges (their posters fanned out), 20% off all gifts (a red ticket on yellow paper, to the shop's gift tab), free play while the shop is closed, and how to play. Each has one button that acts on it. When the app opens, the new-challenges banner pops up once over the lobby. The backend has no announcements yet, so the promos live in the app and say only what is true in it; the gift discount is the website ticker's "خصم ٢٠٪ على كل الهدايا".
- **Chunky buttons:** as on the website, buttons are flat faces with an ink outline standing on a lip they sink onto when pressed, with haptics. The main button is orange-red with a cyan ring (`lib/core/ui/play_button.dart`); the others are yellow, cream or dark with a cyan ring (`lib/core/ui/game_button.dart`).
- **Cards:** dark cards have the website's TV-cabinet look (charcoal, ink outline, ink drop); the lobby's stage is a sheet of grained cream paper with a cyan offset shadow; a question sits on a TV screen with an ink, teal and ink trim (`lib/core/ui/surfaces.dart`). The paper grain is a small tile from `tool/make_grain.py`.
- **Category posters** (`lib/core/ui/category_cover.dart`), after the website's covers: the photo as a film still (darkened foot, vignette, grain, a warm cast) with the name hand-lettered in Rakkas and an offset shadow in the tone's second ink, in a frame of the tone's colour. Narrow covers (under 110 px, like the lobby's) put the name on a yellow-on-ink slab at the top instead. On the shelf a yellow **؟** sticker sits on each poster's corner; in setup a picked poster lifts, tilts, casts an ink shadow and its sticker turns green with its place in the pick, and coming-soon ones are greyed under a **قريبًا** stamp. The website's "صحصح تقدّم" billing line is left out.
- **Categories:** section tabs over a sideways row of large posters; tapping one opens its details sheet.
- **Join sheet:** six-digit code entry with a QR button. Joining a room from a guest's phone comes next, so for now it shows a notice.
- **More:** sign-in entry, language switch, contact/feedback/business, mission and vision, socials, in two columns.
- **Portrait fallback:** if a tablet ignores the lock, the app falls back to a scrolling page with a bottom tab bar.
- **Sound:** a tick for each of the last ten seconds, a time-up sound, a chime when a team takes the points, a soft note for nobody and a fanfare on the results screen (`lib/core/audio/`). The files in `assets/sfx/` are synthesized placeholders from `tool/make_sfx.py`; a recording with the same name replaces one. Sounds can be turned off under More.
- **Readability rules:** no text is smaller than 12 px (`test/text_size_test.dart` enforces it). The teams are cyan and yellow everywhere, as on the website, so red only means the main button and the clock's alarm. An Arabic zero is a small dot, so a lone zero is written "صفر", and no "·" sits next to a number (it reads as a zero: "٣٦ ·" looks like "٣٦٠"); scores are joined by a dash and counts by "و".
- **Feel:** buttons and cards give press feedback and haptics, and screens fade.
- **Mid-game:** the timer's play and reset buttons are full 48×48 targets (its ink edge is painted over the face so the bar stays 48px). A memory question that hasn't been asked yet shows its prompt in full ink and, in place of a faded "show the answer", says the answer comes after the question. After an award, the confirmation sits over the foot of the pack's side panel, not the tiles. In setup, poster titles sit clear of their corner sticker, and "VS" between the teams is a yellow sticker. `test/game_usability_test.dart` covers these.
- **Tablets** (`lib/core/ui/tablet_scale.dart`): a screen whose short side is 600dp or more shows the phone's game scaled up (laid out at the phone's 892×412 proportions, up to 1.6×), with safe areas, keyboard and pixel ratio scaled to match, so text, buttons and art grow together instead of a phone layout stretching around phone-sized type.
- **Images and colours:** covers and other `BoxFit.cover` images are decoded just big enough to cover the box they're drawn in (`CoverAsset` in `lib/core/ui/cover_image.dart`), not at the file's full size: a 40px thumbnail no longer holds a 1800px cover in memory (about a third less image memory on the lobby and the categories shelf). Pictures that are zoomed or shown whole keep their full size. Colours live in `AppColors`: copies of a token elsewhere use its name, and the colours that mean something (form errors, disabled, a tile nobody won, the film-still soot and title cream) have one; what remains as hex is the website's poster palette tables, the TV cabinet's own shades and alpha stops in constant gradients.
- **Large text:** system font scaling is capped at 130%, and at that size nothing overflows on a phone or a small phone, in Arabic or Franco: the top bar's pills and the board's scores shrink to fit, and setup keeps its quick picks right under the title. `test/large_text_test.dart` plays a whole game at 130% to keep it so.
- **Motion** (`lib/core/ui/motion.dart`), after the website's keyframes: cards rise 22px and fade in one after another (board packs, pack tiles, shelf and setup posters, the lobby's posters, which settle a little crooked); a picked poster's sticker pops; the answer slab turns up. The lobby's headings are printed strips stuck on at a tilt, like the website's hero.
- **Animations off** (Android's "Remove animations", iOS's "Reduce motion"): nothing moves. Implicit animations take their time from `motionFor(context, …)`, which is zero then; page changes skip their fade, zoom or slide (`CalmPageTransitions` in the theme, and the pack, question and photo routes); the photo zooms in one step; counts land at their value; the "+200" shows in place with no drop or swell; the banners hold still; no confetti. Small state changes (a pressed button's squash, a picked poster's lift) simply snap. `test/calm_motion_test.dart` plays a game with animations off and fails if a screen fades, zooms or slides in.
- **Contrast:** every text-and-fill pair of the website's look clears WCAG AA, and `test/contrast_test.dart` keeps it so. Small red text on paper uses the deeper press red, since the button red is 4.4:1 there.
- **Screen readers:** every control has a spoken label, and TalkBack or VoiceOver can press it. A control speaks a label of its own through `Pressable(semanticLabel:)` or `GameButton(semanticLabel:)`, which keep the tap with the label; wrapping one in `Semantics(excludeSemantics: true)` would drop it. `test/screen_reader_test.dart` plays a turn by spoken labels alone. In the shop each buy or gift button says the whole card ("اهدي ٢ ألعاب، ١٦٠ جنيه بدل ٢٠٠، الأكثر طلبًا") rather than three identical "اشتري", and every form field (`SahsahField`) is announced with its visible name.
- **Icon and launch screen:** the retro صحصح logo on the app's cream paper (#FFF8EA), with the website's one-colour mark for Android's themed icons. The launch screen is the logo on the same cream, never Flutter's plain white. `flutter test tool/brand_icons_test.dart` redraws every icon and launch image from the SVGs.

### Playing a game

A game runs **on the Sahsah server**, the same rooms and games as the website (`lib/features/game/game_controller.dart`). The host's phone holds the room's control proof (`sahsah.room.v1`), so the game resumes after the app closes; the server keeps it for 24 hours without a host action. Every host action is a server command, and the screens show what the server says, including its own list of what's allowed right now (`controls`). Guests joining from their own phones come next.

1. **Setup:** pick six of the server's categories (or random), then name the two teams. The first game on a phone asks for the preview passcode and the host's name once (the website's "قبل ما نبدأ", ADR 0017); the app keeps the 30-day sign-in and renews it in its last week. Starting picks each category's next pack this host hasn't played, opens a room and starts it. Starting while an unfinished game exists asks first; the old room is closed, and one left open on another device is taken over and closed.
2. **Board:** six packs as poster cards in three columns, each with a "left" count, a pip per question (white = open, team colour = won, faded = nobody), and once finished a tilted **خلصت** stamp in the colour of the team that took more of its points. Team scores sit on top; tap one to correct its total. Between them a chip says whose turn it is to pick, with an arrow towards that team; the turn passes after every settled question, and tapping the chip hands it over. The flag ends the game early; X goes home and keeps the game.
3. **Pack:** tapping a pack opens its six questions (200, 400, 600, two of each) beside its cover. The header says whose pick it is. Tiles are numbered 1 to 6, so two tiles worth the same can be told apart. The server's board doesn't say a tile's format, so tiles don't either. When the pack is done you go back to the board. Unplayed tiles take the category's colour (as on the website's board); an opened one is cream with a yellow "كمّل" chip; a played one takes the winner's colour, or fades to grey for nobody.
4. **Question** (laid out like the user-journey templates): a slim strip on top with a score at each corner and the clock between them (pause, time left, a bar that drains, reset; it turns red for the last ten seconds and says when the time is up), then the card with a "category – points" badge. A picture takes the card's full height in a frame that hugs it, with the question and buttons beside it and **رجوع** / **إظهار الإجابة**. The 60-second clock starts on its own. A question can't be left open: **رجوع** (or the back gesture) first asks who took the points — a team, nobody, or keep playing. The answer stays hidden in that dialog until the host asks for it, so a back press by mistake spoils nothing. An award can't be taken back on the server; a wrong one is corrected on the team's score. The card is grained paper with ink text; the clock is the website's white timer (a cyan bar, amber when paused, red for the last ten seconds, all red when time is up); the answer appears on a yellow slab that turns up from its top edge.
   - **6A normal:** the question, with its photo when it has one. Picture rounds: *who's in the picture* shows a strip of the portrait, *original colour* starts grayscale (the server sends the crop and the grey; the full picture and the colour come with the answer), *picture proverb*, and *memory* (show → hide to ask → revisit).
   - **Audio:** a clip the host plays out loud (*guess the sound*, *played backwards*, *whose voice* with its spoken clue); a backwards clip's answer can be played forwards.
   - **6B acting (مثّلها):** the rules and a QR code of the card's address, then **جاهز** starts a fresh minute. The actor scans it and the word opens on their phone only (ADR 0019).
   - **6C clarify the picture:** a blurred, close-up or clue picture and a points ladder; **وضّح الصورة** shows a clearer picture (or adds a clue card) and lowers the points, by the server's ladder (600 → 400 → 200, 400 → 250 → 150, 200 → 150 → 50 by default).
   - **Photos:** tap any question photo to open it full screen and zoom (pinch or double-tap). Pictures and clips come from short-lived signed links (`media-access`), kept in memory only; a clip renews its link before it plays.
   - **7A answer:** the answer (and full picture), then award a team the current points or nobody, or go back to the question.
5. **Results:** winner or tie, final scores, points per category, and play again with the same teams. The winner's score card is printed in their colour, stuck on crooked with a crown sticker that pops in, and paper confetti in the brand's colours falls once (not on a tie, nor with animations off); the other card stays cream with the team name on a ribbon of its colour. The breakdown is a printed card. Ending a game early asks first, on paper, with "كمّلوا اللعب" (keep playing) as the yellow button and "أنهي اللعبة" as a red outline, so the inviting button never ends anything.

Rules are the server's (`docs/api/question-lifecycle.md`): timeout never reveals or awards on its own, the 36th answer finishes the game, scores lock at the end. Questions, answers and pictures are the content team's, from the server. When a command fails, a message on the screen in front says why in the website's words (`lib/core/api/problems.dart`); if another device takes the room, the board says so and offers to take it back.

### Shop, account and contact

These follow the prototype's pages. Payments, sign-in and the support inbox aren't in the backend yet, so each screen works up to its final button, which then explains that the feature is coming and offers to start a game (or open the socials).

- **Shop** (`lib/features/shop/`): "for you" and "gift" tabs, packs of 1, 2 (most popular) and 5 games at 100 EGP a game (the production price in `docs/database/commerce-design.md`), gifts 20% off (the website's figure; the backend makes it an admin setting) with the recipient's Egyptian mobile number checked first. Prices and phone rules live in `lib/data/shop.dart`.
- **Account** (`lib/features/account/`): playing as a guest, sign-in with name and WhatsApp number, and the unfinished game on this phone.
- **Contact** (`lib/features/contact/`): a problem, feedback (five faces) or business/influencers, each with its own checks, beside the social accounts.

Fonts (Lalezar for headings and numbers, Alexandria for text, Rakkas for poster titles, the website's three) are bundled in `assets/fonts/`; images and logos are copied from the prototype into `assets/`. Icons use the same Lucide set as the web.

```text
lib/
  main.dart                       # loads the saved language, sign-in and room, starts the app
  app.dart                        # theme, locale/direction, API, catalogue, game and language scopes
  core/api/                       # API client, wire types, problem messages
  core/session/host_session.dart  # the host's preview sign-in
  core/i18n/lang.dart             # Arabic / Franco
  core/theme/app_theme.dart
  core/ui/                        # surfaces, play button, pressable, art
  data/catalog.dart               # the server's categories, kept on the phone
  data/game_rules.dart            # board size, gift discount
  features/game/                  # server game controller, sign-in, setup, board, pack, question, results
  features/shell/                 # game top bar, portrait bottom bar, routes
  features/home/                  # lobby (lobby.dart) + portrait home
  features/categories/            # grid, poster rows, details sheet
  features/join/                  # join-with-code sheet
  features/more/
  features/shop/                  # token packs and gifts
  features/account/               # guest, sign-in, your games
  features/contact/               # support, feedback, business
  features/shared/                # form fields, choice pills, notice sheet
docs/mobile-game-design.md
test/
  sahsah_api_test.dart
  home_test.dart
  support/fake_server.dart        # an in-memory Sahsah API the game tests play against
  catalog_test.dart               # the catalogue: sections, saved copy, retry
  game_controller_test.dart       # rooms, commands, timer, award, resume, control
  game_flow_test.dart             # setup → board → question → award
  online_game_test.dart           # passcode, charades code, audio and clue rounds
  pages_test.dart                 # shop/phone rules, shop, account, contact
```

## Backend API

The app uses the backend exactly as deployed; nothing on the server is mobile-specific. Native apps are not subject to browser CORS, so the backend's `CORS_ORIGINS` does not need a mobile entry.

| Endpoint | Used by |
| --- | --- |
| `GET /api/health` | Backend connection check |
| `GET /api/v1/categories` | Home, shelf, setup (`CatalogController`) |
| `POST /api/v1/preview/sessions` | Host sign-in and renewal (`HostSession`) |
| `GET /api/v1/categories/:id/packs` | Picking each category's next pack |
| `POST /api/v1/rooms`, `GET /api/v1/rooms/:id`, `POST …/games`, `POST …/closure` | Opening, reading, starting and closing the host's room |
| `GET`/`POST /api/v1/rooms/:id/control` | Taking a room back from another device |
| `POST /api/v1/games/:id/commands` | Every host action on the board and questions |
| `POST /api/v1/games/:id/media-access` | Signed links for the open question's pictures and clips |

Every write sends an `Idempotency-Key`, kept per intent so a retry after a lost answer is the same operation; the room's creation key and control secret are saved before sending. `SahsahApi` is available to every screen through `ApiScope.of(context)`; add one method per endpoint, with the wire types in `core/api/wire.dart` and `core/api/game_wire.dart`.

## Running

Use the current stable Flutter SDK with Dart 3.8 or later, Android SDK/JDK for Android, and macOS/Xcode for iOS. The app talks to the live API by default; to use a local backend, start it first (`cd ../web_app/backend && pnpm dev`) and pass its address. From this folder:

```sh
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api
```

`API_BASE_URL` defaults to the live API, `https://api.sa7sa7.cc/api`. For a local backend, pick the address that reaches it from the device:

| Device | `API_BASE_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:3001/api` |
| iOS simulator | `http://localhost:3001/api` |
| Physical device | `http://<your-computer-LAN-IP>:3001/api` |
| Production | your HTTPS API URL |

Plain HTTP is allowed only for development:

- **Android**: `android/app/src/debug/AndroidManifest.xml` enables cleartext traffic for debug builds. Release builds stay HTTPS-only.
- **iOS**: `Info.plist` sets `NSAllowsLocalNetworking` (local hosts only; App Transport Security still applies everywhere else) and `NSLocalNetworkUsageDescription` for physical devices on your LAN.

Commit the generated `pubspec.lock` after resolving dependencies for the first time.

On Windows, `android/gradle.properties` sets `kotlin.incremental=false`: when the project and the pub cache are on different drives, Kotlin's incremental caches fail the build.

## Release builds

```sh
flutter build appbundle --dart-define=API_BASE_URL=https://api.example.com/api
flutter build ipa --dart-define=API_BASE_URL=https://api.example.com/api
```

The provisional application/bundle identifier is `com.sahsah.game`; replace it with the final store identifier before distribution. Configure an Android release keystore and replace the debug signing placeholder before a store build. Select your Apple development team and signing settings in `ios/Runner.xcworkspace` before building an IPA. No production signing credentials are included.

The platform hosts come from the official Flutter app templates (revision `abaf9c523780a608bd46686fd5e53740a07077f8`) with the Gradle 9.3.1 wrapper; the iOS project uses Flutter's Swift Package Manager integration. Template reference: [Flutter app templates](https://github.com/flutter/flutter/tree/stable/packages/flutter_tools/templates/app).
