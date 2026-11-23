import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/api/sahsah_api.dart';
import 'core/audio/device_sound.dart';
import 'core/audio/sound.dart';
import 'core/i18n/lang.dart';
import 'core/session/host_session.dart';
import 'data/catalog.dart';
import 'features/game/game_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  final api = SahsahApi();
  // This phone's host sign-in and the room it runs, restored before the
  // first frame; the room itself is fetched from the server after.
  final session = HostSession(api, prefs);
  final (lang, game, sound) = (
    await LangController.load(),
    await GameController.load(api, session),
    await SoundController.load(DeviceSound()),
  );
  // The catalogue keeps its last copy on the phone (see CatalogController).
  final catalog = CatalogController(api, prefs);
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
