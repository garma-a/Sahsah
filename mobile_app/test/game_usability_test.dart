import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:sahsah_mobile/features/game/pack_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show press;
import 'sound_test.dart' show FakeSound;

import 'support/fake_api.dart';

/// What players feel mid-game: big enough timer buttons, a memory question
/// that says why there's no answer yet, packs that don't repeat themselves,
/// and an undo that doesn't cover the tiles.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('the game screens, mid-game', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      SahsahApp(
        api: fakeApi(),
        lang: LangController(Lang.ar),
        game: GameController(),
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
    await press(tester, RegExp('^ابدأ لعبة'));
    await press(tester, 'التحديات الجديدة');
    await press(tester, 'التالي');
    await press(tester, 'ابدأ اللعبة');

    // The memory pack: one format, so its name is on the side panel only,
    // not on every tile.
    await press(tester, RegExp('^ركز معايا، باقي'));
    expect(find.text('ركز معايا'), findsOneWidget);

    // Before the question is asked there's no answer to show: a hint says
    // so instead of a faded button.
    await press(tester, RegExp('^سؤال ١،'));
    expect(find.text('الإجابة بتظهر بعد السؤال'), findsOneWidget);
    expect(find.text('إظهار الإجابة'), findsNothing);

    // The timer's buttons are full 48×48 targets.
    for (final label in ['كمّل', 'إعادة الوقت']) {
      final size = tester.getSize(find.bySemanticsLabel(label).first);
      expect(size.width, greaterThanOrEqualTo(48), reason: label);
      expect(size.height, greaterThanOrEqualTo(48), reason: label);
    }

    // Ask, reveal and award: the undo sits over the pack's side panel,
    // clear of the tiles.
    await press(tester, 'اعرض الصورة');
    await press(tester, RegExp('حفظناها'));
    await press(tester, 'إظهار الإجابة');
    await press(tester, RegExp(r'^الفراعنة\n'));
    final panel = tester.getRect(find.byKey(PackScreen.coverKey));
    final undo = tester.getRect(find.byKey(const ValueKey('award-undo')));
    expect(undo.left, greaterThanOrEqualTo(panel.left));
    expect(undo.right, lessThanOrEqualTo(panel.right));
    expect(
      tester
          .getRect(find.byKey(const ValueKey('question-memory-1')))
          .overlaps(undo),
      isFalse,
    );
    await tester.pump(const Duration(seconds: 5));
    await settle(tester);
    semantics.dispose();
  });
}
