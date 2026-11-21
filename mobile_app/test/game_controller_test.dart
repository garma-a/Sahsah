import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

const categories = ['cinema', 'music', 'football', 'person', 'color', 'memory'];

void main() {
  late DateTime now;
  late GameController game;

  setUp(() {
    now = DateTime(2026, 11, 6, 12);
    game = GameController(now: () => now)
      ..start(categoryIds: categories, teams: ['A', 'B']);
  });

  void advance(int ms) => now = now.add(Duration(milliseconds: ms));

  test('opening a question starts the 60 s clock automatically', () {
    game.open('cinema-0');
    final p = game.progressOf('cinema-0');
    expect(game.timerStatus(p), TimerStatus.running);
    advance(15000);
    expect(game.remainingMs(p), 45000);
    advance(50000);
    expect(game.remainingMs(p), 0);
    // Timeout alone doesn't reveal or resolve.
    expect(game.timerStatus(p), TimerStatus.elapsed);
    expect(p.revealed, isFalse);
  });

  test('back to the board pauses; reopening resumes the saved time', () {
    game.open('cinema-0');
    advance(20000);
    game.leave();
    final p = game.progressOf('cinema-0');
    expect(game.timerStatus(p), TimerStatus.paused);
    advance(99000);
    expect(game.remainingMs(p), 40000);
    game.open('cinema-0');
    expect(game.timerStatus(p), TimerStatus.running);
    advance(10000);
    expect(game.remainingMs(p), 30000);
  });

  test('a host pause stays paused after going back and forth', () {
    game.open('cinema-0');
    game.toggleTimer('cinema-0');
    game.leave();
    game.open('cinema-0');
    expect(game.timerStatus(game.progressOf('cinema-0')), TimerStatus.paused);
  });

  test('memory clock starts on the first hide only', () {
    game.open('memory-0');
    final p = game.progressOf('memory-0');
    expect(game.timerStatus(p), TimerStatus.ready);
    game.showMemory('memory-0');
    game.hideMemory('memory-0');
    expect(game.timerStatus(p), TimerStatus.running);
    advance(10000);
    game.showMemory('memory-0');
    game.hideMemory('memory-0');
    expect(game.remainingMs(p), 50000);
  });

  test('award adds the tile points once; nobody adds none', () {
    game.open('music-5');
    game.reveal('music-5');
    game.award('music-5', 1);
    game.award('music-5', 0); // Ignored: already resolved.
    game.open('music-0');
    game.award('music-0', null);
    final g = game.game!;
    expect(g.scores, [0, 600]);
    expect(g.results['music-0']!.team, isNull);
    expect(g.resolvedCount, 2);
    expect(g.activeId, isNull);
  });

  test('the 36th resolution finishes the game', () {
    for (final c in categories) {
      for (var r = 0; r < 6; r++) {
        game.open('$c-$r');
        game.award('$c-$r', r.isEven ? 0 : null);
      }
    }
    final g = game.game!;
    expect(g.finished, isTrue);
    expect(g.scores[0], 6 * (200 + 400 + 600));
    expect(game.hasActiveGame, isFalse);
  });

  test('score correction takes a nonnegative total and locks at the end', () {
    game.setScore(0, 1000);
    game.setScore(1, -5);
    expect(game.game!.scores, [1000, 0]);
    game.end();
    game.setScore(0, 0);
    expect(game.game!.scores[0], 1000);
  });

  test('saved games survive a restart and expire after 24 hours', () async {
    game.open('cinema-0');
    game.award('cinema-0', 0);
    final saved = game.game!.toJson();

    Future<GameController> loadWith(DateTime lastAction) {
      final copy = Game.fromJson(saved)..lastActionAt = lastAction;
      SharedPreferences.setMockInitialValues({
        GameController.storageKey: jsonEncode(copy.toJson()),
      });
      return GameController.load();
    }

    final stale = await loadWith(
      DateTime.now().subtract(const Duration(hours: 25)),
    );
    expect(stale.game, isNull);

    final recent = await loadWith(
      DateTime.now().subtract(const Duration(hours: 2)),
    );
    expect(recent.game!.scores, [200, 0]);
    expect(recent.game!.results.keys, ['cinema-0']);
  });

  test('every board slot has a question', () {
    for (final c in categories) {
      for (var r = 0; r < 6; r++) {
        final q = game.question('$c-$r');
        expect(q.prompt, isNotEmpty);
        expect(q.answer, isNotEmpty);
        expect(q.answerEn, isNotEmpty);
      }
    }
  });
}
