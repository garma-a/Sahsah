import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/session/host_session.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:sahsah_mobile/features/game/model/question.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_server.dart';

const board = [
  'cat-football',
  'cat-90s',
  'cat-emoji',
  'cat-places',
  'cat-cinema',
  'cat-songs',
];

Future<(FakeServer, GameController)> started() async {
  final server = FakeServer();
  final game = await server.game();
  await game.openRoom(categoryIds: board, teams: ['النسور', 'الجدعان']);
  await game.startGame();
  return (server, game);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('start opens a room on the server and plays its board', () async {
    final (server, game) = await started();

    expect(server.room!.gameId, isNotNull);
    expect(game.hasActiveGame, isTrue);
    expect(game.game!.categoryIds, board);
    expect(game.game!.teamNames, ['النسور', 'الجدعان']);
    expect(game.game!.nameOf('cat-90s'), 'نوستالجيا التسعينات');
    expect(game.game!.scores, [0, 0]);
  });

  test('hosting needs the passcode first', () async {
    final game = await FakeServer().game(signedIn: false);
    expect(
      () => game.openRoom(categoryIds: board, teams: ['أ', 'ب']),
      throwsA(isA<SignInNeeded>()),
    );
  });

  test('a category with nothing to play stops the start', () async {
    final game = await FakeServer().game();
    await expectLater(
      game.openRoom(
        categoryIds: [...board.take(5), 'cat-soon'],
        teams: ['أ', 'ب'],
        names: {'cat-soon': 'فوازير وألغاز'},
      ),
      throwsA(
        isA<NoPackLeft>().having((e) => e.empty, 'empty', ['فوازير وألغاز']),
      ),
    );
  });

  test('opening runs the clock; back to the board pauses it', () async {
    final (_, game) = await started();
    await game.open('cat-football-1');

    expect(game.game!.activeId, 'cat-football-1');
    final p = game.progressOf('cat-football-1');
    expect(game.timerStatus(p), TimerStatus.running);
    expect(game.remainingMs(p), greaterThan(55000));
    expect(game.question('cat-football-1').prompt, 'سؤال 2 في الكورة المصرية');

    await game.leave();
    expect(game.game!.activeId, isNull);
    expect(game.game!.opened, contains('cat-football-1'));

    await game.open('cat-football-1');
    expect(
      game.timerStatus(game.progressOf('cat-football-1')),
      TimerStatus.running,
    );
  });

  test(
    'a host pause stays paused, and the server lists what is allowed',
    () async {
      final (_, game) = await started();
      await game.open('cat-football-1');
      expect(game.can('cat-football-1', 'pause_timer'), isTrue);
      expect(game.can('cat-football-1', 'resume_timer'), isFalse);

      game.toggleTimer('cat-football-1');
      await pumpEventQueue();
      expect(game.progressOf('cat-football-1').status, TimerStatus.paused);
      expect(game.can('cat-football-1', 'resume_timer'), isTrue);
    },
  );

  test('memory: the clock starts on the first hide only', () async {
    final (_, game) = await started();
    const id = 'cat-emoji-2';
    await game.open(id);
    expect(game.question(id).kind, QuestionKind.memory);
    expect(game.progressOf(id).memory, MemoryPhase.ready);
    expect(game.timerStatus(game.progressOf(id)), TimerStatus.ready);
    expect(game.can(id, 'reveal_answer'), isFalse);

    game.showMemory(id);
    await pumpEventQueue();
    expect(game.progressOf(id).memory, MemoryPhase.viewing);
    expect(game.question(id).image, isNotNull);

    game.hideMemory(id);
    await pumpEventQueue();
    expect(game.progressOf(id).memory, MemoryPhase.hidden);
    expect(game.progressOf(id).memoryAsked, isTrue);
    expect(game.timerStatus(game.progressOf(id)), TimerStatus.running);
    expect(game.question(id).prompt, 'سؤال 3 في خمّن الكلمة من الإيموجي');
  });

  test('staged: each clearer picture lowers the points, twice', () async {
    final (_, game) = await started();
    const id = 'cat-90s-4';
    await game.open(id);
    expect(game.question(id).kind, QuestionKind.staged);
    expect(game.question(id).pointStages, [600, 400, 200]);
    expect(game.availablePoints(id), 600);

    game.advanceStage(id);
    await pumpEventQueue();
    expect(game.availablePoints(id), 400);
    expect(game.progressOf(id).stage, 1);
    game.advanceStage(id);
    await pumpEventQueue();
    expect(game.availablePoints(id), 200);
    expect(game.can(id, 'advance_hint'), isFalse);
  });

  test('award reveals first, counts once, and passes the turn', () async {
    final (_, game) = await started();
    await game.open('cat-football-2');
    await game.award('cat-football-2', 0);

    expect(game.game!.scores, [400, 0]);
    expect(game.game!.results['cat-football-2']!.team, 0);
    expect(game.game!.results['cat-football-2']!.points, 400);
    expect(game.game!.turn, 1);

    await game.open('cat-football-0');
    await game.award('cat-football-0', null);
    expect(game.game!.scores, [400, 0]);
    expect(game.game!.results['cat-football-0']!.team, isNull);
    expect(game.game!.turn, 0);
  });

  test('a colour answer brings its colour; a picture gets its link', () async {
    final (_, game) = await started();
    const id = 'cat-90s-3';
    await game.open(id);
    await pumpEventQueue(); // The links come in after the view.
    expect(game.image(game.question(id).image), isNotNull);
    await game.reveal(id);
    expect(game.progressOf(id).revealed, isTrue);
    expect(game.question(id).answer, 'إجابة 4 في نوستالجيا التسعينات');
    expect(game.question(id).color, const Color(0xFFC0392B));
  });

  test('score correction sets a total on the server', () async {
    final (_, game) = await started();
    await game.setScore(1, 750);
    expect(game.game!.scores, [0, 750]);
  });

  test('ending locks the result with each category\'s points', () async {
    final (_, game) = await started();
    await game.open('cat-cinema-5');
    await game.award('cat-cinema-5', 1);
    await game.end();

    expect(game.game!.finished, isTrue);
    expect(game.hasActiveGame, isFalse);
    expect(game.game!.categoryPoints('cat-cinema'), [0, 600]);
    expect(game.game!.leader, 1);
  });

  test('the room survives a restart, mid-question, with the turn', () async {
    final (server, game) = await started();
    await game.open('cat-football-1');
    await game.award('cat-football-1', 0);
    await game.open('cat-songs-3');

    final prefs = await SharedPreferences.getInstance();
    final again = GameController(
      api: server.api,
      session: HostSession(server.api, prefs),
      prefs: prefs,
    );
    expect(again.hasRoom, isTrue);
    await again.refresh();
    expect(again.game!.activeId, 'cat-songs-3');
    expect(again.game!.turn, 1);
    expect(again.game!.scores, [200, 0]);
  });

  test('another device taking the room is said, and can be undone', () async {
    final (server, game) = await started();
    server.takeControlElsewhere();
    await game.refresh();
    expect(game.controlLost, isTrue);

    await game.takeControl();
    expect(game.controlLost, isFalse);
    expect(game.hasActiveGame, isTrue);
  });

  test('a room closed on the server is forgotten', () async {
    final (server, game) = await started();
    server.room!.closed = true;
    await game.refresh();
    expect(game.hasRoom, isFalse);
    expect(game.game, isNull);
  });

  test('a new game closes the old room, even one opened elsewhere', () async {
    final (server, game) = await started();
    final first = server.room!.id;
    await game.openRoom(
      categoryIds: board.reversed.toList(),
      teams: ['أ', 'ب'],
    );
    expect(server.room!.id, isNot(first));

    // Another phone signed in as the same host (here: a fresh controller
    // that holds no room) still gets a new game.
    SharedPreferences.setMockInitialValues({
      HostSession.storageKey: (await SharedPreferences.getInstance()).getString(
        HostSession.storageKey,
      )!,
    });
    final other = await server.game();
    expect(other.hasRoom, isFalse);
    await other.openRoom(categoryIds: board, teams: ['ج', 'د']);
    expect(other.lobby!.teamNames, ['ج', 'د']);
    expect(server.room!.teams, ['ج', 'د']);
  });

  test('a refused command is reported, not thrown', () async {
    final (server, game) = await started();
    await game.open('cat-football-1');
    server.offline = true;
    await game.reveal('cat-football-1');
    expect(game.problem!.code, 'NETWORK');
    expect(game.problemCount, 1);
    server.offline = false;
  });
}
