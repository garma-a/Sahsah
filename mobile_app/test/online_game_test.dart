import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show pickBoard, press;
import 'sound_test.dart' show FakeSound;
import 'support/fake_server.dart';

/// Hosting through the server: the passcode once, then rounds the offline
/// game didn't have (audio, clue cards, a real charades code).
void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<(FakeServer, GameController)> pump(
    WidgetTester tester, {
    bool signedIn = true,
  }) async {
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final server = FakeServer();
    final game = await server.game(signedIn: signedIn);
    await tester.pumpWidget(
      SahsahApp(
        api: server.api,
        lang: LangController(Lang.ar),
        game: game,
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
    return (server, game);
  }

  Future<void> toTeams(WidgetTester tester) async {
    await press(tester, RegExp('^ابدأ لعبة'));
    await pickBoard(tester);
    await press(tester, 'التالي');
  }

  testWidgets('the first game asks for the passcode once', (tester) async {
    final semantics = tester.ensureSemantics();
    final (server, game) = await pump(tester, signedIn: false);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    expect(find.text('قبل ما نبدأ'), findsOneWidget);

    // A wrong code says so, and nothing starts.
    await tester.enterText(
      find.byKey(const ValueKey('sign-in-passcode')),
      'غلط',
    );
    await tester.enterText(find.byKey(const ValueKey('sign-in-name')), 'سارة');
    await tester.tap(find.text('يلا'));
    await settle(tester);
    expect(
      find.text('الكود السري مش صح. اتأكد منه وجرّب تاني.'),
      findsOneWidget,
    );
    expect(server.room, isNull);

    // The right one signs this phone in and the game starts.
    await tester.enterText(
      find.byKey(const ValueKey('sign-in-passcode')),
      fakePasscode,
    );
    await tester.tap(find.text('يلا'));
    await settle(tester);
    await settle(tester);
    expect(game.session.signedIn, isTrue);
    expect(game.session.displayName, 'سارة');
    expect(server.room!.gameId, isNotNull);
    expect(find.byKey(const ValueKey('turn-chip')), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('charades shows a real code for the actor', (tester) async {
    final semantics = tester.ensureSemantics();
    final (server, game) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    await press(tester, RegExp('^خمّن المكان، باقي'));
    await press(tester, RegExp('^سؤال ٥،'));

    final qr = tester.widget<QrImageView>(find.byType(QrImageView));
    expect(qr.errorCorrectionLevel, QrErrorCorrectLevel.M);
    // Big enough to read from across the table on a landscape phone, with
    // a white margin all round.
    final card = tester.getSize(find.byKey(const ValueKey('card-qr')));
    final code = tester.getSize(find.byType(QrImageView));
    expect(card.width, greaterThanOrEqualTo(220));
    expect(code.width, lessThan(card.width * 0.85));

    // Ready starts a fresh minute on the server.
    await press(tester, 'جاهز');
    expect(server.commands.last, 'reset_timer');
    expect(find.byType(QrImageView), findsNothing);
    expect(find.text('مثّلوا فيلم'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('an audio round has a play button and its clue', (tester) async {
    final semantics = tester.ensureSemantics();
    await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    await press(tester, RegExp('^خمّن المكان، باقي'));
    await press(tester, RegExp('^سؤال ٢،'));

    expect(find.bySemanticsLabel('شغّل المقطع'), findsOneWidget);
    expect(find.text('ممثل مشهور'), findsOneWidget);
    expect(find.text('سؤال 2 في خمّن المكان'), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('a clue round adds a card with each step', (tester) async {
    final semantics = tester.ensureSemantics();
    final (_, game) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    await press(tester, RegExp('^خمّن الكلمة من الإيموجي، باقي'));
    await press(tester, RegExp('^سؤال ٥،'));
    expect(find.bySemanticsLabel('كبّر الصورة'), findsOneWidget);

    await press(tester, 'وضّح الصورة');
    expect(game.availablePoints('cat-emoji-4'), 400);
    // The picture stays; the clue card joins it.
    expect(find.bySemanticsLabel('كبّر الصورة'), findsNWidgets(2));
    semantics.dispose();
  });
}
