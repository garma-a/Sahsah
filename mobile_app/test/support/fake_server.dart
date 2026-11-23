import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';
import 'package:sahsah_mobile/core/session/host_session.dart';
import 'package:sahsah_mobile/features/game/game_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_api.dart';

/// Six categories picked in setup, in board order: a standard pack, one
/// with pictures and stages, memory and clues, audio and charades, and two
/// standard ones.
const fakeBoardNames = [
  'نوستالجيا التسعينات',
  'الكورة المصرية',
  'خمّن الكلمة من الإيموجي',
  'خمّن المكان',
  'سينما الأبيض والأسود',
  'موسيقى مصرية',
];

/// The shared passcode the fake server accepts.
const fakePasscode = '1234';

/// Six question formats per category, in tile order. Categories not listed
/// play six standard questions.
const _formats = {
  'cat-90s': [
    'STANDARD',
    'STANDARD',
    'IMAGE_PERSON',
    'IMAGE_COLOR',
    'IMAGE_BLUR',
    'IMAGE_ZOOM',
  ],
  'cat-emoji': [
    'IMAGE_RIDDLE',
    'IMAGE_RIDDLE',
    'IMAGE_MEMORY',
    'IMAGE_MEMORY',
    'IMAGE_CLUES',
    'IMAGE_CLUES',
  ],
  'cat-places': [
    'AUDIO_GUESS',
    'AUDIO_VOICE',
    'AUDIO_REVERSE',
    'STANDARD',
    'CHARADES',
    'CHARADES',
  ],
};

const _points = [200, 200, 400, 400, 600, 600];

List<int> _stages(int base) => switch (base) {
  600 => [600, 400, 200],
  400 => [400, 250, 150],
  _ => [200, 150, 50],
};

/// The question at [position] (1–6) of [categoryId]'s packs.
({String prompt, String answer}) fakeQuestion(String categoryId, int position) {
  final name = fakeCategories.firstWhere((c) => c['id'] == categoryId)['name'];
  return (
    prompt: 'سؤال $position في $name',
    answer: 'إجابة $position في $name',
  );
}

class _Question {
  _Question(this.format, this.base);

  final String format;
  final int base;
  bool opened = false;
  bool revealed = false;
  bool resolved = false;
  int? winner;
  int? awarded;
  int stage = 0;

  /// ready, viewing_first, recall, revisit (memory only).
  String memory = 'ready';
  bool hiddenOnce = false;

  String timer = 'ready';
  int remainingMs = 60000;
  DateTime? deadline;
  bool navPaused = false;

  bool get staged =>
      const {'IMAGE_BLUR', 'IMAGE_ZOOM', 'IMAGE_CLUES'}.contains(format);

  int get suggested => staged ? _stages(base)[stage] : base;

  /// Running past its deadline reads as elapsed.
  void settle() {
    if (timer == 'running' && !DateTime.now().isBefore(deadline!)) {
      timer = 'elapsed';
      remainingMs = 0;
      deadline = null;
    }
  }

  void run(int ms) {
    timer = 'running';
    remainingMs = ms;
    deadline = DateTime.now().add(Duration(milliseconds: ms));
  }

  void pause() {
    settle();
    if (timer != 'running') return;
    remainingMs = deadline!.difference(DateTime.now()).inMilliseconds;
    if (remainingMs <= 0) {
      timer = 'elapsed';
      remainingMs = 0;
    } else {
      timer = 'paused';
    }
    deadline = null;
  }
}

class FakeRoom {
  FakeRoom({
    required this.id,
    required this.account,
    required this.secret,
    required this.teams,
    required this.selections,
  });

  final String id;
  final String account;
  String secret;
  int generation = 1;
  final List<String> teams;
  final List<Map<String, dynamic>> selections;
  int version = 1;
  bool closed = false;

  // The game, once started.
  String? gameId;
  int gameVersion = 0;
  final scores = [0, 0];
  final questions = <(int, int), _Question>{};
  (int, int)? pointer;
  bool finished = false;
  String endReason = 'completed';
}

/// An in-memory Sahsah API for widget tests: the catalogue, the preview
/// sign-in, rooms and the host commands of `docs/api/question-lifecycle.md`.
class FakeServer {
  FakeServer() {
    api = SahsahApi(
      baseUrl: 'http://api.test/api',
      client: MockClient(_handle),
    );
  }

  late final SahsahApi api;

  /// Requests the next answer fails with no connection.
  bool offline = false;

  /// Every command name, in order.
  final commands = <String>[];

  final _credentials = <String, String>{}; // credential → account
  final _rooms = <String, FakeRoom>{};
  final _played = <String, Set<String>>{}; // account → pack ids
  int _ids = 0;

  FakeRoom? get room => _rooms.values.where((r) => !r.closed).lastOrNull;

  /// A controller over this server, signed in unless [signedIn] is false.
  Future<GameController> game({bool signedIn = true}) async {
    final prefs = await SharedPreferences.getInstance();
    final session = HostSession(api, prefs);
    if (signedIn && !session.signedIn) {
      await session.signIn(passcode: fakePasscode, displayName: 'المضيف');
    }
    return GameController(api: api, session: session, prefs: prefs);
  }

  Future<http.Response> _handle(http.Request request) async {
    if (offline) throw http.ClientException('offline');
    final path = request.url.path.replaceFirst('/api', '');
    final body = request.body.isEmpty
        ? const <String, dynamic>{}
        : jsonDecode(request.body) as Map<String, dynamic>;
    final segments = path.split('/').where((s) => s.isNotEmpty).toList();
    try {
      return switch ((request.method, segments)) {
        ('GET', ['v1', 'categories']) => _json({'items': fakeCategories}),
        ('GET', ['v1', 'categories', final id, 'packs']) => _packs(request, id),
        ('POST', ['v1', 'preview', 'sessions']) => _session(body),
        ('POST', ['v1', 'rooms']) => _create(request, body),
        ('GET', ['v1', 'rooms', 'current']) => _current(request),
        ('GET', ['v1', 'rooms', final id]) => _snapshot(_host(request, id)),
        ('POST', ['v1', 'rooms', final id, 'games']) => _start(
          _host(request, id),
        ),
        ('POST', ['v1', 'rooms', final id, 'closure']) => _close(
          _host(request, id),
        ),
        ('GET', ['v1', 'rooms', final id, 'control']) => _control(request, id),
        ('POST', ['v1', 'rooms', final id, 'control']) => _take(
          request,
          id,
          body,
        ),
        ('POST', ['v1', 'games', final id, 'commands']) => _command(
          _game(request, id),
          body,
        ),
        ('POST', ['v1', 'games', final id, 'media-access']) => _media(
          _game(request, id),
          body,
        ),
        _ => throw const _Problem(404, 'NOT_FOUND'),
      };
    } on _Problem catch (p) {
      return _json({'code': p.code, 'status': p.status, ...p.extra}, p.status);
    }
  }

  // ---- Identity ------------------------------------------------------------

  String _account(http.Request request) {
    final header = request.headers['Authorization'] ?? '';
    final account = _credentials[header.replaceFirst('Bearer ', '')];
    if (account == null) throw const _Problem(401, 'UNAUTHENTICATED');
    return account;
  }

  FakeRoom _host(http.Request request, String roomId) {
    final account = _account(request);
    final room = _rooms[roomId];
    if (room == null || room.account != account) {
      throw const _Problem(404, 'NOT_FOUND');
    }
    if (room.closed) throw const _Problem(410, 'ROOM_CLOSED');
    if (request.headers['X-Control-Secret'] != room.secret ||
        request.headers['X-Controller-Generation'] != '${room.generation}') {
      throw const _Problem(403, 'CONTROLLER_FENCED');
    }
    return room;
  }

  FakeRoom _game(http.Request request, String gameId) {
    final room = _rooms.values.firstWhere(
      (r) => r.gameId == gameId,
      orElse: () => throw const _Problem(404, 'NOT_FOUND'),
    );
    return _host(request, room.id);
  }

  http.Response _session(Map<String, dynamic> body) {
    final held = body['credential'] as String?;
    var account = held == null ? null : _credentials[held];
    if (account == null) {
      if (body['passcode'] != fakePasscode) {
        throw const _Problem(401, 'UNAUTHENTICATED');
      }
      account = 'account-${++_ids}';
    }
    final credential = 'credential-${++_ids}';
    _credentials[credential] = account;
    return _json({
      'credential': credential,
      'expiresAt': DateTime.now()
          .add(const Duration(days: 30))
          .toUtc()
          .toIso8601String(),
      'accountId': account,
      'displayName': body['displayName'],
    });
  }

  // ---- Catalogue and rooms -------------------------------------------------

  http.Response _packs(http.Request request, String categoryId) {
    final account = _account(request);
    final category = fakeCategories.firstWhere((c) => c['id'] == categoryId);
    final packs = [
      for (var n = 1; n <= (category['publishedPackCount']! as int); n++)
        {
          'id': '$categoryId-pack-$n',
          'categoryId': categoryId,
          'packNumber': n,
          'contentRevision': '1',
          'questionCount': 6,
        },
    ];
    final fresh = request.url.queryParameters['freshOnly'] == 'true';
    final played = _played[account] ?? const {};
    return _json({
      'items': [
        for (final p in packs)
          if (!fresh || !played.contains(p['id'])) p,
      ].take(1).toList(),
    });
  }

  http.Response _create(http.Request request, Map<String, dynamic> body) {
    final account = _account(request);
    final open = _rooms.values.where((r) => r.account == account && !r.closed);
    if (open.isNotEmpty) {
      throw _Problem(409, 'ROOM_ALREADY_OPEN', {
        'existingRoomId': open.first.id,
      });
    }
    final room = FakeRoom(
      id: 'room-${++_ids}',
      account: account,
      secret: body['proposedControlSecret'] as String,
      teams: [body['teamOneName'] as String, body['teamTwoName'] as String],
      selections: (body['selections'] as List).cast<Map<String, dynamic>>(),
    );
    _rooms[room.id] = room;
    return _receipt(room);
  }

  http.Response _current(http.Request request) {
    final account = _account(request);
    final open = _rooms.values.where((r) => r.account == account && !r.closed);
    return _json({
      if (open.isNotEmpty)
        'room': {
          'roomId': open.first.id,
          'roomVersion': '${open.first.version}',
          'focus': open.first.gameId == null ? 'lobby' : 'game',
        },
    });
  }

  http.Response _start(FakeRoom room) {
    if (room.gameId != null) throw const _Problem(409, 'GAME_ALREADY_STARTED');
    room
      ..gameId = 'game-${++_ids}'
      ..gameVersion = 1
      ..version += 1;
    for (final s in room.selections) {
      final categoryId = s['categoryId'] as String;
      final formats = _formats[categoryId] ?? List.filled(6, 'STANDARD');
      for (var q = 1; q <= 6; q++) {
        room.questions[(s['boardPosition'] as int, q)] = _Question(
          formats[q - 1],
          _points[q - 1],
        );
      }
      _played.putIfAbsent(room.account, () => {}).add(s['packId'] as String);
    }
    return _receipt(room);
  }

  http.Response _close(FakeRoom room) {
    room
      ..closed = true
      ..version += 1;
    if (room.gameId != null && !room.finished) {
      room
        ..finished = true
        ..endReason = 'host_left';
    }
    return _receipt(room);
  }

  http.Response _control(http.Request request, String roomId) {
    _account(request);
    final room = _rooms[roomId] ?? (throw const _Problem(404, 'NOT_FOUND'));
    return _json({
      'roomId': room.id,
      'roomControllerGeneration': '${room.generation}',
    });
  }

  http.Response _take(
    http.Request request,
    String roomId,
    Map<String, dynamic> body,
  ) {
    final account = _account(request);
    final room = _rooms[roomId] ?? (throw const _Problem(404, 'NOT_FOUND'));
    if (room.account != account) throw const _Problem(404, 'NOT_FOUND');
    room
      ..secret = body['proposedControlSecret'] as String
      ..generation += 1;
    return _receipt(room);
  }

  /// Another device takes the room (the website, say).
  void takeControlElsewhere() {
    final r = room!;
    r
      ..secret = 'elsewhere'
      ..generation += 1;
  }

  // ---- The game ------------------------------------------------------------

  http.Response _command(FakeRoom room, Map<String, dynamic> body) {
    final name = body['name'] as String;
    commands.add(name);
    if (room.finished) throw const _Problem(409, 'GAME_FINISHED');
    if (body['expectedGameVersion'] != '${room.gameVersion}') {
      throw const _Problem(409, 'STALE_GAME_VERSION');
    }
    final at = body['boardPosition'] == null
        ? null
        : (body['boardPosition'] as int, body['questionPosition'] as int);
    final q = at == null ? null : room.questions[at];
    void must(bool ok) {
      if (!ok) throw const _Problem(409, 'INVALID_TRANSITION');
    }

    void current() => must(q != null && room.pointer == at && !q.resolved);
    q?.settle();
    switch (name) {
      case 'open_question':
        must(q != null && room.pointer == null && !q.resolved);
        if (!q!.opened) {
          q.opened = true;
          if (q.format != 'IMAGE_MEMORY') q.run(60000);
        } else if (q.navPaused && q.timer == 'paused') {
          q.run(q.remainingMs);
        }
        q.navPaused = false;
        room.pointer = at;
      case 'return_to_board':
        current();
        if (q!.timer == 'running') {
          q.pause();
          q.navPaused = q.timer == 'paused';
        }
        room.pointer = null;
      case 'advance_hint':
        current();
        must(q!.staged && !q.revealed && q.stage < 2);
        q.stage++;
      case 'show_memory':
        current();
        must(q!.format == 'IMAGE_MEMORY' && !q.revealed);
        q.memory = q.hiddenOnce ? 'revisit' : 'viewing_first';
      case 'hide_memory':
        current();
        must(
          q!.format == 'IMAGE_MEMORY' &&
              !q.revealed &&
              (q.memory == 'viewing_first' || q.memory == 'revisit'),
        );
        if (!q.hiddenOnce) {
          q.hiddenOnce = true;
          q.run(60000);
        }
        q.memory = 'recall';
      case 'pause_timer':
        current();
        must(!q!.revealed && q.timer == 'running');
        q.pause();
      case 'resume_timer':
        current();
        must(!q!.revealed && q.timer == 'paused' && q.remainingMs > 0);
        q.run(q.remainingMs);
      case 'reset_timer':
        current();
        must(!q!.revealed && q.timer != 'ready');
        q.run(60000);
      case 'reveal_answer':
        current();
        must(!q!.revealed && (q.format != 'IMAGE_MEMORY' || q.hiddenOnce));
        q
          ..pause()
          ..revealed = true
          ..navPaused = false;
      case 'resolve_question':
        current();
        must(q!.revealed);
        final winner = body['winningTeamNumber'] as int?;
        final points = winner == null
            ? 0
            : (body['awardedPoints'] as int? ?? q.suggested);
        q
          ..resolved = true
          ..winner = winner
          ..awarded = points;
        if (winner != null) room.scores[winner - 1] += points;
        room.pointer = null;
        if (room.questions.values.every((q) => q.resolved)) {
          room.finished = true;
        }
      case 'adjust_score':
        room.scores[(body['teamNumber'] as int) - 1] = int.parse(
          body['targetTotal'] as String,
        );
      case 'end_game':
        room
          ..finished = true
          ..endReason = 'host_ended'
          ..pointer = null;
      default:
        throw const _Problem(400, 'INVALID_INPUT');
    }
    room.gameVersion++;
    // A game command's receipt names the game, not the room's version.
    return _json({
      'operationId': 'op-${++_ids}',
      'roomId': room.id,
      'gameId': room.gameId,
      'gameVersion': '${room.gameVersion}',
      'acceptedAt': DateTime.now().toUtc().toIso8601String(),
      'effect': 'changed',
    });
  }

  http.Response _media(FakeRoom room, Map<String, dynamic> body) {
    final now = DateTime.now().toUtc();
    return _json({
      'serverTime': now.toIso8601String(),
      'links': [
        for (final ref in body['refs'] as List)
          {
            'ref': ref,
            'url':
                'https://media.test/${(ref as Map)['role']}-${ref['boardPosition']}-${ref['questionPosition']}-${ref['variantNumber']}',
            'expiresAt': now.add(const Duration(minutes: 10)).toIso8601String(),
            'contentType': 'image/webp',
            'byteSize': '100',
          },
      ],
    });
  }

  // ---- Views ----------------------------------------------------------------

  http.Response _snapshot(FakeRoom room) {
    final now = DateTime.now().toUtc();
    final view = room.gameId == null
        ? _lobby(room)
        : room.finished
        ? _result(room)
        : room.pointer == null
        ? _board(room)
        : _question(room, room.pointer!);
    return _json({
      'source': {
        'roomVersion': '${room.version}',
        if (room.gameId != null) ...{
          'gameId': room.gameId,
          'gameVersion': '${room.gameVersion}',
          'gameProjectionVersion': '${room.gameVersion}',
        },
      },
      'serverTime': now.toIso8601String(),
      'language': 'ar',
      'view': view,
    });
  }

  Map<String, Object?> _lobby(FakeRoom room) => {
    'phase': 'lobby',
    'audience': 'host',
    'roomId': room.id,
    'teamOneName': room.teams[0],
    'teamTwoName': room.teams[1],
    'members': const [],
    'selections': room.selections,
    'readyGeneration': 0,
    'idleExpiresAt': DateTime.now().toUtc().toIso8601String(),
  };

  List<Map<String, Object?>> _teams(FakeRoom room) => [
    for (var t = 0; t < 2; t++)
      {'number': t + 1, 'name': room.teams[t], 'score': '${room.scores[t]}'},
  ];

  Map<String, Object?> _board(FakeRoom room) => {
    'phase': 'board',
    'audience': 'host',
    'roomId': room.id,
    'gameId': room.gameId,
    'teams': _teams(room),
    'idleExpiresAt': DateTime.now().toUtc().toIso8601String(),
    'board': [
      for (final s in room.selections)
        {
          'boardPosition': s['boardPosition'],
          'categoryId': s['categoryId'],
          'packId': s['packId'],
          'name': fakeCategories.firstWhere(
            (c) => c['id'] == s['categoryId'],
          )['name'],
          'tiles': [
            for (var q = 1; q <= 6; q++)
              _tile(q, room.questions[(s['boardPosition'] as int, q)]!),
          ],
        },
    ],
  };

  Map<String, Object?> _tile(int position, _Question q) => {
    'questionPosition': position,
    'basePoints': q.base,
    'state': q.resolved
        ? 'resolved'
        : q.revealed
        ? 'revealed'
        : q.opened
        ? 'opened'
        : 'unopened',
    if (q.resolved) 'winningTeamNumber': q.winner,
    if (q.resolved && q.winner != null) 'awardedPoints': q.awarded,
  };

  Map<String, Object?> _ref(
    (int, int) at,
    String role, {
    String kind = 'image',
    int variant = 0,
  }) => {
    'kind': kind,
    'boardPosition': at.$1,
    'questionPosition': at.$2,
    'role': role,
    'variantNumber': variant,
  };

  Map<String, Object?> _question(FakeRoom room, (int, int) at) {
    final q = room.questions[at]!;
    q.settle();
    final categoryId =
        room.selections.firstWhere(
              (s) => s['boardPosition'] == at.$1,
            )['categoryId']
            as String;
    final text = fakeQuestion(categoryId, at.$2);
    final image = _ref(at, 'prompt_image', variant: q.stage);
    final question = <String, Object?>{'format': q.format};
    switch (q.format) {
      case 'IMAGE_MEMORY':
        question['memoryPhase'] = q.memory;
        if (q.memory == 'ready' || q.memory == 'viewing_first') {
          question['instruction'] = 'ركّزوا في الصورة كويس';
        } else {
          question['prompt'] = text.prompt;
        }
        if (q.memory == 'viewing_first' || q.memory == 'revisit') {
          question['image'] = image;
        }
      case 'IMAGE_BLUR' || 'IMAGE_ZOOM' || 'IMAGE_CLUES':
        question.addAll({
          'prompt': text.prompt,
          // Clues keep the picture; blur and zoom show the current stage.
          'image': q.format == 'IMAGE_CLUES' ? _ref(at, 'prompt_image') : image,
          'stageIndex': q.stage,
          'stageSuggestions': _stages(q.base),
          if (q.format == 'IMAGE_CLUES' && q.stage > 0)
            'clue': _ref(at, 'hint_image', variant: q.stage),
        });
      case 'AUDIO_GUESS' || 'AUDIO_REVERSE' || 'AUDIO_VOICE':
        question.addAll({
          'prompt': text.prompt,
          'durationMs': 8000,
          'audio': _ref(at, 'question_audio', kind: 'audio'),
          if (q.format == 'AUDIO_VOICE') 'hint': 'ممثل مشهور',
        });
      case 'CHARADES':
        question.addAll({
          'prompt': 'مثّلوا فيلم',
          'cardUrl': 'https://sa7sa7.test/act/${room.gameId}/${at.$1}/${at.$2}',
        });
      case 'STANDARD':
        question['prompt'] = text.prompt;
        // The first question of a pack comes with a photo.
        if (at.$2 == 1) question['image'] = image;
      default:
        question.addAll({'prompt': text.prompt, 'image': image});
    }
    final controls = <String>[
      'return_to_board',
      'adjust_score',
      'end_game',
      if (!q.revealed) ...[
        if (q.format != 'IMAGE_MEMORY' || q.hiddenOnce) 'reveal_answer',
        if (q.staged && q.stage < 2) 'advance_hint',
        if (q.format == 'IMAGE_MEMORY' &&
            (q.memory == 'ready' || q.memory == 'recall'))
          'show_memory',
        if (q.format == 'IMAGE_MEMORY' &&
            (q.memory == 'viewing_first' || q.memory == 'revisit'))
          'hide_memory',
        if (q.timer == 'running') 'pause_timer',
        if (q.timer == 'paused' && q.remainingMs > 0) 'resume_timer',
        if (q.timer != 'ready') 'reset_timer',
      ] else
        'resolve_question',
    ];
    return {
      'phase': q.revealed ? 'answer' : 'question',
      'audience': 'host',
      'roomId': room.id,
      'gameId': room.gameId,
      'boardPosition': at.$1,
      'questionPosition': at.$2,
      'basePoints': q.base,
      'suggestedPoints': q.suggested,
      'teams': _teams(room),
      'timer': {
        'state': q.timer,
        'remainingMs': q.timer == 'running'
            ? q.deadline!.difference(DateTime.now()).inMilliseconds
            : q.remainingMs,
        if (q.timer == 'running')
          'deadlineAt': q.deadline!.toUtc().toIso8601String(),
      },
      'idleExpiresAt': DateTime.now().toUtc().toIso8601String(),
      'question': question,
      if (q.revealed)
        'answer': {
          'format': q.format,
          'text': text.answer,
          if (q.format.startsWith('IMAGE_') || at.$2 == 1)
            'image': _ref(at, 'answer_image'),
          if (q.format == 'IMAGE_COLOR') 'colorHex': '#C0392B',
          if (q.format == 'AUDIO_REVERSE')
            'forwardAudio': _ref(at, 'answer_audio', kind: 'audio'),
        },
      'controls': controls,
    };
  }

  Map<String, Object?> _result(FakeRoom room) => {
    'phase': 'result',
    'audience': 'host',
    'result': {
      'gameId': room.gameId,
      'roomId': room.id,
      'status': 'finished',
      'endReason': room.endReason,
      'endedAt': DateTime.now().toUtc().toIso8601String(),
      'resolvedQuestionCount': room.questions.values
          .where((q) => q.resolved)
          .length,
      'winningTeamNumber': room.scores[0] == room.scores[1]
          ? null
          : (room.scores[0] > room.scores[1] ? 1 : 2),
      'teams': [
        for (final t in _teams(room))
          {...t, 'questionAwardTotal': 0, 'manualAdjustmentTotal': '0'},
      ],
      'categories': [
        for (final s in room.selections)
          () {
            final b = s['boardPosition'] as int;
            final points = [0, 0];
            for (var q = 1; q <= 6; q++) {
              final question = room.questions[(b, q)]!;
              if (question.resolved && question.winner != null) {
                points[question.winner! - 1] += question.awarded!;
              }
            }
            return {
              'boardPosition': b,
              'categoryId': s['categoryId'],
              'name': fakeCategories.firstWhere(
                (c) => c['id'] == s['categoryId'],
              )['name'],
              'resolvedCount': 0,
              'teamOneAwardPoints': points[0],
              'teamTwoAwardPoints': points[1],
              'winningTeamNumber': null,
            };
          }(),
      ],
    },
  };

  http.Response _receipt(FakeRoom room) => _json({
    'operationId': 'op-${++_ids}',
    'roomId': room.id,
    'roomVersion': '${room.version}',
    if (room.gameId != null) ...{
      'gameId': room.gameId,
      'gameVersion': '${room.gameVersion}',
    },
    'controllerGeneration': '${room.generation}',
    'effect': 'changed',
  });

  http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
    utf8.encode(jsonEncode(body)),
    status,
    headers: {'content-type': 'application/json'},
  );
}

class _Problem implements Exception {
  const _Problem(this.status, this.code, [this.extra = const {}]);

  final int status;
  final String code;
  final Map<String, Object?> extra;
}
