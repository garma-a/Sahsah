// Wire types for rooms and games (`/api/v1/rooms`, `/api/v1/games`), after
// the website's `frontend/src/lib/api/types.ts`. Bigints (versions, scores)
// travel as decimal strings and stay strings here.

import 'wire.dart';

int _int(Object? v) => (v as num).toInt();
int? _intOrNull(Object? v) => v == null ? null : (v as num).toInt();

/// A pack of six questions in a category.
class Pack {
  const Pack({
    required this.id,
    required this.categoryId,
    required this.packNumber,
    required this.contentRevision,
  });

  factory Pack.fromJson(Json j) => Pack(
    id: j['id'] as String,
    categoryId: j['categoryId'] as String,
    packNumber: _int(j['packNumber']),
    contentRevision: j['contentRevision'] as String,
  );

  final String id;
  final String categoryId;
  final int packNumber;
  final String contentRevision;
}

/// What a write returns. Only the fields the app reads.
class Receipt {
  const Receipt({
    required this.roomId,
    this.roomVersion,
    this.gameId,
    this.gameVersion,
    this.controllerGeneration,
    this.membershipId,
  });

  factory Receipt.fromJson(Json j) => Receipt(
    roomId: j['roomId'] as String,
    roomVersion: j['roomVersion'] as String?,
    gameId: j['gameId'] as String?,
    gameVersion: j['gameVersion'] as String?,
    controllerGeneration: j['controllerGeneration'] as String?,
    membershipId: j['membershipId'] as String?,
  );

  final String roomId;

  /// Absent from game commands' receipts.
  final String? roomVersion;
  final String? gameId;
  final String? gameVersion;
  final String? controllerGeneration;

  /// A join's new seat.
  final String? membershipId;
}

/// The room's code and link for players to join with.
class Invitation {
  const Invitation({required this.code, required this.joinUrl});

  factory Invitation.fromJson(Json j) =>
      Invitation(code: j['code'] as String, joinUrl: j['joinUrl'] as String);

  /// Six digits.
  final String code;
  final String joinUrl;
}

/// What a code opens, before joining.
class InvitationPreview {
  const InvitationPreview({
    required this.joinable,
    required this.teamNames,
    required this.availableSeats,
    required this.paused,
  });

  factory InvitationPreview.fromJson(Json j) => InvitationPreview(
    joinable: j['joinable'] as bool,
    teamNames: [j['teamOneName'] as String, j['teamTwoName'] as String],
    availableSeats: _int(j['availableSeats']),
    paused: j['admission'] == 'paused',
  );

  final bool joinable;
  final List<String> teamNames;
  final int availableSeats;

  /// The server isn't taking new players right now.
  final bool paused;
}

/// Someone in the lobby: the host or a player.
class Member {
  const Member({
    required this.id,
    required this.displayName,
    required this.teamNumber,
    required this.host,
    required this.memberVersion,
    required this.ready,
  });

  factory Member.fromJson(Json j) => Member(
    id: j['id'] as String,
    displayName: j['displayName'] as String,
    teamNumber: _intOrNull(j['teamNumber']),
    host: j['host'] as bool,
    memberVersion: j['memberVersion'] as String,
    ready: j['ready'] as bool,
  );

  final String id;
  final String displayName;

  /// 1, 2, or null before picking.
  final int? teamNumber;
  final bool host;
  final String memberVersion;
  final bool ready;
}

class CurrentRoom {
  const CurrentRoom({required this.roomId, required this.focus});

  factory CurrentRoom.fromJson(Json j) =>
      CurrentRoom(roomId: j['roomId'] as String, focus: j['focus'] as String);

  final String roomId;

  /// `lobby`, `game` or `result`.
  final String focus;
}

class ControlStatus {
  const ControlStatus({required this.roomControllerGeneration});

  factory ControlStatus.fromJson(Json j) => ControlStatus(
    roomControllerGeneration: j['roomControllerGeneration'] as String,
  );

  final String roomControllerGeneration;
}

class Team {
  const Team({
    required this.number,
    required this.name,
    required this.score,
    this.players = const [],
  });

  factory Team.fromJson(Json j) => Team(
    number: _int(j['number']),
    name: j['name'] as String,
    score: int.tryParse(j['score'].toString()) ?? 0,
    players: [
      for (final p in (j['players'] as List?) ?? const [])
        (p as Json)['displayName'] as String,
    ],
  );

  /// 1 or 2.
  final int number;
  final String name;
  final int score;

  /// The names of the players seated on this team.
  final List<String> players;
}

enum TileState { unopened, opened, revealed, resolved }

class Tile {
  const Tile({
    required this.questionPosition,
    required this.basePoints,
    required this.state,
    this.winningTeamNumber,
    this.awardedPoints,
  });

  factory Tile.fromJson(Json j) => Tile(
    questionPosition: _int(j['questionPosition']),
    basePoints: _int(j['basePoints']),
    state: TileState.values.byName(j['state'] as String),
    winningTeamNumber: _intOrNull(j['winningTeamNumber']),
    awardedPoints: _intOrNull(j['awardedPoints']),
  );

  /// 1–6.
  final int questionPosition;
  final int basePoints;
  final TileState state;

  /// 1, 2, or null for nobody (when resolved).
  final int? winningTeamNumber;
  final int? awardedPoints;
}

class BoardCategory {
  const BoardCategory({
    required this.boardPosition,
    required this.categoryId,
    required this.name,
    required this.tiles,
  });

  factory BoardCategory.fromJson(Json j) => BoardCategory(
    boardPosition: _int(j['boardPosition']),
    categoryId: j['categoryId'] as String,
    name: j['name'] as String,
    tiles: [for (final t in j['tiles'] as List) Tile.fromJson(t as Json)],
  );

  /// 1–6.
  final int boardPosition;
  final String categoryId;
  final String name;
  final List<Tile> tiles;
}

/// A picture or clip of the open question, by role; its link comes from
/// `media-access`.
class MediaRef {
  const MediaRef(this.json);

  final Json json;

  String get kind => json['kind'] as String;
  String get role => json['role'] as String;

  /// Stable across link renewals.
  String get key =>
      '${json['kind']}:${json['boardPosition']}:${json['questionPosition']}:'
      '${json['role']}:${json['variantNumber']}';

  @override
  bool operator ==(Object other) => other is MediaRef && other.key == key;

  @override
  int get hashCode => key.hashCode;
}

MediaRef? _ref(Object? j) => j == null ? null : MediaRef(j as Json);

enum TimerState { ready, running, paused, elapsed }

class GameTimer {
  const GameTimer({
    required this.state,
    required this.remainingMs,
    this.deadlineAt,
  });

  factory GameTimer.fromJson(Json j) => GameTimer(
    state: TimerState.values.byName(j['state'] as String),
    remainingMs: _int(j['remainingMs']),
    deadlineAt: j['deadlineAt'] == null
        ? null
        : DateTime.parse(j['deadlineAt'] as String),
  );

  final TimerState state;
  final int remainingMs;

  /// Server time; only while running.
  final DateTime? deadlineAt;
}

/// The open question as the host sees it, by format.
class QuestionContent {
  const QuestionContent(this.json);

  final Json json;

  /// `STANDARD`, `IMAGE_BLUR`, `IMAGE_ZOOM`, `IMAGE_PERSON`, `IMAGE_COLOR`,
  /// `IMAGE_RIDDLE`, `IMAGE_MEMORY`, `IMAGE_CLUES`, `AUDIO_GUESS`,
  /// `AUDIO_REVERSE`, `AUDIO_VOICE` or `CHARADES`.
  String get format => json['format'] as String;
  String? get prompt => json['prompt'] as String?;
  String? get instruction => json['instruction'] as String?;
  MediaRef? get image => _ref(json['image']);
  MediaRef? get clue => _ref(json['clue']);
  MediaRef? get audio => _ref(json['audio']);
  int? get durationMs => _intOrNull(json['durationMs']);
  String? get hint => json['hint'] as String?;
  int get stageIndex => _intOrNull(json['stageIndex']) ?? 0;
  List<int> get stageSuggestions => [
    for (final v in (json['stageSuggestions'] as List?) ?? const []) _int(v),
  ];

  /// `ready`, `viewing_first`, `recall` or `revisit` (memory only).
  String? get memoryPhase => json['memoryPhase'] as String?;

  /// The page an actor opens to see the charades card (ADR 0019).
  String? get cardUrl => json['cardUrl'] as String?;
}

class AnswerContent {
  const AnswerContent(this.json);

  final Json json;

  String get text => json['text'] as String;
  MediaRef? get image => _ref(json['image']);
  MediaRef? get forwardAudio => _ref(json['forwardAudio']);

  /// `#RRGGBB` for colour questions.
  String? get colorHex => json['colorHex'] as String?;
}

sealed class RoomView {
  const RoomView();

  static RoomView fromJson(Json j) => switch (j['phase']) {
    'lobby' => LobbyView.fromJson(j),
    'board' => BoardView.fromJson(j),
    'question' || 'answer' => QuestionView.fromJson(j),
    'result' => ResultView.fromJson(j),
    final phase => throw FormatException('Unknown phase $phase'),
  };
}

class LobbyView extends RoomView {
  const LobbyView({
    required this.readyGeneration,
    required this.teamNames,
    this.members = const [],
    this.categoryIds = const [],
  });

  factory LobbyView.fromJson(Json j) => LobbyView(
    readyGeneration: _int(j['readyGeneration']),
    teamNames: [j['teamOneName'] as String, j['teamTwoName'] as String],
    members: [
      for (final m in (j['members'] as List?) ?? const [])
        Member.fromJson(m as Json),
    ],
    categoryIds: [
      for (final s
          in ([...((j['selections'] as List?) ?? const [])]..sort(
            (a, b) => _int(
              (a as Json)['boardPosition'],
            ).compareTo(_int((b as Json)['boardPosition'])),
          )))
        (s as Json)['categoryId'] as String,
    ],
  );

  final int readyGeneration;
  final List<String> teamNames;

  /// The host and the players.
  final List<Member> members;

  /// The six categories, in board order.
  final List<String> categoryIds;

  List<Member> get players => [
    for (final m in members)
      if (!m.host) m,
  ];

  /// Every player who joined has said they're ready (none joined counts).
  bool get everyoneReady => players.every((m) => m.ready);
}

List<Team> _teams(Object? j) =>
    [for (final t in j as List) Team.fromJson(t as Json)]
      ..sort((a, b) => a.number.compareTo(b.number));

class BoardView extends RoomView {
  const BoardView({required this.teams, required this.board});

  factory BoardView.fromJson(Json j) => BoardView(
    teams: _teams(j['teams']),
    board: [
      for (final c in j['board'] as List) BoardCategory.fromJson(c as Json),
    ]..sort((a, b) => a.boardPosition.compareTo(b.boardPosition)),
  );

  final List<Team> teams;
  final List<BoardCategory> board;
}

/// An open question (phase `question`) or its revealed answer (`answer`).
class QuestionView extends RoomView {
  const QuestionView({
    required this.revealed,
    required this.boardPosition,
    required this.questionPosition,
    required this.basePoints,
    required this.suggestedPoints,
    required this.teams,
    required this.timer,
    required this.question,
    this.answer,
    required this.controls,
  });

  factory QuestionView.fromJson(Json j) => QuestionView(
    revealed: j['phase'] == 'answer',
    boardPosition: _int(j['boardPosition']),
    questionPosition: _int(j['questionPosition']),
    basePoints: _int(j['basePoints']),
    suggestedPoints: _int(j['suggestedPoints']),
    teams: _teams(j['teams']),
    timer: GameTimer.fromJson(j['timer'] as Json),
    question: QuestionContent(j['question'] as Json),
    answer: j['answer'] == null ? null : AnswerContent(j['answer'] as Json),
    controls: {
      for (final c in (j['controls'] as List?) ?? const []) c as String,
    },
  );

  final bool revealed;
  final int boardPosition;
  final int questionPosition;
  final int basePoints;

  /// What the answer is worth now: the default award, never above
  /// [basePoints].
  final int suggestedPoints;
  final List<Team> teams;
  final GameTimer timer;
  final QuestionContent question;
  final AnswerContent? answer;

  /// The commands the host may send at this exact moment.
  final Set<String> controls;
}

class CategoryResult {
  const CategoryResult({
    required this.boardPosition,
    required this.categoryId,
    required this.name,
    required this.points,
  });

  factory CategoryResult.fromJson(Json j) => CategoryResult(
    boardPosition: _int(j['boardPosition']),
    categoryId: j['categoryId'] as String,
    name: j['name'] as String,
    points: [_int(j['teamOneAwardPoints']), _int(j['teamTwoAwardPoints'])],
  );

  final int boardPosition;
  final String categoryId;
  final String name;

  /// Question awards per team (team 1 first).
  final List<int> points;
}

class ResultView extends RoomView {
  const ResultView({
    required this.teams,
    required this.categories,
    required this.endReason,
  });

  factory ResultView.fromJson(Json j) {
    final r = j['result'] as Json;
    return ResultView(
      teams: _teams(r['teams']),
      categories: [
        for (final c in r['categories'] as List)
          CategoryResult.fromJson(c as Json),
      ]..sort((a, b) => a.boardPosition.compareTo(b.boardPosition)),
      endReason: r['endReason'] as String,
    );
  }

  final List<Team> teams;
  final List<CategoryResult> categories;

  /// `completed`, `host_ended`, `host_left`, `idle_timeout` or
  /// `platform_failure`.
  final String endReason;
}

/// A room as one request sees it.
class Snapshot {
  const Snapshot({
    required this.roomVersion,
    this.gameId,
    this.gameVersion,
    this.gameProjectionVersion,
    required this.serverTime,
    required this.view,
  });

  factory Snapshot.fromJson(Json j) {
    final source = j['source'] as Json;
    return Snapshot(
      roomVersion: source['roomVersion'] as String,
      gameId: source['gameId'] as String?,
      gameVersion: source['gameVersion'] as String?,
      gameProjectionVersion: source['gameProjectionVersion'] as String?,
      serverTime: DateTime.parse(j['serverTime'] as String),
      view: RoomView.fromJson(j['view'] as Json),
    );
  }

  final String roomVersion;
  final String? gameId;
  final String? gameVersion;
  final String? gameProjectionVersion;
  final DateTime serverTime;
  final RoomView view;
}

class MediaLink {
  const MediaLink({
    required this.ref,
    required this.url,
    required this.expiresAt,
  });

  factory MediaLink.fromJson(Json j) => MediaLink(
    ref: MediaRef(j['ref'] as Json),
    url: j['url'] as String,
    expiresAt: DateTime.parse(j['expiresAt'] as String),
  );

  final MediaRef ref;

  /// Signed and short-lived. Never logged or saved.
  final String url;
  final DateTime expiresAt;
}

class MediaLinks {
  const MediaLinks(this.links, this.serverTime);

  factory MediaLinks.fromJson(Json j) => MediaLinks([
    for (final l in j['links'] as List) MediaLink.fromJson(l as Json),
  ], DateTime.parse(j['serverTime'] as String));

  final List<MediaLink> links;
  final DateTime serverTime;
}
