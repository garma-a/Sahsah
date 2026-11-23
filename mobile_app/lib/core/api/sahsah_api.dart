import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import '../i18n/lang.dart';
import 'game_wire.dart';
import 'problems.dart';
import 'wire.dart';

/// Body of `GET /api/health`, matching the web frontend's `HealthResponse`.
class HealthResponse {
  const HealthResponse({required this.status, required this.service});

  factory HealthResponse.fromJson(Map<String, dynamic> json) {
    return HealthResponse(
      status: json['status'] as String? ?? '',
      service: json['service'] as String? ?? '',
    );
  }

  final String status;
  final String service;

  bool get isOk => status == 'ok';
}

/// Who a request speaks for (the website's `Auth`).
sealed class Auth {
  const Auth();

  /// The `Authorization` header's value, if any.
  String? get bearer;
}

/// Public reads: the catalogue, an invitation's preview.
class NoAuth extends Auth {
  const NoAuth();

  @override
  String? get bearer => null;
}

/// A signed-in host (the preview credential, until real accounts exist).
class AccountAuth extends Auth {
  const AccountAuth(this.credential);

  final String credential;

  @override
  String get bearer => 'Bearer $credential';
}

/// The host running a room from this device: the account, plus the room's
/// control proof (secret and generation) that fences off other devices.
class HostAuth extends Auth {
  const HostAuth({
    required this.credential,
    required this.controlSecret,
    required this.generation,
  });

  final String credential;
  final String controlSecret;
  final String generation;

  @override
  String get bearer => 'Bearer $credential';
}

/// A player's seat in a room, from joining with a code. The secret stays on
/// this phone.
class GuestAuth extends Auth {
  const GuestAuth({required this.membershipId, required this.secret});

  final String membershipId;
  final String secret;

  @override
  String get bearer => 'Bearer g.$membershipId.$secret';
}

/// Something went wrong talking to the API. [code] is the problem's stable
/// code (RFC 9457), or `NETWORK` / `TIMEOUT` / `UNKNOWN` from this side.
class ApiError implements Exception {
  const ApiError(this.status, this.code, {this.body, this.retryAfter});

  /// 0 when no response came back.
  final int status;
  final String code;
  final Map<String, dynamic>? body;

  /// Seconds, from `Retry-After`.
  final int? retryAfter;

  /// The player-facing text, in the app's language.
  String message(LangController lang) => problemMessage(lang, code, status);

  /// The saved sign-in was refused: sign in again.
  bool get identityRejected => isIdentityRejected(code);

  /// 409: the room moved on; take the current state before retrying.
  bool get conflict => status == 409;

  @override
  String toString() => 'ApiError($status, $code)';
}

/// A fresh `Idempotency-Key`: a random UUID v4. The caller keeps one per
/// intent, so a retry after a lost response is the same operation.
String newOperationId([Random? random]) {
  final r = random ?? Random.secure();
  final b = List<int>.generate(16, (_) => r.nextInt(256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  final h = [for (final x in b) x.toRadixString(16).padLeft(2, '0')].join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-'
      '${h.substring(16, 20)}-${h.substring(20)}';
}

/// A 32-byte random secret as unpadded base64url, the shape the API wants
/// for a room's control secret.
String newSecret([Random? random]) {
  final r = random ?? Random.secure();
  final bytes = List<int>.generate(32, (_) => r.nextInt(256));
  return base64Url.encode(bytes).replaceAll('=', '');
}

/// HTTP client for the Sahsah NestJS API, the one the website uses.
class SahsahApi {
  SahsahApi({
    http.Client? client,
    String? baseUrl,
    this.timeout = const Duration(seconds: 15),
  }) : _client = client ?? http.Client(),
       _baseUrl = (baseUrl ?? AppConfig.apiBaseUrl).replaceFirst(
         RegExp(r'/+$'),
         '',
       );

  final http.Client _client;
  final String _baseUrl;
  final Duration timeout;

  String get baseUrl => _baseUrl;

  /// The live updates socket (`/api/v1/realtime`), on the same host.
  Uri get realtimeUrl =>
      Uri.parse('$_baseUrl/v1/realtime'.replaceFirst(RegExp('^http'), 'ws'));

  Future<HealthResponse> getHealth() async =>
      _read(await _request('GET', '/health'), HealthResponse.fromJson);

  // ---- Catalogue ---------------------------------------------------------

  /// Every published category, following the pages (at most 500).
  Future<List<Category>> listCategories(ContentLanguage language) async {
    final items = <Category>[];
    String? cursor;
    do {
      final page = _read(
        await _request(
          'GET',
          '/v1/categories',
          query: {'language': language.name, 'limit': '50', 'cursor': ?cursor},
        ),
        (j) => Page.fromJson(j, Category.fromJson),
      );
      items.addAll(page.items);
      cursor = page.nextCursor;
    } while (cursor != null && items.length < 500);
    return items;
  }

  // ---- Sign-in -----------------------------------------------------------

  /// Signs this device in as a preview host with the shared [passcode], or
  /// renews the [credential] it already holds (ADR 0017).
  Future<PreviewSession> previewSession({
    String? passcode,
    String? credential,
    required String displayName,
  }) async => _read(
    await _request(
      'POST',
      '/v1/preview/sessions',
      body: {
        'passcode': ?passcode,
        'credential': ?credential,
        'displayName': displayName,
      },
    ),
    PreviewSession.fromJson,
  );

  // ---- Packs and rooms ---------------------------------------------------

  /// The first playable pack of [categoryId] this host hasn't played, or
  /// null when none is left ([freshOnly] false: any playable pack).
  Future<Pack?> firstPack(
    String categoryId,
    Auth auth,
    ContentLanguage language, {
    bool freshOnly = true,
  }) async {
    final page = _read(
      await _request(
        'GET',
        '/v1/categories/$categoryId/packs',
        auth: auth,
        query: {
          'language': language.name,
          'limit': '1',
          if (freshOnly) 'freshOnly': 'true',
        },
      ),
      (j) => Page.fromJson(j, Pack.fromJson),
    );
    return page.items.firstOrNull;
  }

  /// Opens a room for [selections] (board position, category, pack and
  /// revision) with no players but the host.
  Future<Receipt> createRoom(
    AccountAuth auth,
    String operationId, {
    required List<String> teamNames,
    required List<Map<String, Object>> selections,
    required String controlSecret,
  }) async => _read(
    await _request(
      'POST',
      '/v1/rooms',
      auth: auth,
      operationId: operationId,
      body: {
        'teamOneName': teamNames[0],
        'teamTwoName': teamNames[1],
        'hostTeamNumber': null,
        'selections': selections,
        'proposedControlSecret': controlSecret,
      },
    ),
    Receipt.fromJson,
  );

  /// The room as the host sees it now: lobby, board, question, answer or
  /// result.
  Future<Snapshot> getRoom(
    String roomId,
    Auth auth,
    ContentLanguage language,
  ) async => _read(
    await _request(
      'GET',
      '/v1/rooms/$roomId',
      auth: auth,
      query: {'language': language.name},
    ),
    Snapshot.fromJson,
  );

  /// The room this account has open, if any.
  Future<CurrentRoom?> currentRoom(AccountAuth auth) async => _read(
    await _request('GET', '/v1/rooms/current', auth: auth),
    (j) => j['room'] == null ? null : CurrentRoom.fromJson(j['room'] as Json),
  );

  Future<Receipt> startGame(
    String roomId,
    HostAuth auth,
    String operationId, {
    required String roomVersion,
    required int readyGeneration,
  }) async => _read(
    await _request(
      'POST',
      '/v1/rooms/$roomId/games',
      auth: auth,
      operationId: operationId,
      body: {
        'expectedRoomVersion': roomVersion,
        'expectedReadyGeneration': readyGeneration,
      },
    ),
    Receipt.fromJson,
  );

  /// One host command (`open_question`, `reveal_answer`, …). [command]
  /// carries its name and expected game version.
  Future<Receipt> command(
    String gameId,
    HostAuth auth,
    String operationId,
    Map<String, Object?> command,
  ) async => _read(
    await _request(
      'POST',
      '/v1/games/$gameId/commands',
      auth: auth,
      operationId: operationId,
      body: command,
    ),
    Receipt.fromJson,
  );

  /// Short-lived signed links for the open question's pictures and clips.
  Future<MediaLinks> mediaAccess(
    String gameId,
    Auth auth,
    List<MediaRef> refs,
  ) async => _read(
    await _request(
      'POST',
      '/v1/games/$gameId/media-access',
      auth: auth,
      body: {
        'refs': [for (final r in refs) r.json],
      },
    ),
    MediaLinks.fromJson,
  );

  Future<Receipt> closeRoom(
    String roomId,
    HostAuth auth,
    String operationId,
    String roomVersion,
  ) async => _read(
    await _request(
      'POST',
      '/v1/rooms/$roomId/closure',
      auth: auth,
      operationId: operationId,
      body: {'expectedRoomVersion': roomVersion},
    ),
    Receipt.fromJson,
  );

  // ---- Players -------------------------------------------------------------

  /// The room's current code and join link (host).
  Future<Invitation> invitation(String roomId, HostAuth auth) async => _read(
    await _request('GET', '/v1/rooms/$roomId/invitation', auth: auth),
    Invitation.fromJson,
  );

  /// What a six-digit [code] opens, before joining.
  Future<InvitationPreview> previewInvitation(String code) async => _read(
    await _request('GET', '/v1/room-invitations/$code'),
    InvitationPreview.fromJson,
  );

  /// Joins with [code] as [displayName] on [teamNumber] (1 or 2). The
  /// [reconnectSecret] becomes this phone's seat proof.
  Future<Receipt> join(
    String code,
    String operationId, {
    required String displayName,
    required int teamNumber,
    required String reconnectSecret,
  }) async => _read(
    await _request(
      'POST',
      '/v1/room-invitations/$code/memberships',
      operationId: operationId,
      body: {
        'identity': 'anonymous',
        'displayName': displayName,
        'teamNumber': teamNumber,
        'reconnectSecret': reconnectSecret,
      },
    ),
    Receipt.fromJson,
  );

  Future<Receipt> setReady(
    String roomId,
    GuestAuth auth,
    String operationId, {
    required String memberVersion,
    required int readyGeneration,
    required bool ready,
  }) async => _read(
    await _request(
      'PUT',
      '/v1/rooms/$roomId/memberships/me/readiness',
      auth: auth,
      operationId: operationId,
      body: {
        'expectedMembershipVersion': memberVersion,
        'expectedReadyGeneration': readyGeneration,
        'ready': ready,
      },
    ),
    Receipt.fromJson,
  );

  Future<Receipt> setTeam(
    String roomId,
    GuestAuth auth,
    String operationId, {
    required String memberVersion,
    required int readyGeneration,
    required int teamNumber,
  }) async => _read(
    await _request(
      'PATCH',
      '/v1/rooms/$roomId/memberships/me',
      auth: auth,
      operationId: operationId,
      body: {
        'expectedMembershipVersion': memberVersion,
        'expectedReadyGeneration': readyGeneration,
        'teamNumber': teamNumber,
      },
    ),
    Receipt.fromJson,
  );

  /// A player leaves the room.
  Future<Receipt> leave(
    String roomId,
    GuestAuth auth,
    String operationId,
  ) async => _read(
    await _request(
      'POST',
      '/v1/rooms/$roomId/memberships/me/departure',
      auth: auth,
      operationId: operationId,
      body: const <String, Object>{},
    ),
    Receipt.fromJson,
  );

  /// The host removes [membershipId] from the lobby. An anonymous player
  /// can join again with the code.
  Future<Receipt> removeMember(
    String roomId,
    HostAuth auth,
    String operationId, {
    required String membershipId,
    required String roomVersion,
  }) async => _read(
    await _request(
      'POST',
      '/v1/rooms/$roomId/memberships/$membershipId/removal',
      auth: auth,
      operationId: operationId,
      body: {'expectedRoomVersion': roomVersion},
    ),
    Receipt.fromJson,
  );

  Future<ControlStatus> controlStatus(String roomId, AccountAuth auth) async =>
      _read(
        await _request('GET', '/v1/rooms/$roomId/control', auth: auth),
        ControlStatus.fromJson,
      );

  /// Takes control of a room this account owns from another device.
  Future<Receipt> takeControl(
    String roomId,
    AccountAuth auth,
    String operationId, {
    required String expectedGeneration,
    required String controlSecret,
  }) async => _read(
    await _request(
      'POST',
      '/v1/rooms/$roomId/control',
      auth: auth,
      operationId: operationId,
      body: {
        'expectedControllerGeneration': expectedGeneration,
        'proposedControlSecret': controlSecret,
      },
    ),
    Receipt.fromJson,
  );

  // ---- Transport ---------------------------------------------------------

  /// A response body that isn't the shape the contract promises is the
  /// server's fault, reported like any other problem rather than a crash.
  T _read<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parse,
  ) {
    try {
      return parse(json);
    } on TypeError {
      throw const ApiError(200, 'INVALID_RESPONSE');
    } on FormatException {
      throw const ApiError(200, 'INVALID_RESPONSE');
    } on ArgumentError {
      throw const ApiError(200, 'INVALID_RESPONSE');
    }
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Auth auth = const NoAuth(),
    Object? body,
    String? operationId,
    Map<String, String>? query,
  }) async {
    final uri = Uri.parse(
      '$_baseUrl$path',
    ).replace(queryParameters: query == null || query.isEmpty ? null : query);
    final request = http.Request(method, uri)
      ..headers['Accept'] = 'application/json, application/problem+json';
    if (auth.bearer case final bearer?) {
      request.headers['Authorization'] = bearer;
    }
    if (auth is HostAuth) {
      request.headers['X-Control-Secret'] = auth.controlSecret;
      request.headers['X-Controller-Generation'] = auth.generation;
    }
    if (operationId != null) request.headers['Idempotency-Key'] = operationId;
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }

    final http.Response response;
    try {
      response = await http.Response.fromStream(
        await _client.send(request).timeout(timeout),
      ).timeout(timeout);
    } on TimeoutException {
      throw const ApiError(0, 'TIMEOUT');
    } on http.ClientException {
      throw const ApiError(0, 'NETWORK');
    } on Exception {
      // Sockets, TLS and DNS failures all mean "can't reach the server".
      throw const ApiError(0, 'NETWORK');
    }

    // Decode as UTF-8 explicitly; the server may omit the charset.
    Object? decoded;
    try {
      decoded = response.bodyBytes.isEmpty
          ? null
          : jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      decoded = null;
    }
    final json = decoded is Map<String, dynamic> ? decoded : null;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiError(
        response.statusCode,
        json?['code'] as String? ?? 'UNKNOWN',
        body: json,
        retryAfter: int.tryParse(response.headers['retry-after'] ?? ''),
      );
    }
    if (json == null) throw ApiError(response.statusCode, 'INVALID_RESPONSE');
    return json;
  }

  void close() => _client.close();
}
