import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/api/game_wire.dart';
import 'package:sahsah_mobile/core/api/room_channel.dart';
import 'package:sahsah_mobile/core/api/wire.dart';

Snapshot snap(String room, {String? game, String? version}) =>
    Snapshot.fromJson({
      'source': {
        'roomVersion': room,
        'gameId': ?game,
        'gameVersion': ?version,
        if (game != null) 'gameProjectionVersion': version,
      },
      'serverTime': '2026-11-23T10:00:00Z',
      'view': {
        'phase': 'lobby',
        'readyGeneration': 1,
        'teamOneName': 'أ',
        'teamTwoName': 'ب',
      },
    });

class _Socket implements RoomSocket {
  final out = StreamController<String>();
  final sent = <Map<String, dynamic>>[];

  void frame(String event, Map<String, Object?> data) =>
      out.add(jsonEncode({'event': event, 'data': data}));

  @override
  Stream<String> get messages => out.stream;

  @override
  void send(String frame) =>
      sent.add(jsonDecode(frame) as Map<String, dynamic>);

  @override
  Future<void> close() => out.close();
}

void main() {
  group('isStale', () {
    test('an older room version never replaces a newer one', () {
      expect(isStale(snap('5'), snap('4')), isTrue);
      expect(isStale(snap('5'), snap('6')), isFalse);
      expect(isStale(null, snap('1')), isFalse);
    });

    test('in one game, the game version decides', () {
      expect(
        isStale(
          snap('3', game: 'g', version: '9'),
          snap('3', game: 'g', version: '8'),
        ),
        isTrue,
      );
      expect(
        isStale(
          snap('3', game: 'g', version: '9'),
          snap('3', game: 'g', version: '9'),
        ),
        isFalse,
      );
    });

    test('a lobby never replaces the game it passed', () {
      expect(isStale(snap('3', game: 'g', version: '1'), snap('3')), isTrue);
      expect(isStale(snap('3'), snap('3', game: 'g', version: '1')), isFalse);
    });
  });

  group('RoomChannel', () {
    late _Socket socket;
    late List<Snapshot> states;
    late List<ChannelStatus> statuses;
    late RoomChannel channel;

    setUp(() {
      socket = _Socket();
      states = [];
      statuses = [];
      channel = RoomChannel(
        url: Uri.parse('ws://api.test/api/v1/realtime'),
        roomId: 'room-1',
        language: ContentLanguage.ar,
        credentials: () =>
            (authorization: 'Bearer secret', controllerSecret: 'control'),
        onState: states.add,
        onStatus: statuses.add,
        connect: (_) async => socket,
      );
    });

    tearDown(() => channel.stop());

    Map<String, Object?> data(int sequence, [String stream = 's1']) => {
      'protocolVersion': 1,
      'streamId': stream,
      'sequence': '$sequence',
      'serverTime': '2026-11-23T10:00:00Z',
    };

    test('signs in with the first frame, then takes pushed states', () async {
      channel.start();
      await pumpEventQueue();
      final auth = socket.sent.single;
      expect(auth['event'], 'authenticate');
      expect((auth['data'] as Map)['roomId'], 'room-1');
      expect((auth['data'] as Map)['controllerSecret'], 'control');

      socket.frame('authenticated', data(0));
      final lobby = snap('2');
      socket.frame('state', {
        ...data(1),
        'source': {'roomVersion': '2'},
        'view': {
          'phase': 'lobby',
          'readyGeneration': 1,
          'teamOneName': 'أ',
          'teamTwoName': 'ب',
        },
      });
      await pumpEventQueue();
      expect(statuses, [ChannelStatus.live]);
      expect(states.single.roomVersion, lobby.roomVersion);
    });

    test('drops repeated and old-stream frames', () async {
      channel.start();
      await pumpEventQueue();
      socket.frame('authenticated', data(5));
      final state = {
        'source': {'roomVersion': '2'},
        'view': {
          'phase': 'lobby',
          'readyGeneration': 1,
          'teamOneName': 'أ',
          'teamTwoName': 'ب',
        },
      };
      socket.frame('state', {...data(5), ...state}); // Not newer.
      socket.frame('state', {...data(6, 'old'), ...state}); // Old stream.
      socket.frame('state', {...data(6), ...state});
      await pumpEventQueue();
      expect(states, hasLength(1));
    });

    test('a refused control proof stops with control lost', () async {
      channel.start();
      await pumpEventQueue();
      socket.frame('protocol_error', {'code': 'CONTROLLER_FENCED'});
      await pumpEventQueue();
      expect(statuses.last, ChannelStatus.controlLost);
    });

    test('the room closing stops the channel', () async {
      channel.start();
      await pumpEventQueue();
      socket.frame('authenticated', data(0));
      socket.frame('room_closed', data(1));
      await pumpEventQueue();
      expect(statuses.last, ChannelStatus.closed);
    });
  });
}
