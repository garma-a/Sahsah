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

  testWidgets('the shop says which pack each button buys', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      SahsahApp(
        lang: LangController(Lang.ar),
        game: GameController(),
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
    await press(tester, 'المتجر');

    // Three buttons, three different things, none just "buy".
    expect(find.bySemanticsLabel('اشتري'), findsNothing);
    for (final label in [
      'اشتري لعبة واحدة، ١٠٠ جنيه',
      'اشتري ٢ ألعاب، ٢٠٠ جنيه، الأكثر طلبًا',
      'اشتري ٥ ألعاب، ٥٠٠ جنيه',
    ]) {
      final node = tester.getSemantics(find.bySemanticsLabel(label));
      expect(
        node.getSemanticsData().hasAction(SemanticsAction.tap),
        isTrue,
        reason: label,
      );
    }

    // Gifts say their discount against the full price.
    await press(tester, RegExp('^هدية'));
    expect(find.bySemanticsLabel('اهدي'), findsNothing);
    expect(
      find.bySemanticsLabel('اهدي ٢ ألعاب، ١٦٠ جنيه بدل ٢٠٠، الأكثر طلبًا'),
      findsOneWidget,
    );

    // The gift form's fields carry their names, and can be typed into.
    final phone = tester
        .getSemantics(find.byKey(const ValueKey('gift-phone')))
        .getSemanticsData();
    expect(phone.label, contains('رقم المستلم'));
    expect(phone.flagsCollection.isTextField, isTrue);
    expect(phone.hasAction(SemanticsAction.tap), isTrue);
    semantics.dispose();
  });
}
