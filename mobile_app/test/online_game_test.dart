import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/core/ui/play_button.dart';
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
    // The room's lobby, then the game.
    expect(server.room, isNotNull);
    expect(find.text('غرفة اللعب'), findsOneWidget);
    await press(tester, 'ابدأ اللعبة');
    expect(server.room!.gameId, isNotNull);
    expect(find.byKey(const ValueKey('turn-chip')), findsOneWidget);
    semantics.dispose();
  });

  testWidgets('charades shows a real code for the actor', (tester) async {
    final semantics = tester.ensureSemantics();
    final (server, game) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    // The lobby: no players joined, so the game starts at once.
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
    // The lobby: no players joined, so the game starts at once.
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
    // The lobby: no players joined, so the game starts at once.
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

  testWidgets('the host lobby: code, live players, start when ready', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final (server, game) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');

    // The code to join with, as digits and as a big QR of the join link.
    expect(find.text('١٠٠٠٠٠'), findsOneWidget);
    final qr = tester.getSize(find.byKey(const ValueKey('join-qr')));
    expect(qr.width, greaterThanOrEqualTo(180));
    expect(
      find.text('لسه محدش دخل. استنوا اللاعبين أو ابدأوا.'),
      findsOneWidget,
    );
    expect(server.openSockets, 1);

    // A player joins from another phone: they show up at once, and the
    // start waits for them.
    final sara = server.addPlayer('سارة', team: 2);
    await settle(tester);
    expect(find.text('سارة'), findsOneWidget);
    expect(find.text('لسه ١ من اللاعبين مش جاهزين'), findsOneWidget);
    final start = tester.widget<PlayButton>(
      find.byKey(const ValueKey('lobby-start')),
    );
    expect(start.onPressed, isNull);

    server.ready(sara);
    await settle(tester);
    expect(find.text('كله جاهز. يلا نبدأ!'), findsOneWidget);
    await press(tester, 'ابدأ اللعبة');
    expect(server.room!.gameId, isNotNull);
    expect(find.byKey(const ValueKey('turn-chip')), findsOneWidget);
    expect(game.game!.teamNames, ['الفراعنة', 'الجدعان']);
    semantics.dispose();
  });

  testWidgets('a player joins by code and follows the host\'s game', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final server = FakeServer();
    // The host's phone opens a room.
    final host = await server.game();
    await host.openRoom(
      categoryIds: [
        'cat-90s',
        'cat-football',
        'cat-emoji',
        'cat-places',
        'cat-cinema',
        'cat-songs',
      ],
      teams: ['الفراعنة', 'الجدعان'],
    );
    final code = server.room!.code;

    // This phone is a player's.
    final player = server.guest();
    addTearDown(player.dispose);
    await tester.pumpWidget(
      SahsahApp(
        api: server.api,
        lang: LangController(Lang.ar),
        game: player,
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);

    // A wrong code says so; the right one opens the room's teams.
    await press(tester, 'ادخل بكود');
    await tester.enterText(find.byKey(const ValueKey('join-code')), '999999');
    await settle(tester);
    await tester.tap(find.text('ادخل'));
    await settle(tester);
    expect(find.text('الكود ده مش شغال. تأكد منه مع المضيف.'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('join-code')), code);
    await settle(tester);
    await tester.tap(find.text('ادخل'));
    await settle(tester);
    expect(find.text('لقينا الغرفة!'), findsOneWidget);
    await tester.enterText(find.byKey(const ValueKey('join-name')), 'سارة');
    await tester.tap(find.byKey(const ValueKey('join-team-1')));
    await settle(tester);
    await tester.tap(find.byKey(const ValueKey('join-go')));
    await settle(tester);
    await settle(tester);

    // The player's lobby, live.
    expect(player.isGuest, isTrue);
    expect(find.text('أهلًا سارة! اختار فريقك'), findsOneWidget);
    expect(server.room!.players.single.team, 2);
    await press(tester, 'أنا جاهز');
    expect(server.room!.players.single.ready, isTrue);

    // The host starts: the player's phone follows to the board.
    await host.startGame();
    await settle(tester);
    expect(find.text('المضيف بيختار السؤال الجاي…'), findsOneWidget);

    // The host opens a question: the player sees it, but runs nothing.
    await host.open('cat-90s-1');
    await settle(tester);
    expect(find.text('سؤال 2 في نوستالجيا التسعينات'), findsOneWidget);
    expect(find.text('المضيف بيدير السؤال من موبايله'), findsOneWidget);
    expect(find.text('إظهار الإجابة'), findsNothing);

    // The answer, then the award, as the host decides.
    await host.reveal('cat-90s-1');
    await settle(tester);
    expect(find.text('إجابة 2 في نوستالجيا التسعينات'), findsOneWidget);
    expect(find.text('المضيف هيقول مين جاوب صح'), findsOneWidget);
    await host.award('cat-90s-1', 1);
    await settle(tester);
    expect(player.game!.scores, [0, 200]);
    expect(find.text('المضيف بيختار السؤال الجاي…'), findsOneWidget);

    // Leaving gives the seat up.
    await press(tester, 'اخرج من الغرفة');
    await tester.tap(find.byKey(const ValueKey('confirm-ok')));
    await settle(tester);
    expect(player.hasRoom, isFalse);
    expect(server.room!.players, isEmpty);
    host.dispose();
    semantics.dispose();
  });

  testWidgets('the host removes a player, whose phone says so', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final server = FakeServer();
    final host = await server.game();
    addTearDown(host.dispose);
    await host.openRoom(
      categoryIds: [
        'cat-90s',
        'cat-football',
        'cat-emoji',
        'cat-places',
        'cat-cinema',
        'cat-songs',
      ],
      teams: ['الفراعنة', 'الجدعان'],
    );

    // A player's phone joins and sits in its lobby.
    final player = server.guest();
    addTearDown(player.dispose);
    await player.join(code: server.room!.code, name: 'علي', team: 0);
    await tester.pumpWidget(
      SahsahApp(
        api: server.api,
        lang: LangController(Lang.ar),
        game: player,
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
    await press(tester, RegExp('^ارجع للغرفة'));
    expect(find.text('أهلًا علي! اختار فريقك'), findsOneWidget);

    // The host takes them out: they hear it at once, and their seat is gone.
    await host.removePlayer(server.room!.players.single.id);
    await settle(tester);
    expect(server.room!.players, isEmpty);
    expect(find.text('المضيف شالك من الغرفة'), findsOneWidget);
    expect(player.hasRoom, isFalse);
    expect(player.removed, isTrue);
    semantics.dispose();
  });

  testWidgets('the host lobby removes a player after asking', (tester) async {
    final semantics = tester.ensureSemantics();
    final (server, game) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    final ali = server.addPlayer('علي');
    await settle(tester);
    expect(find.text('علي'), findsOneWidget);

    // Asked first; "keep him" keeps him.
    await press(tester, 'شيل علي');
    expect(find.text('تشيل علي من الغرفة؟'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('confirm-cancel')));
    await settle(tester);
    expect(server.room!.players, hasLength(1));

    await press(tester, 'شيل علي');
    await tester.tap(find.byKey(const ValueKey('confirm-ok')));
    await settle(tester);
    expect(server.room!.players.where((p) => p.id == ali.id), isEmpty);
    expect(find.text('علي'), findsNothing);
    expect(
      find.text('لسه محدش دخل. استنوا اللاعبين أو ابدأوا.'),
      findsOneWidget,
    );
    expect(game.problem, isNull);
    semantics.dispose();
  });

  testWidgets('a landscape lobby keeps a player\'s name whole', (tester) async {
    final semantics = tester.ensureSemantics();
    final (server, _) = await pump(tester);
    await toTeams(tester);
    await press(tester, 'ابدأ اللعبة');
    final player = server.addPlayer('لاعب تجربة');
    await settle(tester);

    // The team column is narrow: the ready label is its icon alone, and
    // still says what it means; the name isn't cut.
    final name = tester.renderObject<RenderParagraph>(find.text('لاعب تجربة'));
    expect(name.didExceedMaxLines, isFalse);
    expect(find.text('مستنيينه'), findsNothing);
    expect(find.byKey(ValueKey('status-${player.id}')), findsOneWidget);
    expect(
      find.bySemanticsLabel(RegExp('لاعب تجربة\nمستنيينه')),
      findsOneWidget,
    );
    semantics.dispose();
  });
}
