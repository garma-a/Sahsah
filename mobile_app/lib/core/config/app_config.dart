abstract final class AppConfig {
  // Override for an emulator, physical device or deployed backend.
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3001/api',
  );
}
