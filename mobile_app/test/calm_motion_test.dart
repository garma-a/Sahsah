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

import 'support/fake_api.dart';

/// With the phone's animations off (Android's "Remove animations", iOS's
/// "Reduce motion"), nothing moves: each screen is there on the next frame,
/// with no fade, zoom or slide around it, and counts land at their value.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  /// Presses [label] by its spoken label and pumps a single frame.
  Future<void> tapNow(WidgetTester tester, Pattern label) async {
    final node = find
        .bySemanticsLabel(label)
        .evaluate()
        .map((e) => tester.getSemantics(find.byElementPredicate((x) => x == e)))
        .firstWhere((n) => n.attached);
    node.owner!.performAction(node.id, SemanticsAction.tap);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
  }

  /// [text] is on screen with nothing animating its way in.
  void still(String text) {
    final target = find.text(text);
    expect(target, findsWidgets, reason: text);
    for (final type in [FadeTransition, ScaleTransition, SlideTransition]) {
      final moving = find.ancestor(
        of: target.first,
        matching: find.byWidgetPredicate(
          (w) => w.runtimeType == type && _isMoving(w),
        ),
      );
      expect(moving, findsNothing, reason: '$text inside a $type');
    }
  }

  testWidgets('a game with animations off', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
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

    await tapNow(tester, RegExp('^ابدأ لعبة'));
    still('اختاروا ٦ فئات');
    await tapNow(tester, 'التحديات الجديدة');
    await tapNow(tester, 'التالي');
    still('سمّوا الفريقين');
    await tapNow(tester, 'ابدأ اللعبة');
    await tapNow(tester, RegExp('^مين في الصورة؟، باقي'));
    still('اختاروا سؤال');
    await tapNow(tester, RegExp('^سؤال ١،'));
    still('إظهار الإجابة');
    await tapNow(tester, 'إظهار الإجابة');
    still('مين جاوب صح؟');
    await tapNow(tester, RegExp(r'^الفراعنة\n'));
    // The "+200" shows where it lands, at once.
    still('+٢٠٠');
    await tester.pump(const Duration(seconds: 5));
    await settle(tester);

    await tapNow(tester, 'رجوع للوحة');
    await tapNow(tester, 'أنهي اللعبة');
    await tester.tap(find.byKey(const ValueKey('confirm-ok')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 16));
    // The winner's score is already 200, not counting up, and no confetti.
    still('الفراعنة كسبوا!');
    expect(find.text('٢٠٠'), findsWidgets);
    expect(
      find.byWidgetPredicate(
        (w) =>
            w is CustomPaint &&
            w.painter.runtimeType.toString() == '_ConfettiPainter',
      ),
      findsNothing,
    );
    semantics.dispose();
  });
}

/// A transition that is mid-way, not one resting at its end.
bool _isMoving(Widget w) => switch (w) {
  FadeTransition(:final opacity) => opacity.value < 1,
  ScaleTransition(:final scale) => scale.value != 1,
  SlideTransition(:final position) => position.value != Offset.zero,
  _ => false,
};
