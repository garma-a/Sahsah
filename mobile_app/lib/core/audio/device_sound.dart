import 'package:audioplayers/audioplayers.dart';

import 'sound.dart';

/// Plays the effects through the phone. Each sound has its own low-latency
/// player, so a clock tick never cuts a chime short.
class DeviceSound implements SoundBackend {
  final _players = <Sfx, AudioPlayer>{};
  Future<void>? _ready;

  /// Game sounds sit on top of whatever the phone is already playing
  /// instead of stopping it. On iOS they also follow the silent switch;
  /// on Android they use the media volume.
  Future<void> _configure() => AudioPlayer.global.setAudioContext(
    AudioContext(
      android: const AudioContextAndroid(
        contentType: AndroidContentType.sonification,
        usageType: AndroidUsageType.game,
        audioFocus: AndroidAudioFocus.none,
      ),
      iOS: AudioContextIOS(category: AVAudioSessionCategory.ambient),
    ),
  );

  @override
  Future<void> play(Sfx sound) async {
    await (_ready ??= _configure());
    final player = _players.putIfAbsent(sound, AudioPlayer.new);
    await player.stop();
    await player.play(
      AssetSource('sfx/${sound.file}.wav'),
      mode: PlayerMode.lowLatency,
    );
  }

  @override
  Future<void> dispose() async {
    for (final player in _players.values) {
      await player.dispose();
    }
    _players.clear();
  }
}
