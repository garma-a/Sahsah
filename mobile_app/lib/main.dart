import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/audio/device_sound.dart';
import 'core/audio/sound.dart';
import 'core/i18n/lang.dart';
import 'features/game/game_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Restore the saved language and any unfinished game before the first frame.
  final (lang, game, sound) = (
    await LangController.load(),
    await GameController.load(),
    await SoundController.load(DeviceSound()),
  );
  runApp(SahsahApp(lang: lang, game: game, sound: sound, launchPromo: true));
}
