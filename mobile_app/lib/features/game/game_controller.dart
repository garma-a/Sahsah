import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/game_wire.dart';
import '../../core/api/room_channel.dart';
import '../../core/api/sahsah_api.dart';
import '../../core/api/wire.dart';
import '../../core/session/host_session.dart';
import 'model/question.dart';

/// Answering clock states, as the server keeps them.
enum TimerStatus { ready, running, paused, elapsed }

/// "ركز معايا": picture not shown yet, on screen, or hidden (question asked).
enum MemoryPhase { ready, viewing, hidden }

/// The open question's progress, from the server's view of it.
class QuestionProgress {
  QuestionProgress({
    this.remainingMs = GameController.answerMs,
    this.status = TimerStatus.ready,
    this.deadline,
    this.revealed = false,
    this.memory = MemoryPhase.ready,
    this.memoryAsked = false,
    this.stage = 0,
  });

  /// Time left at the last start/pause checkpoint.
  int remainingMs;
  TimerStatus status;

  /// On this phone's clock; only while running.
  DateTime? deadline;
  bool revealed;
  MemoryPhase memory;
  bool memoryAsked;

  /// How many times a staged picture has been made clearer.
  int stage;
}

/// The host's decision for a tile: a team (0 or 1) or nobody.
class TileResult {
  const TileResult(this.team, this.points);

  final int? team;
  final int points;
}

/// The game as the screens see it: the server's board, scores and results,
/// plus whose turn it is (kept on the phone; the server has no turns).
class Game {
  Game({
    required this.categoryIds,
    required this.categoryNames,
    required this.teamNames,
    required this.scores,
    required this.results,
    required this.opened,
    this.activeId,
    this.finished = false,
    this.turn = 0,
    Map<String, List<int>>? totals,
  }) : _totals = totals;

  final List<String> categoryIds;
  final Map<String, String> categoryNames;
  final List<String> teamNames;
  final List<int> scores;
  final Map<String, TileResult> results;

  /// Tiles opened (or revealed) and not yet decided.
  final Set<String> opened;
  final String? activeId;
  final bool finished;

  /// The team (0 or 1) that picks the next question.
  final int turn;
  final Map<String, List<int>>? _totals;

  int get totalQuestions => categoryIds.length * tilePoints.length;
  int get resolvedCount => results.length;

  /// Winning team index, or null for a tie.
  int? get leader => scores[0] == scores[1]
      ? null
      : scores[0] > scores[1]
      ? 0
      : 1;

  String nameOf(String categoryId) => categoryNames[categoryId] ?? '';

  /// Points each team took in a category.
  List<int> categoryPoints(String categoryId) {
    final known = _totals?[categoryId];
    if (known != null) return known;
    final totals = [0, 0];
    for (var r = 0; r < tilePoints.length; r++) {
      final result = results['$categoryId-$r'];
      if (result?.team != null) totals[result!.team!] += result.points;
    }
    return totals;
  }
}

/// Why a game couldn't start, beyond what the server said.
sealed class StartProblem implements Exception {
  const StartProblem();
}

/// The host has to sign in first (the preview passcode).
class SignInNeeded extends StartProblem {
  const SignInNeeded();
}

/// Some categories have nothing left to play: every pack was played by
/// this host ([played]), or there's no playable pack at all ([empty]).
class NoPackLeft extends StartProblem {
  const NoPackLeft({required this.played, required this.empty});

  final List<String> played;
  final List<String> empty;
}

/// Where question pictures come from: their short-lived signed links.
/// Tests swap in a local picture.
abstract final class MediaImages {
  static ImageProvider<Object> Function(String url) provider = NetworkImage.new;
}

/// What this phone keeps to run its room: the control proof, whose turn it
/// is, and the last board (a reopened question names no categories).
class _HostRoom {
  _HostRoom({
    required this.roomId,
    required this.controlSecret,
    required this.generation,
    this.turn = 0,
    this.board,
  });

  factory _HostRoom.fromJson(Map<String, dynamic> j) => _HostRoom(
    roomId: j['roomId'] as String,
    controlSecret: j['controlSecret'] as String,
    generation: j['generation'] as String,
    turn: j['turn'] as int? ?? 0,
    board: j['board'] as Map<String, dynamic>?,
  );

  final String roomId;
  String controlSecret;
  String generation;
  int turn;
  Map<String, dynamic>? board;

  Map<String, dynamic> toJson() => {
    'roomId': roomId,
    'controlSecret': controlSecret,
    'generation': generation,
    'turn': turn,
    'board': ?board,
  };
}

/// A player's seat in someone else's room, from joining with a code. The
/// secret is this phone's proof; with the last board it survives a restart.
class _GuestSeat {
  _GuestSeat({
    required this.roomId,
    required this.code,
    required this.membershipId,
    required this.secret,
    required this.displayName,
    this.board,
  });

  factory _GuestSeat.fromJson(Map<String, dynamic> j) => _GuestSeat(
    roomId: j['roomId'] as String,
    code: j['code'] as String,
    membershipId: j['membershipId'] as String,
    secret: j['secret'] as String,
    displayName: j['displayName'] as String,
    board: j['board'] as Map<String, dynamic>?,
  );

  final String roomId;
  final String code;
  final String membershipId;
  final String secret;
  final String displayName;
  Map<String, dynamic>? board;

  GuestAuth get auth => GuestAuth(membershipId: membershipId, secret: secret);

  Map<String, dynamic> toJson() => {
    'roomId': roomId,
    'code': code,
    'membershipId': membershipId,
    'secret': secret,
    'displayName': displayName,
    'board': ?board,
  };
}

/// Runs the host's game through the Sahsah API: the room and its game live
/// on the server, and every host action is a command there
/// (`docs/api/question-lifecycle.md`). This phone keeps the room's control
/// proof so the game survives the app closing.
///
/// The same controller runs a player's seat instead, after joining someone
/// else's room with its code: the views are the server's viewer views (no
/// controls), and only the player's own lobby actions are sent. Live
/// updates come over the room's socket ([RoomChannel]).
class GameController extends ChangeNotifier {
  GameController({
    SahsahApi? api,
    HostSession? session,
    SharedPreferences? prefs,
    DateTime Function()? now,
    RoomSocketConnector? connect,
  }) : _api = api ?? SahsahApi(),
       _session = session ?? HostSession(api ?? SahsahApi()),
       _prefs = prefs,
       _now = now ?? DateTime.now,
       _connect = connect {
    final raw = _prefs?.getString(roomKey);
    if (raw != null) {
      try {
        _room = _HostRoom.fromJson(jsonDecode(raw) as Map<String, dynamic>);
        final board = _room!.board;
        if (board != null) _board = BoardView.fromJson(board);
      } on Object {
        _prefs?.remove(roomKey);
      }
    }
    final seat = _prefs?.getString(seatKey);
    if (_room == null && seat != null) {
      try {
        _seat = _GuestSeat.fromJson(jsonDecode(seat) as Map<String, dynamic>);
        final board = _seat!.board;
        if (board != null) _board = BoardView.fromJson(board);
      } on Object {
        _prefs?.remove(seatKey);
      }
    }
    // The offline game of earlier versions can't be resumed.
    _prefs?.remove('sahsah.game.v1');
  }

  static const roomKey = 'sahsah.room.v1';
  static const seatKey = 'sahsah.seat.v1';
  static const _pendingKey = 'sahsah.room.pending.v1';
  static const _pendingJoinKey = 'sahsah.join.pending.v1';
  static const answerMs = 60000;

  /// Restores the room this phone runs, if any; [refresh] then fetches it.
  static Future<GameController> load(SahsahApi api, HostSession session) async {
    final prefs = await SharedPreferences.getInstance();
    return GameController(api: api, session: session, prefs: prefs);
  }

  final SahsahApi _api;
  final HostSession _session;
  final SharedPreferences? _prefs;
  final DateTime Function() _now;
  final RoomSocketConnector? _connect;

  HostSession get session => _session;

  ContentLanguage _language = ContentLanguage.ar;
  _HostRoom? _room;
  _GuestSeat? _seat;
  Snapshot? _snapshot;
  Invitation? _invitation;
  RoomChannel? _channel;
  Set<String> _connected = const {};

  /// This seat opened on another phone: this one stops.
  bool _replaced = false;

  /// The host removed this player from the room.
  bool _removed = false;
  BoardView? _board;

  /// Server time minus this phone's time, from the last snapshot.
  Duration _offset = Duration.zero;
  final _keys = <String, String>{};
  bool _busy = false;
  bool _disposed = false;

  ApiError? _problem;
  int _problemCount = 0;

  /// Another device took control of the room.
  bool _controlLost = false;

  /// Charades questions whose actor said "ready" (the rules are read).
  final _actorReady = <String>{};

  // Media links of the open question.
  final _urls = <String, String>{};
  final _images = <String, ImageProvider<Object>>{};
  String _mediaSet = '';
  List<MediaRef> _mediaRefs = const [];

  /// When the links in hand stop working, on this phone's clock.
  DateTime? _mediaUntil;

  // ---- What the screens read -----------------------------------------------

  /// A room is held on this phone, as host or player (it may still be
  /// loading).
  bool get hasRoom => _room != null || _seat != null;

  /// This phone runs the room.
  bool get isHost => _room != null;

  /// This phone is a player in someone else's room.
  bool get isGuest => _seat != null;

  /// The room before its game starts (and between games).
  LobbyView? get lobby {
    final view = _snapshot?.view;
    return view is LobbyView ? view : null;
  }

  /// This player's seat in the lobby.
  Member? get me {
    final id = _seat?.membershipId;
    if (id == null) return null;
    return lobby?.members.where((m) => m.id == id).firstOrNull;
  }

  /// The room's code and join link (host).
  Invitation? get invitation => _invitation;

  /// Seats with a live connection.
  Set<String> get connected => _connected;

  /// This seat opened on another phone.
  bool get replaced => _replaced;

  /// The host removed this player (the seat is gone).
  bool get removed => _removed;

  /// A command or a start is in flight.
  bool get busy => _busy;

  /// The last thing that went wrong, for a message; [problemCount] counts
  /// them so a listener shows each once.
  ApiError? get problem => _problem;
  int get problemCount => _problemCount;
  bool get controlLost => _controlLost;

  Game? get game {
    final board = _board;
    if (board == null) return null;
    final view = _snapshot?.view;
    final teams = switch (view) {
      BoardView(:final teams) => teams,
      QuestionView(:final teams) => teams,
      ResultView(:final teams) => teams,
      _ => board.teams,
    };
    final results = <String, TileResult>{};
    final opened = <String>{};
    for (final c in board.board) {
      for (final t in c.tiles) {
        final id = '${c.categoryId}-${t.questionPosition - 1}';
        if (t.state == TileState.resolved) {
          final winner = t.winningTeamNumber;
          results[id] = TileResult(
            winner == null ? null : winner - 1,
            winner == null ? 0 : (t.awardedPoints ?? 0),
          );
        } else if (t.state != TileState.unopened) {
          opened.add(id);
        }
      }
    }
    String? active;
    if (view is QuestionView) {
      active = _idFor(view.boardPosition, view.questionPosition);
      if (active != null) opened.add(active);
    }
    return Game(
      categoryIds: [for (final c in board.board) c.categoryId],
      categoryNames: {for (final c in board.board) c.categoryId: c.name},
      teamNames: [for (final t in teams) t.name],
      scores: [for (final t in teams) t.score],
      results: results,
      opened: opened,
      activeId: active,
      finished: view is ResultView,
      turn: _room?.turn ?? 0,
      totals: view is ResultView
          ? {for (final c in view.categories) c.categoryId: c.points}
          : null,
    );
  }

  bool get hasActiveGame {
    final g = game;
    return g != null && !g.finished;
  }

  /// The open question's view, when [id] is the one open.
  QuestionView? viewOf(String id) {
    final view = _snapshot?.view;
    if (view is! QuestionView) return null;
    return _idFor(view.boardPosition, view.questionPosition) == id
        ? view
        : null;
  }

  /// Whether the server allows [command] on the open question right now.
  bool can(String id, String command) =>
      !_busy && (viewOf(id)?.controls.contains(command) ?? false);

  Question question(String id) {
    final (categoryId, row) = _split(id);
    final view = viewOf(id);
    if (view == null) {
      final tile = _tile(id);
      return Question(
        categoryId: categoryId,
        row: row,
        kind: QuestionKind.standard,
        points: tile?.basePoints,
      );
    }
    final q = view.question;
    final a = view.answer;
    final memory = q.memoryPhase;
    final prompt = switch (memory) {
      'ready' || 'viewing_first' => q.instruction ?? '',
      _ => q.prompt ?? '',
    };
    return Question(
      categoryId: categoryId,
      row: row,
      kind: QuestionKind.of(q.format),
      format: q.format,
      prompt: prompt,
      answer: a?.text ?? '',
      image: q.image,
      clue: q.clue,
      audio: q.audio,
      answerImage: a?.image,
      forwardAudio: a?.forwardAudio,
      color: _color(a?.colorHex),
      hint: q.hint,
      cardUrl: q.cardUrl,
      durationMs: q.durationMs,
      points: view.basePoints,
      pointStages: q.stageSuggestions.isEmpty
          ? [view.basePoints]
          : q.stageSuggestions,
    );
  }

  QuestionProgress progressOf(String id) {
    final view = viewOf(id);
    if (view == null) {
      return QuestionProgress(revealed: _tile(id)?.state == TileState.revealed);
    }
    final timer = view.timer;
    final phase = view.question.memoryPhase;
    return QuestionProgress(
      remainingMs: timer.remainingMs,
      status: TimerStatus.values.byName(timer.state.name),
      deadline: timer.deadlineAt?.subtract(_offset),
      revealed: view.revealed,
      memory: switch (phase) {
        'viewing_first' || 'revisit' => MemoryPhase.viewing,
        'recall' => MemoryPhase.hidden,
        _ => view.revealed ? MemoryPhase.hidden : MemoryPhase.ready,
      },
      memoryAsked: phase == 'recall' || phase == 'revisit' || view.revealed,
      stage: view.question.stageIndex,
    );
  }

  int remainingMs(QuestionProgress p) {
    if (p.status != TimerStatus.running || p.deadline == null) {
      return p.remainingMs;
    }
    return math.max(0, p.deadline!.difference(_now()).inMilliseconds);
  }

  /// Running clocks past their deadline read as elapsed.
  TimerStatus timerStatus(QuestionProgress p) =>
      p.status == TimerStatus.running && remainingMs(p) == 0
      ? TimerStatus.elapsed
      : p.status;

  /// What a correct answer is worth right now.
  int availablePoints(String id) =>
      viewOf(id)?.suggestedPoints ?? question(id).points;

  /// A picture of the open question, once its link is in.
  ImageProvider<Object>? image(MediaRef? ref) {
    if (ref == null) return null;
    final cached = _images[ref.key];
    if (cached != null) return cached;
    final url = _urls[ref.key];
    if (url == null) return null;
    // The first link keeps showing; a renewed one is for new loads.
    return _images[ref.key] = MediaImages.provider(url);
  }

  /// A clip's current link.
  String? mediaUrl(MediaRef? ref) => ref == null ? null : _urls[ref.key];

  /// A clip's link that still works for a while: renewed first when it's
  /// about to expire (a picture already on screen doesn't need it).
  Future<String?> freshMediaUrl(MediaRef? ref) async {
    if (ref == null) return null;
    final until = _mediaUntil;
    if (until == null ||
        until.difference(_now()) < const Duration(minutes: 1)) {
      await _fetchMedia(_mediaRefs, _mediaSet);
    }
    return _urls[ref.key];
  }

  bool actorReady(String id) => _actorReady.contains(id);

  // ---- Lifecycle -----------------------------------------------------------

  /// Questions and answers come in this language.
  void setLanguage(ContentLanguage language) {
    if (language == _language) return;
    _language = language;
    if (hasRoom) {
      _stopChannel();
      refresh();
    }
  }

  /// Opens a room for a game of [categoryIds] (in board order) and [teams]:
  /// picks each category's next unplayed pack and opens the room's lobby,
  /// where players join with its code; [startGame] starts it. Any room this
  /// phone already holds is closed first. Throws [StartProblem] or
  /// [ApiError].
  Future<void> openRoom({
    required List<String> categoryIds,
    required List<String> teams,
    Map<String, String> names = const {},
  }) async {
    assert(categoryIds.length == 6 && teams.length == 2);
    final auth = _session.auth;
    if (auth == null) throw const SignInNeeded();
    _setBusy(true);
    try {
      if (hasRoom) await _leaveHeld();
      final packs = await Future.wait([
        for (final id in categoryIds) _api.firstPack(id, auth, _language),
      ]);
      final missing = [
        for (final (i, id) in categoryIds.indexed)
          if (packs[i] == null) id,
      ];
      if (missing.isNotEmpty) {
        final any = await Future.wait([
          for (final id in missing)
            _api.firstPack(id, auth, _language, freshOnly: false),
        ]);
        throw NoPackLeft(
          played: [
            for (final (i, id) in missing.indexed)
              if (any[i] != null) names[id] ?? id,
          ],
          empty: [
            for (final (i, id) in missing.indexed)
              if (any[i] == null) names[id] ?? id,
          ],
        );
      }
      final selections = [
        for (final (i, id) in categoryIds.indexed)
          {
            'boardPosition': i + 1,
            'categoryId': id,
            'packId': packs[i]!.id,
            'observedRevision': packs[i]!.contentRevision,
          },
      ];
      await _create(auth, teams, selections);
      _board = null;
      _snapshot = null;
      _actorReady.clear();
      _save();
      await refresh();
    } finally {
      _setBusy(false);
    }
  }

  /// Starts the game from the lobby, once every player who joined is ready.
  Future<void> startGame() async {
    final snapshot = _snapshot;
    if (_busy || _room == null || snapshot?.view is! LobbyView) return;
    _setBusy(true);
    try {
      await _startFrom(snapshot!);
      await refresh();
    } on ApiError catch (e) {
      _report(e);
      if (e.conflict) await refresh();
    } finally {
      _setBusy(false);
    }
  }

  // ---- Players ---------------------------------------------------------------

  /// What [code] opens, before joining. Throws [ApiError].
  Future<InvitationPreview> preview(String code) =>
      _api.previewInvitation(code);

  /// Joins the room of [code] as [name] on [team] (0 or 1). A room this
  /// phone holds is left first. The key and seat secret are saved before
  /// sending, so a retry after a lost answer recovers the same seat.
  /// Throws [ApiError].
  Future<void> join({
    required String code,
    required String name,
    required int team,
  }) async {
    _setBusy(true);
    try {
      if (hasRoom) await _leaveHeld();
      final signature = jsonEncode([code, name, team]);
      Map<String, dynamic>? pending;
      try {
        final raw = _prefs?.getString(_pendingJoinKey);
        if (raw != null) pending = jsonDecode(raw) as Map<String, dynamic>;
      } on Object {
        pending = null;
      }
      if (pending?['signature'] != signature) {
        pending = {
          'signature': signature,
          'operationId': newOperationId(),
          'secret': newSecret(),
        };
        _prefs?.setString(_pendingJoinKey, jsonEncode(pending));
      }
      final receipt = await _api.join(
        code,
        pending!['operationId'] as String,
        displayName: name,
        teamNumber: team + 1,
        reconnectSecret: pending['secret'] as String,
      );
      _prefs?.remove(_pendingJoinKey);
      _removed = false;
      _seat = _GuestSeat(
        roomId: receipt.roomId,
        code: code,
        membershipId: receipt.membershipId!,
        secret: pending['secret'] as String,
        displayName: name,
      );
      _board = null;
      _snapshot = null;
      _save();
      await refresh();
    } finally {
      _setBusy(false);
    }
  }

  /// Moves this player to team [team] (0 or 1) in the lobby.
  Future<void> setTeam(int team) async {
    final me = this.me;
    final lobby = this.lobby;
    final seat = _seat;
    if (me == null || lobby == null || seat == null) return;
    if (me.teamNumber == team + 1) return;
    await _player(
      'team:$team:${me.memberVersion}:${lobby.readyGeneration}',
      (key) => _api.setTeam(
        seat.roomId,
        seat.auth,
        key,
        memberVersion: me.memberVersion,
        readyGeneration: lobby.readyGeneration,
        teamNumber: team + 1,
      ),
    );
  }

  /// Says (or takes back) that this player is ready to start.
  Future<void> toggleReady() async {
    final me = this.me;
    final lobby = this.lobby;
    final seat = _seat;
    if (me == null || lobby == null || seat == null) return;
    await _player(
      'ready:${!me.ready}:${me.memberVersion}:${lobby.readyGeneration}',
      (key) => _api.setReady(
        seat.roomId,
        seat.auth,
        key,
        memberVersion: me.memberVersion,
        readyGeneration: lobby.readyGeneration,
        ready: !me.ready,
      ),
    );
  }

  /// The host removes a player from the lobby. Their phone hears it at
  /// once; they can join again with the code.
  Future<void> removePlayer(String membershipId) async {
    final room = _room;
    final auth = _hostAuth;
    final snapshot = _snapshot;
    if (room == null || auth == null || snapshot?.view is! LobbyView) return;
    await _player(
      'remove:$membershipId:${snapshot!.roomVersion}',
      (key) => _api.removeMember(
        room.roomId,
        auth,
        key,
        membershipId: membershipId,
        roomVersion: snapshot.roomVersion,
      ),
    );
  }

  /// Leaves the room this phone holds: a player's seat is given up; a
  /// host's room is closed.
  Future<void> leaveRoom() async {
    await _leaveHeld();
    _notify();
  }

  Future<void> _player(
    String signature,
    Future<Receipt> Function(String key) action,
  ) async {
    if (_busy) return;
    final key = _keys.putIfAbsent(signature, newOperationId);
    _setBusy(true);
    try {
      await action(key);
      _keys.remove(signature);
      await refresh();
    } on ApiError catch (e) {
      _report(e);
      _onError(e);
      if (e.conflict) await refresh();
    } finally {
      _setBusy(false);
    }
  }

  Future<void> _leaveHeld() async {
    final seat = _seat;
    if (seat == null) return _closeHeld();
    _forget();
    try {
      await _api.leave(seat.roomId, seat.auth, newOperationId());
    } on ApiError {
      // Gone already, or unreachable.
    }
  }

  /// Fetches the room as it is now, and keeps its live updates coming.
  Future<void> refresh() async {
    final roomId = _roomId;
    final auth = _auth;
    if (roomId == null || auth == null) return;
    try {
      final snapshot = await _api.getRoom(roomId, auth, _language);
      if (_roomId != roomId) return;
      _accept(snapshot);
      _ensureChannel();
    } on ApiError catch (e) {
      if (_roomId != roomId) return;
      _onError(e, fetching: true);
    }
  }

  /// Deliberate early ending: the scores lock on the server.
  Future<void> end() => _send({'name': 'end_game'});

  /// Closes the room on the server and forgets it (after the results, or
  /// to start fresh).
  Future<void> discard() async {
    if (!hasRoom) return;
    await _leaveHeld();
    _notify();
  }

  /// Another device took control: take it back on this phone.
  Future<void> takeControl() async {
    final room = _room;
    final auth = _session.auth;
    if (room == null || auth == null) return;
    _setBusy(true);
    try {
      final status = await _api.controlStatus(room.roomId, auth);
      final secret = newSecret();
      final receipt = await _api.takeControl(
        room.roomId,
        auth,
        newOperationId(),
        expectedGeneration: status.roomControllerGeneration,
        controlSecret: secret,
      );
      room
        ..controlSecret = secret
        ..generation = receipt.controllerGeneration ?? room.generation;
      _controlLost = false;
      _save();
      _stopChannel();
      await refresh();
    } on ApiError catch (e) {
      _report(e);
    } finally {
      _setBusy(false);
    }
  }

  // ---- Questions -------------------------------------------------------------

  /// Opens question [id] on the server (or reopens it with its time, stage
  /// and reveal kept).
  Future<void> open(String id) async {
    if (viewOf(id) != null) return;
    final (board, question) = _pointer(id) ?? (0, 0);
    if (board == 0) return;
    await _send({
      'name': 'open_question',
      'boardPosition': board,
      'questionPosition': question,
    });
  }

  /// Back to the board, the question's time and hints kept.
  Future<void> leave() async {
    final view = _snapshot?.view;
    if (view is! QuestionView) return;
    if (!view.controls.contains('return_to_board')) return;
    await _question('return_to_board', view);
  }

  void toggleTimer(String id) {
    final view = viewOf(id);
    if (view == null) return;
    switch (timerStatus(progressOf(id))) {
      case TimerStatus.running:
        _question('pause_timer', view);
      case TimerStatus.paused:
        _question('resume_timer', view);
      case TimerStatus.elapsed:
        _question('reset_timer', view);
      case TimerStatus.ready:
        break; // The server starts the clock (memory: on the first hide).
    }
  }

  /// A fresh full clock; hints and reveal are kept.
  void resetTimer(String id) => _on(id, 'reset_timer');

  /// The actor has the card: a fresh minute starts now.
  void startActing(String id) {
    _actorReady.add(id);
    notifyListeners();
    final view = viewOf(id);
    if (view == null) return;
    if (view.controls.contains('reset_timer')) {
      _question('reset_timer', view);
    } else if (view.controls.contains('resume_timer')) {
      _question('resume_timer', view);
    }
  }

  /// Timeout never reveals by itself; the host decides.
  Future<void> reveal(String id) => _on(id, 'reveal_answer');

  /// Makes a staged picture clearer; the answer is now worth less.
  void advanceStage(String id) => _on(id, 'advance_hint');

  void showMemory(String id) => _on(id, 'show_memory');

  /// The first hide asks the question and starts the clock.
  void hideMemory(String id) => _on(id, 'hide_memory');

  /// Resolves [id] for [team] (0/1) at the current value, or for nobody,
  /// revealing it first if it wasn't; then the other team picks. The 36th
  /// resolution finishes the game.
  Future<void> award(String id, int? team) async {
    var view = viewOf(id);
    if (view == null) return;
    if (!view.revealed) {
      if (!await _question('reveal_answer', view)) return;
      view = viewOf(id);
      if (view == null || !view.revealed) return;
    }
    final ok = await _question('resolve_question', view, {
      'winningTeamNumber': team == null ? null : team + 1,
    });
    if (ok && _room != null) {
      _room!.turn = 1 - _room!.turn;
      _save();
      notifyListeners();
    }
  }

  /// The host hands the next pick to the other team.
  void switchTurn() {
    final room = _room;
    if (room == null || !hasActiveGame) return;
    room.turn = 1 - room.turn;
    _save();
    notifyListeners();
  }

  /// Manual correction to a nonnegative total. Question awards stay as
  /// they were.
  Future<void> setScore(int team, int total) async {
    if (total < 0 || !hasActiveGame) return;
    await _send({
      'name': 'adjust_score',
      'teamNumber': team + 1,
      'targetTotal': '$total',
    });
  }

  // ---- Internals -------------------------------------------------------------

  String? get _roomId => _room?.roomId ?? _seat?.roomId;

  /// The host's proof, or the player's seat.
  Auth? get _auth => _hostAuth ?? _seat?.auth;

  HostAuth? get _hostAuth {
    final room = _room;
    final credential = _session.credential;
    if (room == null || credential == null) return null;
    return HostAuth(
      credential: credential,
      controlSecret: room.controlSecret,
      generation: room.generation,
    );
  }

  (String, int) _split(String id) {
    final dash = id.lastIndexOf('-');
    return (id.substring(0, dash), int.parse(id.substring(dash + 1)));
  }

  String? _idFor(int boardPosition, int questionPosition) {
    final board = _board?.board;
    if (board == null) return null;
    for (final c in board) {
      if (c.boardPosition == boardPosition) {
        return '${c.categoryId}-${questionPosition - 1}';
      }
    }
    return null;
  }

  (int, int)? _pointer(String id) {
    final (categoryId, row) = _split(id);
    for (final c in _board?.board ?? const <BoardCategory>[]) {
      if (c.categoryId == categoryId) return (c.boardPosition, row + 1);
    }
    return null;
  }

  Tile? _tile(String id) {
    final (categoryId, row) = _split(id);
    for (final c in _board?.board ?? const <BoardCategory>[]) {
      if (c.categoryId != categoryId) continue;
      for (final t in c.tiles) {
        if (t.questionPosition == row + 1) return t;
      }
    }
    return null;
  }

  static Color? _color(String? hex) {
    if (hex == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(hex)) {
      return null;
    }
    return Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));
  }

  Future<void> _on(String id, String command) async {
    final view = viewOf(id);
    if (view != null) await _question(command, view);
  }

  Future<bool> _question(
    String command,
    QuestionView view, [
    Map<String, Object?> extra = const {},
  ]) => _send({
    'name': command,
    'boardPosition': view.boardPosition,
    'questionPosition': view.questionPosition,
    ...extra,
  });

  /// Sends one host command against the game version on screen. One at a
  /// time; the same command against the same state keeps its key, so a
  /// retry after a lost answer is the same operation.
  Future<bool> _send(Map<String, Object?> command) async {
    final gameId = _snapshot?.gameId;
    final version = _snapshot?.gameVersion;
    final auth = _hostAuth;
    if (_busy || gameId == null || version == null || auth == null) {
      return false;
    }
    final body = {...command, 'expectedGameVersion': version};
    final signature = jsonEncode(body);
    final key = _keys.putIfAbsent(signature, newOperationId);
    _setBusy(true);
    try {
      await _api.command(gameId, auth, key, body);
      _keys.remove(signature);
      await refresh();
      return true;
    } on ApiError catch (e) {
      _report(e);
      _onError(e);
      if (e.conflict) await refresh();
      return false;
    } finally {
      _setBusy(false);
    }
  }

  /// Creates the room. The key and control secret are saved before
  /// sending, so a retry after a lost answer recovers the same room.
  Future<Receipt> _create(
    AccountAuth auth,
    List<String> teams,
    List<Map<String, Object>> selections,
  ) async {
    final signature = jsonEncode([teams, selections]);
    Map<String, dynamic>? pending;
    try {
      final raw = _prefs?.getString(_pendingKey);
      if (raw != null) pending = jsonDecode(raw) as Map<String, dynamic>;
    } on Object {
      pending = null;
    }
    if (pending?['signature'] != signature) {
      pending = {
        'signature': signature,
        'operationId': newOperationId(),
        'controlSecret': newSecret(),
      };
      _prefs?.setString(_pendingKey, jsonEncode(pending));
    }
    Receipt receipt;
    try {
      receipt = await _api.createRoom(
        auth,
        pending!['operationId'] as String,
        teamNames: teams,
        selections: selections,
        controlSecret: pending['controlSecret'] as String,
      );
    } on ApiError catch (e) {
      final existing = e.body?['existingRoomId'] as String?;
      if (e.code != 'ROOM_ALREADY_OPEN' || existing == null) rethrow;
      // An open room from another device (or a lost install): close it,
      // then open this one.
      await _closeOther(existing, auth);
      _prefs?.remove(_pendingKey);
      return _create(auth, teams, selections);
    }
    _prefs?.remove(_pendingKey);
    _seat = null;
    _removed = false;
    _room = _HostRoom(
      roomId: receipt.roomId,
      controlSecret: pending['controlSecret'] as String,
      generation: receipt.controllerGeneration ?? '0',
    );
    _controlLost = false;
    return receipt;
  }

  /// Takes control of a room this account left open elsewhere and closes it.
  Future<void> _closeOther(String roomId, AccountAuth auth) async {
    final status = await _api.controlStatus(roomId, auth);
    final secret = newSecret();
    final receipt = await _api.takeControl(
      roomId,
      auth,
      newOperationId(),
      expectedGeneration: status.roomControllerGeneration,
      controlSecret: secret,
    );
    final host = HostAuth(
      credential: auth.credential,
      controlSecret: secret,
      generation:
          receipt.controllerGeneration ?? status.roomControllerGeneration,
    );
    final room = await _api.getRoom(roomId, host, _language);
    await _api.closeRoom(roomId, host, newOperationId(), room.roomVersion);
  }

  Future<void> _startFrom(Snapshot lobby) async {
    final view = lobby.view;
    if (view is! LobbyView) return;
    final signature = 'start:${lobby.roomVersion}:${view.readyGeneration}';
    final key = _keys.putIfAbsent(signature, newOperationId);
    await _api.startGame(
      _room!.roomId,
      _hostAuth!,
      key,
      roomVersion: lobby.roomVersion,
      readyGeneration: view.readyGeneration,
    );
    _keys.remove(signature);
  }

  /// Closes the room this phone holds (best effort) and forgets it.
  Future<void> _closeHeld() async {
    final room = _room;
    final auth = _hostAuth;
    _forget();
    if (room == null || auth == null) return;
    try {
      final snapshot = await _api.getRoom(room.roomId, auth, _language);
      await _api.closeRoom(
        room.roomId,
        auth,
        newOperationId(),
        snapshot.roomVersion,
      );
    } on ApiError {
      // Gone already, or unreachable: the server expires idle rooms.
    }
  }

  /// A snapshot from a request or the socket, unless it's older than what's
  /// on screen.
  void _accept(Snapshot snapshot) {
    if (isStale(_snapshot, snapshot)) return;
    _apply(snapshot);
  }

  void _apply(Snapshot snapshot) {
    _offset = snapshot.serverTime.difference(_now());
    _snapshot = snapshot;
    final view = snapshot.view;
    if (view is BoardView) {
      _board = view;
      _room?.board = _boardJson(view);
      _seat?.board = _boardJson(view);
      _save();
    }
    if (view is LobbyView && _room != null && _invitation == null) {
      _fetchInvitation();
    }
    _syncMedia(view is QuestionView ? view : null);
    _notify();
    // Restored mid-question without a board (an older save): go back to
    // the board to learn it.
    if (_board == null && view is QuestionView && _room != null) {
      _question('return_to_board', view);
    }
  }

  Future<void> _fetchInvitation() async {
    final room = _room;
    final auth = _hostAuth;
    if (room == null || auth == null) return;
    try {
      final invitation = await _api.invitation(room.roomId, auth);
      if (_room != room) return;
      _invitation = invitation;
      _notify();
    } on ApiError catch (e) {
      _report(e);
    }
  }

  // ---- Live updates ------------------------------------------------------------

  void _ensureChannel() {
    final roomId = _roomId;
    if (_channel != null || _disposed || roomId == null || _replaced) return;
    final channel = RoomChannel(
      url: _api.realtimeUrl,
      roomId: roomId,
      language: _language,
      credentials: _credentials,
      onState: (snapshot) {
        if (_roomId == roomId) _accept(snapshot);
      },
      onStatus: _onChannel,
      onPresence: (connected) {
        _connected = connected;
        _notify();
      },
      onReconnected: refresh,
      connect: _connect,
    );
    _channel = channel;
    channel.start();
  }

  ({String authorization, String? controllerSecret}) _credentials() {
    final host = _hostAuth;
    if (host != null) {
      return (authorization: host.bearer, controllerSecret: host.controlSecret);
    }
    return (authorization: _seat?.auth.bearer ?? '', controllerSecret: null);
  }

  void _onChannel(ChannelStatus status) {
    switch (status) {
      case ChannelStatus.controlLost:
        _controlLost = true;
        _channel = null;
      case ChannelStatus.closed:
        _forget();
      case ChannelStatus.revoked:
        _forget();
        _removed = true;
      case ChannelStatus.replaced:
        _replaced = true;
        _channel = null;
      case ChannelStatus.failed:
        _channel = null;
      default:
        return;
    }
    _notify();
  }

  void _stopChannel() {
    _channel?.stop();
    _channel = null;
    _connected = const {};
  }

  void _onError(ApiError e, {bool fetching = false}) {
    switch (e.code) {
      case 'MEMBERSHIP_REVOKED' || 'PARTICIPATION_ENDED':
        _forget();
        _removed = e.code == 'MEMBERSHIP_REVOKED';
        _notify();
      case 'CONTROLLER_FENCED' || 'FRESH_CONTROL_SECRET_REQUIRED':
        _controlLost = true;
        _notify();
      case 'ROOM_CLOSED' || 'ROOM_EXPIRED' || 'GAME_EXPIRED' || 'NOT_FOUND':
        _forget();
        _notify();
      default:
        if (e.status == 410 || (fetching && e.status == 404)) {
          _forget();
          _notify();
        } else if (e.identityRejected && e.status == 401) {
          // A player's seat proof refused: the seat is gone.
          if (_seat != null) {
            _forget();
            _notify();
          } else {
            _session.signOut();
          }
        } else if (fetching) {
          _report(e);
        }
    }
  }

  void _report(ApiError e) {
    _problem = e;
    _problemCount++;
    _notify();
  }

  void _forget() {
    _stopChannel();
    _room = null;
    _seat = null;
    _snapshot = null;
    _board = null;
    _invitation = null;
    _controlLost = false;
    _replaced = false;
    _removed = false;
    _actorReady.clear();
    _syncMedia(null);
    _prefs?.remove(roomKey);
    _prefs?.remove(seatKey);
  }

  void _save() {
    final room = _room;
    final seat = _seat;
    if (room != null) _prefs?.setString(roomKey, jsonEncode(room.toJson()));
    if (seat != null) _prefs?.setString(seatKey, jsonEncode(seat.toJson()));
  }

  void _setBusy(bool busy) {
    _busy = busy;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  /// Fetches links for the open question's pictures and clips. Held in
  /// memory only; a clip renews its link before it plays
  /// ([freshMediaUrl]).
  void _syncMedia(QuestionView? view) {
    final refs = <MediaRef>{
      ?view?.question.image,
      ?view?.question.clue,
      ?view?.question.audio,
      ?view?.answer?.image,
      ?view?.answer?.forwardAudio,
    };
    final set = (refs.map((r) => r.key).toList()..sort()).join('|');
    if (set == _mediaSet) return;
    _mediaSet = set;
    _mediaRefs = refs.toList();
    _mediaUntil = null;
    // Keep the links still in use; drop the rest.
    final keys = refs.map((r) => r.key).toSet();
    _urls.removeWhere((k, _) => !keys.contains(k));
    _images.removeWhere((k, _) => !keys.contains(k));
    if (refs.isNotEmpty) _fetchMedia(_mediaRefs, set);
  }

  Future<void> _fetchMedia(List<MediaRef> refs, String set) async {
    final gameId = _snapshot?.gameId;
    final auth = _auth;
    if (refs.isEmpty || gameId == null || auth == null) return;
    // Twice more after a failure, then say so.
    for (var tries = 0; ; tries++) {
      try {
        final links = await _api.mediaAccess(gameId, auth, refs);
        if (_disposed || set != _mediaSet) return;
        for (final link in links.links) {
          _urls[link.ref.key] = link.url;
        }
        if (links.links.isNotEmpty) {
          final soonest = links.links
              .map((l) => l.expiresAt)
              .reduce((a, b) => a.isBefore(b) ? a : b);
          _mediaUntil = _now().add(soonest.difference(links.serverTime));
        }
        _notify();
        return;
      } on ApiError catch (e) {
        if (_disposed || set != _mediaSet) return;
        if (tries >= 2) {
          _report(e);
          return;
        }
      }
    }
  }

  static Map<String, dynamic> _boardJson(BoardView view) => {
    'phase': 'board',
    'teams': [
      for (final t in view.teams)
        {'number': t.number, 'name': t.name, 'score': '${t.score}'},
    ],
    'board': [
      for (final c in view.board)
        {
          'boardPosition': c.boardPosition,
          'categoryId': c.categoryId,
          'name': c.name,
          'tiles': [
            for (final t in c.tiles)
              {
                'questionPosition': t.questionPosition,
                'basePoints': t.basePoints,
                'state': t.state.name,
                'winningTeamNumber': t.winningTeamNumber,
                'awardedPoints': ?t.awardedPoints,
              },
          ],
        },
    ],
  };

  @override
  void dispose() {
    _disposed = true;
    _stopChannel();
    super.dispose();
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
