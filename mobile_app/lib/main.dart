import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/i18n/lang.dart';
import 'features/game/game_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Restore the saved language and any unfinished game before the first frame.
  final (lang, game) = (
    await LangController.load(),
    await GameController.load(),
  );
  runApp(SahsahApp(lang: lang, game: game));
}
