import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api/sahsah_api.dart';
import 'core/audio/device_sound.dart';
import 'core/audio/sound.dart';
import 'core/i18n/lang.dart';
import 'data/catalog.dart';
import 'features/game/game_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Restore the saved language and any unfinished game before the first frame.
  final (lang, game, sound) = (
    await LangController.load(),
    await GameController.load(),
    await SoundController.load(DeviceSound()),
  );
  // The catalogue keeps its last copy on the phone (see CatalogController).
  final api = SahsahApi();
  final catalog = CatalogController(api, await SharedPreferences.getInstance());
  runApp(
    SahsahApp(
      lang: lang,
      game: game,
      sound: sound,
      api: api,
      catalog: catalog,
      launchPromo: true,
    ),
  );
}
