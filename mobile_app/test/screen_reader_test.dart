import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'sound_test.dart' show FakeSound;

/// Presses a control the way TalkBack or VoiceOver does: by its spoken
/// label, through the semantics tree, never by touching the screen. A
/// control a screen reader can read but not press fails here.
Future<void> press(WidgetTester tester, Pattern label) async {
  // The first match a screen reader can reach (a route under a dialog
  // keeps nodes that are no longer attached).
  final node = find
      .bySemanticsLabel(label)
      .evaluate()
      .map((e) => tester.getSemantics(find.byElementPredicate((x) => x == e)))
      .firstWhere((n) => n.attached);
  final data = node.getSemanticsData();
  expect(
    data.hasAction(SemanticsAction.tap),
    isTrue,
    reason: '"${data.label}" has no tap for screen readers',
  );
  node.owner!.performAction(node.id, SemanticsAction.tap);
  await settle(tester);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('a screen reader can play a whole turn', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3); // landscape phone
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final lang = LangController(Lang.ar);
    await tester.pumpWidget(
      SahsahApp(
        lang: lang,
        game: GameController(),
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);

    // The header's language switch.
    await press(tester, 'Switch to English (Franco)');
    expect(lang.ar, isFalse);
    await press(tester, 'غيّر للعربي');
    expect(lang.ar, isTrue);

    // Setup: posters can be picked and unpicked by ear.
    await press(tester, RegExp('^ابدأ لعبة'));
    await press(tester, 'التحديات الجديدة');
    expect(find.text('٦ من ٦ فئات'), findsOneWidget);
    await press(tester, 'مين في الصورة؟');
    expect(find.text('٥ من ٦ فئات'), findsOneWidget);
    await press(tester, 'مين في الصورة؟');
    expect(find.text('٦ من ٦ فئات'), findsOneWidget);
    await press(tester, 'التالي');
    await press(tester, 'ابدأ اللعبة');

    // Board → a category → a question.
    await press(tester, RegExp('باقي ٦ أسئلة'));
    expect(find.text('اختاروا سؤال'), findsOneWidget);
    await press(tester, RegExp('^سؤال ١،'));
    expect(find.text('إظهار الإجابة'), findsOneWidget);

    // Back from a question asks who took the points; answer it by ear,
    // then leave the pack with its round back button.
    await press(tester, 'رجوع');
    expect(find.text('قبل ما ترجعوا… مين خد النقط؟'), findsOneWidget);
    await press(tester, RegExp('^الفراعنة'));
    expect(find.text('اختاروا سؤال'), findsOneWidget);
    await press(tester, 'رجوع للوحة');
    expect(find.text('اختاروا سؤال'), findsNothing);

    semantics.dispose();
  });
}
