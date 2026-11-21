# Sahsah mobile app

Flutter application for **iOS and Android**. It copies the design of the web prototype (`../sahsah_prototype`) and talks to the same NestJS backend as the web app (`../web_app/backend`) over HTTP.

## What it does today

A mobile game lobby built from the prototype's design (`../sahsah_prototype`, live at [sahsah.vercel.app](https://sahsah.vercel.app)): same colours, fonts and artwork, but laid out as a phone game rather than a copy of the website. The research, audit and reasoning are in [docs/mobile-game-design.md](docs/mobile-game-design.md).

- **Landscape only, full screen:** the whole app plays sideways like a game on the table (`lib/core/ui/orientation.dart`, plus `sensorLandscape` in the Android manifest and landscape-only orientations in the iOS `Info.plist`). The system bars are hidden; a swipe brings them back.
- **Game top bar:** logo and a guest badge in the lobby (a back button and the screen title elsewhere), the wallet (it reads **مجاني**, free, while the shop is closed) and the language switch on the other side (`lib/features/shell/hud.dart`).
- **Lobby (one screen, no scrolling):** menu tiles (categories, shop, gift, more) at the start, a stage with the game's name, a **إزاي نلعب؟** (how to play) button and the new challenges as vinyl records with a "see all" link, and the big red **ابدأ لعبة** button with **ادخل بكود** under it at the end. An unfinished game shows a "continue" tile above the play button (`lib/features/home/lobby.dart`).
- **Chunky buttons:** menu tiles, play and join are raised game buttons that sink when pressed, with haptics (`lib/core/ui/game_button.dart`).
- **Categories:** section tabs over a sideways row of large posters; tapping one opens its details sheet.
- **Join sheet:** six-digit code entry with a QR button. Rooms aren't in the backend yet, so joining shows a notice.
- **More:** sign-in entry, language switch, contact/feedback/business, mission and vision, socials, in two columns.
- **Portrait fallback:** if a tablet ignores the lock, the app falls back to a scrolling page with a bottom tab bar.
- **Feel:** buttons and cards give press feedback and haptics, screens fade, and system font scaling is capped at 130%.

### Playing a game

The backend has no rooms or game endpoints yet, so a game runs **on the host's phone** (like the prototype's demo mode) and is saved locally. It resumes after the app closes and expires after 24 hours without a host action. Games are free while testing; no token is spent.

1. **Setup:** pick six categories (or use "new challenges" / random), then name the two teams. Starting while an unfinished game exists asks first.
2. **Board:** six category cards in three columns, each with 200/400/600 tiles above and below the art. Team scores sit on top; tap one to correct its total. The flag ends the game early; X goes home and keeps the game.
3. **Question:** the 60-second clock starts on its own (pause, continue, reset). Back to the board keeps the time. **إظهار الإجابة** reveals the answer, then award a team or nobody. Picture rounds: *who's in the picture* shows a strip of the portrait, *original colour* starts grayscale, *picture proverb*, and *memory* (show → hide to ask → revisit). Pinch to zoom any picture.
4. **Results:** winner or tie, final scores, points per category, and play again with the same teams.

Rules follow `docs/database/gameplay-design.md` (Q49–Q60): timeout never reveals or awards on its own, the 36th answer finishes the game, scores lock at the end. "Whose voice" needs audio playback and is marked coming soon. Questions come from the prototype's content (`lib/data/standard_bank.dart` is generated from `standard-bank.ts`).

Shop, gift, account and contact open a placeholder until their stage is built.

Fonts (Lalezar, Readex Pro, Reem Kufi) are bundled in `assets/fonts/`; images and logos are copied from the prototype into `assets/`. Icons use the same Lucide set as the web.

```text
lib/
  main.dart                       # loads the saved language, starts the app
  app.dart                        # theme, locale/direction, API + language scopes
  core/api/                       # HTTP client for the shared backend
  core/i18n/lang.dart             # Arabic / Franco
  core/theme/app_theme.dart
  core/ui/                        # surfaces, play button, pressable, art
  data/categories.dart            # categories until the backend serves them
  data/question_bank.dart         # board questions (+ generated standard_bank.dart)
  features/game/                  # controller, setup, board, question, results
  features/shell/                 # game top bar, portrait bottom bar, routes
  features/home/                  # lobby (lobby.dart) + portrait home
  features/categories/            # grid, poster rows, details sheet
  features/join/                  # join-with-code sheet
  features/more/
  features/placeholder/           # pages not built yet
docs/mobile-game-design.md
test/
  sahsah_api_test.dart
  home_test.dart
  game_controller_test.dart       # timer, award, finish, save/expiry rules
  game_flow_test.dart             # setup → board → question → award
```

## Backend API

The app uses the backend exactly as deployed; nothing on the server is mobile-specific. Native apps are not subject to browser CORS, so the backend's `CORS_ORIGINS` does not need a mobile entry.

| Endpoint | Used by |
| --- | --- |
| `GET /api/health` → `{ "status": "ok", "service": "sahsah-backend" }` | Backend connection check |

`SahsahApi` is available to every screen through `ApiScope.of(context)`. Add new endpoints to it as the backend grows, keeping one method per endpoint and the response models next to it.

## Running

Use the current stable Flutter SDK with Dart 3.8 or later, Android SDK/JDK for Android, and macOS/Xcode for iOS. Start the backend first (`cd ../web_app/backend && pnpm dev`), then from this folder:

```sh
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api
```

`API_BASE_URL` defaults to `http://localhost:3001/api`. Pick the address that reaches your backend from the device:

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
