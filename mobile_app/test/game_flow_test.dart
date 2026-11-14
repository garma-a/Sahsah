import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/ui/game_button.dart';
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

    // Board → the "ثقافة عامة" pack → its first 600 question, a picture
    // that gets clearer in stages (template 6C).
    await tester.tap(find.bySemanticsLabel(RegExp('^ثقافة عامة،')).first);
    await settle(tester);
    expect(find.text('اختاروا سؤال'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('question-general-4')));
    await settle(tester);
    expect(game.game!.activeId, 'general-4');
    expect(find.text('إظهار الإجابة'), findsOneWidget);

    // Back (button or gesture) asks who took the points first; "keep
    // playing" stays on the question.
    await tapText(tester, 'رجوع');
    expect(find.text('قبل ما ترجعوا… مين خد النقط؟'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('leave-stay')));
    await settle(tester);
    await tester.binding.handlePopRoute();
    await settle(tester);
    expect(find.text('قبل ما ترجعوا… مين خد النقط؟'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('leave-stay')));
    await settle(tester);
    expect(game.game!.activeId, 'general-4');
    expect(game.game!.results, isEmpty);

    // The picture opens full screen to zoom in, then closes.
    await tester.tap(find.bySemanticsLabel('كبّر الصورة').first);
    await settle(tester);
    expect(find.byKey(const ValueKey('photo-close')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('photo-close')));
    await settle(tester);

    // Clearer picture, fewer points: 600 → 400.
    await tapText(tester, 'وضّح الصورة');
    expect(game.availablePoints('general-4'), 400);

    await tapText(tester, 'إظهار الإجابة');
    expect(find.text('مين جاوب صح؟'), findsOneWidget);
    // The award button, not the team's score card on the side.
    await tester.tap(
      find.ancestor(of: find.text('النسور'), matching: find.byType(GameButton)),
    );
    await settle(tester);

    // Back on the pack screen with the points; then back to the board.
    expect(game.game!.scores, [400, 0]);
    expect(game.game!.results['general-4']!.team, 0);
    expect(find.text('إظهار الإجابة'), findsNothing);
    expect(find.text('اختاروا سؤال'), findsOneWidget);

    // Leaving a question settles it: back → the second team took it.
    // (Let the award confirmation slide away first.)
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('question-general-0')));
    await settle(tester);
    await tapText(tester, 'رجوع');
    await tester.tap(find.byKey(const ValueKey('leave-team-1')));
    await settle(tester);
    expect(game.game!.results['general-0']!.team, 1);
    expect(game.game!.scores, [400, 200]);
    expect(find.text('اختاروا سؤال'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('pack-back')));
    await settle(tester);

    // Leaving keeps the game saved, and home offers to continue it.
    await tester.tap(find.bySemanticsLabel('خروج'));
    await settle(tester);
    await tapText(tester, 'اخرج');
    expect(game.hasActiveGame, isTrue);
    expect(find.text('كمّلوا لعبتكم'), findsOneWidget);
  });
}
