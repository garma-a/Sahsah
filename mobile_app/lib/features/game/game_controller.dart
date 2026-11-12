import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../data/question_bank.dart';
import 'model/question.dart';

/// Answering clock states (see `docs/database/gameplay-design.md`).
enum TimerStatus { ready, running, paused, elapsed }

/// "ركز معايا": picture not shown yet, on screen, or hidden (question asked).
enum MemoryPhase { ready, viewing, hidden }

/// Per-question progress, kept when the host goes back to the board.
class QuestionProgress {
  QuestionProgress({
    this.remainingMs = GameController.answerMs,
    this.status = TimerStatus.ready,
    this.deadline,
    this.revealed = false,
    this.memory = MemoryPhase.ready,
    this.memoryAsked = false,
    this.resumeOnReopen = false,
  });

  factory QuestionProgress.fromJson(Map<String, dynamic> j) => QuestionProgress(
    remainingMs: j['remainingMs'] as int,
    status: TimerStatus.values.byName(j['status'] as String),
    deadline: j['deadline'] == null
        ? null
        : DateTime.parse(j['deadline'] as String),
    revealed: j['revealed'] as bool,
    memory: MemoryPhase.values.byName(j['memory'] as String),
    memoryAsked: j['memoryAsked'] as bool,
    resumeOnReopen: j['resumeOnReopen'] as bool,
  );

  /// Time left at the last start/pause checkpoint.
  int remainingMs;
  TimerStatus status;

  /// Only while running.
  DateTime? deadline;
  bool revealed;
  MemoryPhase memory;
  bool memoryAsked;

  /// The clock was paused by leaving to the board, not by the host.
  bool resumeOnReopen;

  Map<String, dynamic> toJson() => {
    'remainingMs': remainingMs,
    'status': status.name,
    'deadline': deadline?.toIso8601String(),
    'revealed': revealed,
    'memory': memory.name,
    'memoryAsked': memoryAsked,
    'resumeOnReopen': resumeOnReopen,
  };
}

/// The host's decision for a tile: a team (0 or 1) or nobody.
class TileResult {
  const TileResult(this.team, this.points);

  factory TileResult.fromJson(Map<String, dynamic> j) =>
      TileResult(j['team'] as int?, j['points'] as int);

  final int? team;
  final int points;

  Map<String, dynamic> toJson() => {'team': team, 'points': points};
}

class Game {
  Game({
    required this.categoryIds,
    required this.teamNames,
    List<int>? scores,
    Map<String, TileResult>? results,
    Map<String, QuestionProgress>? progress,
    this.activeId,
    this.finished = false,
    DateTime? lastActionAt,
  }) : scores = scores ?? [0, 0],
       results = results ?? {},
       progress = progress ?? {},
       lastActionAt = lastActionAt ?? DateTime.now();

  factory Game.fromJson(Map<String, dynamic> j) => Game(
    categoryIds: (j['categoryIds'] as List).cast<String>(),
    teamNames: (j['teamNames'] as List).cast<String>(),
    scores: (j['scores'] as List).cast<int>(),
    results: (j['results'] as Map<String, dynamic>).map(
      (k, v) => MapEntry(k, TileResult.fromJson(v as Map<String, dynamic>)),
    ),
    progress: (j['progress'] as Map<String, dynamic>).map(
      (k, v) =>
          MapEntry(k, QuestionProgress.fromJson(v as Map<String, dynamic>)),
    ),
    activeId: j['activeId'] as String?,
    finished: j['finished'] as bool,
    lastActionAt: DateTime.parse(j['lastActionAt'] as String),
  );

  final List<String> categoryIds;
  final List<String> teamNames;
  final List<int> scores;
  final Map<String, TileResult> results;
  final Map<String, QuestionProgress> progress;
  String? activeId;
  bool finished;
  DateTime lastActionAt;

  int get totalQuestions => categoryIds.length * tilePoints.length;
  int get resolvedCount => results.length;

  /// Winning team index, or null for a tie.
  int? get leader => scores[0] == scores[1]
      ? null
      : scores[0] > scores[1]
      ? 0
      : 1;

  Map<String, dynamic> toJson() => {
    'categoryIds': categoryIds,
    'teamNames': teamNames,
    'scores': scores,
    'results': results.map((k, v) => MapEntry(k, v.toJson())),
    'progress': progress.map((k, v) => MapEntry(k, v.toJson())),
    'activeId': activeId,
    'finished': finished,
    'lastActionAt': lastActionAt.toIso8601String(),
  };
}

/// Runs a game on this device (the host's phone) and saves it so it survives
/// the app closing. Rules follow `docs/database/gameplay-design.md`; a
/// backend-run game will replace this once rooms exist.
class GameController extends ChangeNotifier {
  GameController({
    SharedPreferences? prefs,
    Game? game,
    DateTime Function()? now,
  }) : _prefs = prefs,
       _game = game,
       _now = now ?? DateTime.now;

  static const storageKey = 'sahsah.game.v1';
  static const answerMs = 60000;

  /// A game with no host action for this long can't be resumed (Q21–Q24).
  static const expiry = Duration(hours: 24);

  static Future<GameController> load() async {
    final prefs = await SharedPreferences.getInstance();
    Game? game;
    final raw = prefs.getString(storageKey);
    if (raw != null) {
      try {
        game = Game.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        if (DateTime.now().difference(game.lastActionAt) > expiry) game = null;
      } catch (_) {
        game = null; // Unreadable save from an older build.
      }
      if (game == null) await prefs.remove(storageKey);
    }
    return GameController(prefs: prefs, game: game);
  }

  final SharedPreferences? _prefs;
  final DateTime Function() _now;
  Game? _game;

  Game? get game => _game;
  bool get hasActiveGame => _game != null && !_game!.finished;

  Question question(String id) {
    final dash = id.lastIndexOf('-');
    return questionFor(
      id.substring(0, dash),
      int.parse(id.substring(dash + 1)),
    );
  }

  QuestionProgress progressOf(String id) =>
      _game!.progress.putIfAbsent(id, QuestionProgress.new);

  // ---- Lifecycle ---------------------------------------------------------

  void start({required List<String> categoryIds, required List<String> teams}) {
    assert(categoryIds.length == 6 && teams.length == 2);
    _game = Game(categoryIds: List.of(categoryIds), teamNames: List.of(teams));
    _commit();
  }

  /// Deliberate early ending: scores lock (Q57).
  void end() {
    final g = _game;
    if (g == null) return;
    if (g.activeId != null) _stop(progressOf(g.activeId!));
    g.activeId = null;
    g.finished = true;
    _commit();
  }

  /// Forgets the game entirely (after the results, or to start fresh).
  void discard() {
    _game = null;
    _prefs?.remove(storageKey);
    notifyListeners();
  }

  // ---- Questions -----------------------------------------------------------

  void open(String id) {
    final g = _game!;
    if (g.results.containsKey(id) || g.finished) return;
    if (g.activeId != null && g.activeId != id) leave();
    g.activeId = id;
    final p = progressOf(id);
    final q = question(id);
    if (p.status == TimerStatus.ready &&
        !p.revealed &&
        q.kind != QuestionKind.memory) {
      _run(p, answerMs); // Automatic 60 s clock (Q49).
    } else if (p.resumeOnReopen && p.status == TimerStatus.paused) {
      _run(p, p.remainingMs); // Restore time saved by navigation (Q54).
    }
    p.resumeOnReopen = false;
    _commit();
  }

  /// Back to the board with hints, reveal and time preserved (Q54).
  void leave() {
    final g = _game!;
    final id = g.activeId;
    if (id == null) return;
    final p = progressOf(id);
    if (timerStatus(p) == TimerStatus.running) {
      _pause(p);
      p.resumeOnReopen = true;
    }
    g.activeId = null;
    _commit();
  }

  int remainingMs(QuestionProgress p) {
    if (p.status != TimerStatus.running) return p.remainingMs;
    final left = p.deadline!.difference(_now()).inMilliseconds;
    return math.max(0, left);
  }

  /// Running clocks past their deadline read as elapsed.
  TimerStatus timerStatus(QuestionProgress p) =>
      p.status == TimerStatus.running && remainingMs(p) == 0
      ? TimerStatus.elapsed
      : p.status;

  void toggleTimer(String id) {
    final p = progressOf(id);
    switch (timerStatus(p)) {
      case TimerStatus.running:
        _pause(p);
      case TimerStatus.paused:
        _run(p, p.remainingMs);
      case TimerStatus.ready:
        _run(p, answerMs);
      case TimerStatus.elapsed:
        _run(p, answerMs);
    }
    _commit();
  }

  /// A fresh full clock; hints and reveal are kept.
  void resetTimer(String id) {
    _run(progressOf(id), answerMs);
    _commit();
  }

  /// Timeout never reveals by itself; the host decides (Q58).
  void reveal(String id) {
    final p = progressOf(id);
    _stop(p);
    p.revealed = true;
    _commit();
  }

  void showMemory(String id) {
    progressOf(id).memory = MemoryPhase.viewing;
    _commit();
  }

  /// First hide asks the question and starts the clock once (Q53).
  void hideMemory(String id) {
    final p = progressOf(id);
    p.memory = MemoryPhase.hidden;
    if (!p.memoryAsked) {
      p.memoryAsked = true;
      _run(p, answerMs);
    }
    _commit();
  }

  /// Resolves the tile for [team] (0/1) or nobody. The 36th resolution
  /// finishes the game automatically (Q60).
  void award(String id, int? team) {
    final g = _game!;
    if (g.results.containsKey(id)) return;
    final points = team == null ? 0 : question(id).points;
    _stop(progressOf(id));
    g.results[id] = TileResult(team, points);
    if (team != null) g.scores[team] += points;
    g.activeId = null;
    if (g.resolvedCount >= g.totalQuestions) g.finished = true;
    _commit();
  }

  /// Manual correction to a nonnegative total (Q55).
  void setScore(int team, int total) {
    final g = _game!;
    if (g.finished || total < 0) return;
    g.scores[team] = total;
    _commit();
  }

  // ---- Internals -----------------------------------------------------------

  void _run(QuestionProgress p, int ms) {
    p
      ..status = TimerStatus.running
      ..remainingMs = ms
      ..deadline = _now().add(Duration(milliseconds: ms));
  }

  void _pause(QuestionProgress p) {
    final left = remainingMs(p);
    p
      ..remainingMs = left
      ..status = left == 0 ? TimerStatus.elapsed : TimerStatus.paused
      ..deadline = null;
  }

  void _stop(QuestionProgress p) {
    if (p.status == TimerStatus.running) _pause(p);
    p.resumeOnReopen = false;
  }

  void _commit() {
    final g = _game;
    if (g != null) {
      g.lastActionAt = _now();
      _prefs?.setString(storageKey, jsonEncode(g.toJson()));
    }
    notifyListeners();
  }
}

class GameScope extends InheritedNotifier<GameController> {
  const GameScope({
    super.key,
    required GameController controller,
    required super.child,
  }) : super(notifier: controller);

  static GameController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<GameScope>();
    assert(scope != null, 'GameScope not found');
    return scope!.notifier!;
  }
}

extension GameContext on BuildContext {
  GameController get game => GameScope.of(this);
}
