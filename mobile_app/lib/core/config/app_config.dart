abstract final class AppConfig {
  // The live API by default; `--dart-define=API_BASE_URL=…` for a local one
  // (`http://10.0.2.2:3001/api` from the Android emulator).
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://api.sa7sa7.cc/api',
  );
}
