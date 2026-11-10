import 'package:flutter/services.dart';

/// The whole app plays sideways, like a game board on the table.
const appOrientations = [
  DeviceOrientation.landscapeLeft,
  DeviceOrientation.landscapeRight,
];

/// Landscape and full screen (system bars hidden; a swipe brings them back).
/// Android and iOS also declare landscape in their platform config so the
/// launch screen doesn't start upright.
Future<void> applyAppOrientation() async {
  await SystemChrome.setPreferredOrientations(appOrientations);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
}
