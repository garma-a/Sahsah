import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'game_wire.dart';
import 'wire.dart';

/// One live socket to the server.
abstract class RoomSocket {
  Stream<String> get messages;
  void send(String frame);
  Future<void> close();
}

typedef RoomSocketConnector = Future<RoomSocket> Function(Uri url);

/// The phone's own WebSocket.
Future<RoomSocket> connectWebSocket(Uri url) async =>
    _IoRoomSocket(await WebSocket.connect(url.toString()));

class _IoRoomSocket implements RoomSocket {
  _IoRoomSocket(this._socket);

  final WebSocket _socket;

  @override
  Stream<String> get messages =>
      _socket.where((m) => m is String).cast<String>();

  @override
  void send(String frame) => _socket.add(frame);

  @override
  Future<void> close() => _socket.close(1000);
}

enum ChannelStatus {
  connecting,
  live,

  /// The socket dropped; the last state stays on screen.
  reconnecting,

  /// The same seat opened on another phone or tab.
  replaced,

  /// Another device took over hosting.
  controlLost,

  /// The host removed this player.
  revoked,

  /// The room was closed or expired.
  closed,

  /// The server refused this phone's proof.
  failed,
}

/// Whether [incoming] describes an older server state than [current]: a
/// late answer or a duplicate frame never replaces newer state (the
/// website's `isStale`).
bool isStale(Snapshot? current, Snapshot incoming) {
  if (current == null) return false;
  final room = BigInt.parse(
    incoming.roomVersion,
  ).compareTo(BigInt.parse(current.roomVersion));
  if (room != 0) return room < 0;
  final have = current.gameId;
  if (have != null && incoming.gameId == have) {
    final game = BigInt.parse(
      incoming.gameVersion ?? '0',
    ).compareTo(BigInt.parse(current.gameVersion ?? '0'));
    if (game != 0) return game < 0;
    return BigInt.parse(
          incoming.gameProjectionVersion ?? '0',
        ).compareTo(BigInt.parse(current.gameProjectionVersion ?? '0')) <
        0;
  }
  // A game replaces its lobby; a lobby never replaces a game it passed.
  return have != null && incoming.gameId == null;
}

/// The room's live updates (`docs/api/realtime-protocol.md`): it signs in
/// with the first frame, then the server pushes the complete current view
/// on every change. Frames from an old stream, duplicates and older states
/// are dropped; after a drop it reconnects with full jitter, and the caller
/// takes a fresh snapshot.
class RoomChannel {
  RoomChannel({
    required this.url,
    required this.roomId,
    required this.language,
    required this.credentials,
    required this.onState,
    required this.onStatus,
    this.onPresence,
    this.onReconnected,
    RoomSocketConnector? connect,
  }) : _connect = connect ?? connectWebSocket;

  final Uri url;
  final String roomId;
  final ContentLanguage language;

  /// `authorization` (and the host's control secret) for the first frame.
  final ({String authorization, String? controllerSecret}) Function()
  credentials;
  final void Function(Snapshot snapshot) onState;
  final void Function(ChannelStatus status) onStatus;

  /// Seats with a live socket.
  final void Function(Set<String> connected)? onPresence;

  /// Back after a drop: changes made meanwhile aren't replayed, so the
  /// caller fetches the room.
  final void Function()? onReconnected;
  final RoomSocketConnector _connect;

  static const _firstDelay = Duration(milliseconds: 500);
  static const _maxDelay = Duration(seconds: 30);

  RoomSocket? _socket;
  StreamSubscription<String>? _subscription;
  Timer? _retry;
  bool _stopped = false;
  bool _connectedBefore = false;
  int _attempt = 0;
  String? _stream;
  BigInt _sequence = BigInt.from(-1);
  ChannelStatus _status = ChannelStatus.connecting;
  final _random = math.Random();

  ChannelStatus get status => _status;

  void start() {
    _stopped = false;
    _open();
  }

  Future<void> stop() async {
    _stopped = true;
    _retry?.cancel();
    await _drop();
  }

  void _set(ChannelStatus status) {
    if (status == _status) return;
    _status = status;
    onStatus(status);
  }

  Future<void> _open() async {
    if (_stopped) return;
    _stream = null;
    final RoomSocket socket;
    try {
      socket = await _connect(url);
    } on Object {
      _reconnect();
      return;
    }
    if (_stopped) {
      socket.close();
      return;
    }
    _socket = socket;
    _subscription = socket.messages.listen(
      (message) {
        if (_socket != socket) return;
        try {
          _handle(jsonDecode(message) as Map<String, dynamic>);
        } on Object {
          // A frame this phone can't read is dropped; the next complete
          // state replaces it.
        }
      },
      onDone: () => _closed(socket),
      onError: (_) => _closed(socket),
      cancelOnError: true,
    );
    final c = credentials();
    socket.send(
      jsonEncode({
        'event': 'authenticate',
        'data': {
          'protocolVersion': 1,
          'roomId': roomId,
          'language': language.name,
          'authorization': c.authorization,
          'controllerSecret': ?c.controllerSecret,
        },
      }),
    );
  }

  void _closed(RoomSocket socket) {
    if (_socket != socket) return;
    _socket = null;
    _subscription = null;
    onPresence?.call(const {});
    _reconnect();
  }

  void _reconnect() {
    if (_stopped) return;
    _set(
      _connectedBefore ? ChannelStatus.reconnecting : ChannelStatus.connecting,
    );
    // Full jitter, 0.5–30 s.
    final ceiling = math.min(
      _maxDelay.inMilliseconds,
      _firstDelay.inMilliseconds * (1 << math.min(_attempt, 10)),
    );
    final delay = math.max(
      _firstDelay.inMilliseconds,
      (_random.nextDouble() * ceiling).round(),
    );
    _attempt++;
    _retry?.cancel();
    _retry = Timer(Duration(milliseconds: delay), _open);
  }

  Future<void> _drop() async {
    final socket = _socket;
    _socket = null;
    await _subscription?.cancel();
    _subscription = null;
    await socket?.close();
  }

  void _stopWith(ChannelStatus status) {
    _stopped = true;
    _retry?.cancel();
    _set(status);
    _drop();
  }

  void _handle(Map<String, dynamic> frame) {
    final event = frame['event'] as String?;
    final data = (frame['data'] as Map<String, dynamic>?) ?? const {};
    if (event == 'protocol_error') {
      // Read before the stream check: a refused sign-in has no stream.
      switch (data['code']) {
        case 'ROOM_CLOSED' || 'ROOM_EXPIRED' || 'GAME_EXPIRED':
          _stopWith(ChannelStatus.closed);
        case 'MEMBERSHIP_REVOKED' || 'PARTICIPATION_ENDED':
          _stopWith(ChannelStatus.revoked);
        case 'CONTROLLER_FENCED' || 'FRESH_CONTROL_SECRET_REQUIRED':
          _stopWith(ChannelStatus.controlLost);
        case 'UNAUTHENTICATED' ||
            'INVALID_PROOF' ||
            'CREDENTIAL_EXPIRED' ||
            'NOT_FOUND':
          _stopWith(ChannelStatus.failed);
        default:
          break; // Capacity, busy, timeouts: the reconnect retries.
      }
      return;
    }
    if (event == 'authenticated') {
      _stream = '${data['streamId']}';
      _sequence = BigInt.parse('${data['sequence']}');
      _attempt = 0;
      _set(ChannelStatus.live);
      if (_connectedBefore) onReconnected?.call();
      _connectedBefore = true;
      return;
    }
    if ('${data['streamId']}' != _stream) return; // An old stream.
    final sequence = BigInt.tryParse('${data['sequence']}');
    if (sequence == null || sequence <= _sequence) return; // Seen already.
    _sequence = sequence;
    switch (event) {
      case 'state':
        onState(Snapshot.fromJson(data));
      case 'presence':
        onPresence?.call({
          for (final m in (data['members'] as List?) ?? const [])
            if ((m as Map)['connected'] == true) '${m['membershipId']}',
        });
      case 'resync_required':
        _socket?.send(jsonEncode({'event': 'resync', 'data': {}}));
        onReconnected?.call();
      case 'stream_replaced':
        _stopWith(ChannelStatus.replaced);
      case 'control_revoked':
        _stopWith(ChannelStatus.controlLost);
      case 'membership_revoked':
        _stopWith(ChannelStatus.revoked);
      case 'room_closed':
        _stopWith(ChannelStatus.closed);
      default:
        break;
    }
  }
}
