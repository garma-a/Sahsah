# Sahsah mobile starter

Flutter application source for **iOS and Android**, with an Arabic/RTL Material 3 lobby, editable team names and a reset action. This is a basic starter; the playable prototype remains in `../sahsah_prototype`.

```text
lib/
  main.dart
  app.dart
  core/config/app_config.dart
  features/lobby/lobby_screen.dart
android/    # Kotlin Android host and Gradle configuration
ios/        # Swift iOS host, Xcode project/workspace and Flutter configuration
```

The platform hosts are rendered from the official Flutter app templates (revision `abaf9c523780a608bd46686fd5e53740a07077f8`), with the official Gradle 9.3.1 wrapper and Flutter template icons. The provisional application/bundle identifier is `com.sahsah.game`; replace it with the final store identifier before distribution. No production signing credentials are included. The iOS project uses Flutter's Swift Package Manager integration.

**No Flutter SDK installation, package resolution, analysis or mobile build has been run locally.** The commands below are for a future Flutter-enabled environment or your CI runner.

## Future development

Use the current stable Flutter SDK with Dart 3.8 or later, Android SDK/JDK for Android, and macOS/Xcode for iOS. From this folder:

```sh
flutter pub get
flutter analyze
flutter run
```

Flutter-generated SDK paths, plugin registrants, package lockfile and platform build artifacts are produced in that environment. Commit the resulting `pubspec.lock` after resolving the dependencies for the first time.

`lib/core/config/app_config.dart` defines the future backend URL via `--dart-define`. No API calls are made by the current lobby. For an Android emulator, use `http://10.0.2.2:3001/api`; for an iOS simulator, use `http://localhost:3001/api`; for a physical device, use a reachable server address. Production should use your HTTPS API URL.

```sh
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3001/api
```

When adding API calls, configure platform HTTP/local-network allowances for development or use an HTTPS development URL. Change the API URL to your HTTPS endpoint for production.

## Future release builds

```sh
flutter build appbundle --dart-define=API_BASE_URL=https://api.example.com/api
flutter build ipa --dart-define=API_BASE_URL=https://api.example.com/api
```

Configure an Android release keystore and replace the debug signing placeholder before a store build. Select your Apple development team and signing settings in `ios/Runner.xcworkspace` before building an IPA.

Template reference: [Flutter app templates](https://github.com/flutter/flutter/tree/stable/packages/flutter_tools/templates/app).
