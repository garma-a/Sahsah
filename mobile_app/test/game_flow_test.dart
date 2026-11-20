import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 700));
}

Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text).first;
  await Scrollable.ensureVisible(tester.element(finder), alignment: 0.5);
  await tester.pump();
  await tester.tap(finder);
  await settle(tester);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('set up a game, play a question and award points', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(892 * 3, 412 * 3); // landscape phone
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    // Record orientation requests sent to the platform.
    final orientations = <List<String>>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'SystemChrome.setPreferredOrientations') {
          orientations.add((call.arguments as List).cast<String>());
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    final game = GameController();
    await tester.pumpWidget(
      SahsahApp(lang: LangController(Lang.ar), game: game),
    );
    await settle(tester);

    // The whole app asks for landscape on start.
    expect(orientations.first, [
      'DeviceOrientation.landscapeLeft',
      'DeviceOrientation.landscapeRight',
    ]);

    // Home → setup.
    await tapText(tester, 'ابدأ لعبة');
    expect(find.text('اختاروا ٦ فئات'), findsOneWidget);

    // Quick pick fills six categories, then name teams.
    await tapText(tester, 'التحديات الجديدة');
    expect(find.text('٦ من ٦ فئات'), findsOneWidget);
    await tapText(tester, 'التالي');
    expect(find.text('سمّوا الفريقين'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('team-0')), 'النسور');
    await settle(tester);
    await tapText(tester, 'ابدأ اللعبة');

    // Board.
    expect(game.hasActiveGame, isTrue);
    expect(game.game!.teamNames, ['النسور', 'الجدعان']);
    expect(find.text('النسور'), findsOneWidget);

    // Open the first 600 tile of "ثقافة عامة" (general, row 4).
    final tile = find.bySemanticsLabel('ثقافة عامة — 600').first;
    await tester.tap(tile);
    await settle(tester);
    expect(find.text('إظهار الإجابة'), findsOneWidget);
    expect(game.game!.activeId, 'general-4');

    await tapText(tester, 'إظهار الإجابة');
    expect(find.text('مين جاوب صح؟'), findsOneWidget);
    await tapText(tester, 'النسور');

    // Back on the board with the points.
    expect(game.game!.scores, [600, 0]);
    expect(game.game!.results['general-4']!.team, 0);
    expect(find.text('إظهار الإجابة'), findsNothing);

    // Leaving keeps the game saved, and home offers to continue it.
    await tester.tap(find.bySemanticsLabel('خروج'));
    await settle(tester);
    await tapText(tester, 'اخرج');
    expect(game.hasActiveGame, isTrue);
    expect(find.text('كمّلوا لعبتكم'), findsOneWidget);
  });
}
