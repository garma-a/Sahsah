import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:sahsah_mobile/features/home/promo_banner.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show press;
import 'sound_test.dart' show FakeSound;

/// The app caps system text at 130%. At that size, on a phone and on a
/// small phone, no screen may overflow: an overflow fails the test.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> pump(WidgetTester tester, Size size, Lang lang) async {
    tester.view.physicalSize = size * 3;
    tester.view.devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(
      SahsahApp(
        lang: LangController(lang),
        game: GameController(),
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
  }

  Future<void> everyBanner(WidgetTester tester) async {
    for (var i = 0; i < 3; i++) {
      await tester.pump(PromoCarousel.interval);
      await settle(tester);
      await settle(tester);
    }
  }

  for (final (name, size) in [
    ('phone', const Size(892, 412)),
    ('small phone', const Size(740, 360)),
  ]) {
    testWidgets('a whole game at 130% text on a $name', (tester) async {
      final semantics = tester.ensureSemantics();
      await pump(tester, size, Lang.ar);
      await everyBanner(tester);

      await press(tester, RegExp('^ابدأ لعبة'));
      await press(tester, 'التحديات الجديدة');
      await press(tester, 'التالي');
      await press(tester, 'ابدأ اللعبة');
      await press(tester, RegExp('باقي ٦ أسئلة'));
      await press(tester, RegExp('^سؤال ١،'));
      await press(tester, 'إظهار الإجابة');
      // The award button (name, then the points), not the score pill.
      await press(tester, RegExp(r'^الفراعنة\n'));
      await tester.pump(const Duration(seconds: 5));
      await settle(tester);
      await press(tester, 'رجوع للوحة');
      await press(tester, 'أنهي اللعبة');
      await tester.tap(find.byKey(const ValueKey('confirm-ok')));
      await settle(tester);
      expect(find.textContaining('كسبوا'), findsOneWidget);
      semantics.dispose();
    });
  }

  testWidgets('the lobby at 130% text in Franco', (tester) async {
    await pump(tester, const Size(740, 360), Lang.en);
    await everyBanner(tester);
  });
}
