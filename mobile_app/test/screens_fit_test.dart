import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/core/ui/tablet_scale.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show pickBoard, press;
import 'sound_test.dart' show FakeSound;

import 'support/fake_server.dart';

/// The screens group 3 of the design review looked at (the acting rules,
/// More, contact) fit on a phone, a small phone and a tablet, at normal
/// and 130% text: any overflow fails. Their social links are named links a
/// screen reader can open, and a tablet shows the game scaled up.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> pump(WidgetTester tester, Size size, double text) async {
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2;
    tester.platformDispatcher.textScaleFactorTestValue = text;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final server = FakeServer();
    await tester.pumpWidget(
      SahsahApp(
        api: server.api,
        lang: LangController(Lang.ar),
        game: await server.game(),
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
  }

  void namedLinks() {
    for (final name in ['Instagram', 'TikTok', 'YouTube', 'Facebook']) {
      final data = find
          .bySemanticsLabel(name)
          .evaluate()
          .map((e) => e.renderObject!.debugSemantics!.getSemanticsData())
          .first;
      expect(data.flagsCollection.isLink, isTrue, reason: name);
      expect(data.hasAction(SemanticsAction.tap), isTrue, reason: name);
    }
  }

  for (final (name, size, text) in [
    ('phone', const Size(892, 412), 1.0),
    ('phone at 130%', const Size(892, 412), 1.3),
    ('small phone at 130%', const Size(740, 360), 1.3),
    ('tablet', const Size(1280, 800), 1.0),
    ('tablet at 130%', const Size(1280, 800), 1.3),
  ]) {
    testWidgets('the acting rules, More and contact fit: $name', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pump(tester, size, text);

      // A game with acting in it: "خمّن المكان" ends with charades.
      await press(tester, RegExp('^ابدأ لعبة'));
      await pickBoard(tester);
      await press(tester, 'التالي');
      await press(tester, 'ابدأ اللعبة');
      // The lobby: no players joined, so the game starts at once.
      await press(tester, 'ابدأ اللعبة');
      await press(tester, RegExp('^خمّن المكان، باقي'));
      await press(tester, RegExp('^سؤال ٥،'));
      expect(find.text('اضغطوا جاهز والوقت يبدأ'), findsOneWidget);
      await press(tester, 'رجوع');
      await press(tester, 'ولا حد');
      await press(tester, 'رجوع للوحة');
      await press(tester, 'خروج');
      await press(tester, 'اخرج');

      await press(tester, 'المزيد');
      await tester.scrollUntilVisible(
        find.bySemanticsLabel('Instagram'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await settle(tester);
      namedLinks();
      await press(tester, 'تواصل معنا');
      namedLinks();
      expect(
        find.text('لحد ما صندوق الرسايل يشتغل، كلمنا على السوشيال.'),
        findsOneWidget,
      );
      semantics.dispose();
    });
  }

  testWidgets('a tablet shows the phone game scaled up', (tester) async {
    await pump(tester, const Size(1280, 800), 1);
    final scale = TabletScale.scaleFor(const Size(1280, 800));
    expect(scale, closeTo(1280 / 892, 0.001));
    // The top bar's language pill is 44px tall in the layout, and drawn
    // that much bigger.
    final pill = tester.getRect(
      find.bySemanticsLabel('Switch to English (Franco)'),
    );
    expect(pill.height, closeTo(44 * scale, 0.5));
  });
}
