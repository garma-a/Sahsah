import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show press;
import 'sound_test.dart' show FakeSound;

import 'support/fake_api.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('ending a game leads with "keep playing"; the winner is '
      'crowned', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final game = GameController();
    await tester.pumpWidget(
      SahsahApp(
        api: fakeApi(),
        lang: LangController(Lang.ar),
        game: game,
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);

    await press(tester, RegExp('^ابدأ لعبة'));
    await press(tester, 'التحديات الجديدة');
    await press(tester, 'التالي');
    await press(tester, 'ابدأ اللعبة');
    await press(tester, RegExp('باقي ٦ أسئلة'));
    await press(tester, RegExp('^سؤال ١،'));
    await press(tester, 'إظهار الإجابة');
    await press(tester, RegExp(r'^الفراعنة\n'));
    await tester.pump(const Duration(seconds: 5));
    await settle(tester);
    await press(tester, 'رجوع للوحة');

    // The safe choice is the inviting one, and it keeps the game going.
    await press(tester, 'أنهي اللعبة');
    expect(find.text('كمّلوا اللعب'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('confirm-cancel')));
    await settle(tester);
    expect(game.game!.finished, isFalse);
    expect(find.text('كمّلوا اللعب'), findsNothing);

    // Ending it shows the winner's card with its crown.
    await press(tester, 'أنهي اللعبة');
    await tester.tap(find.byKey(const ValueKey('confirm-ok')));
    await settle(tester);
    expect(find.text('الفراعنة كسبوا!'), findsOneWidget);
    expect(find.byIcon(LucideIcons600.crown), findsOneWidget);
    // Let the confetti fall.
    await tester.pump(const Duration(seconds: 3));
    semantics.dispose();
  });
}
