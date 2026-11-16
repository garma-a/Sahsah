import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The game's sound effects (`assets/sfx/<file>.wav`). They are plain
/// synthesized tones from `tool/make_sfx.py`; a real recording with the
/// same file name replaces one.
enum Sfx {
  /// One of the last ten seconds.
  tick('tick'),
  timeUp('time_up'),

  /// A team took the points.
  correct('correct'),

  /// The question was settled with no points.
  nobody('nobody'),

  /// The results screen.
  win('win');

  const Sfx(this.file);

  final String file;
}

/// Something that can play a sound. The app uses the device's audio
/// (`DeviceSound`); tests pass a fake, or none at all.
abstract class SoundBackend {
  Future<void> play(Sfx sound);

  Future<void> dispose();
}

/// Plays the game's sounds and remembers whether the player wants them.
class SoundController extends ChangeNotifier {
  SoundController({
    bool enabled = true,
    SoundBackend? backend,
    SharedPreferences? prefs,
  }) : _enabled = enabled,
       _backend = backend,
       _prefs = prefs;

  static const storageKey = 'sahsah.sound';

  static Future<SoundController> load(SoundBackend backend) async {
    final prefs = await SharedPreferences.getInstance();
    return SoundController(
      enabled: prefs.getBool(storageKey) ?? true,
      backend: backend,
      prefs: prefs,
    );
  }

  final SoundBackend? _backend;
  final SharedPreferences? _prefs;
  bool _enabled;

  bool get enabled => _enabled;

  void setEnabled(bool value) {
    if (value == _enabled) return;
    _enabled = value;
    _prefs?.setBool(storageKey, value);
    notifyListeners();
  }

  /// Fire and forget: a sound that fails to play must never break a game.
  void play(Sfx sound) {
    if (!_enabled) return;
    final backend = _backend;
    if (backend == null) return;
    backend.play(sound).catchError((Object _) {});
  }

  /// The answering clock's sound when [secs] whole seconds are left: a
  /// tick for each of the last ten, nothing before that. (Time-up plays
  /// when the clock actually stops, not here.)
  static Sfx? forSecond(int secs) => secs >= 1 && secs <= 10 ? Sfx.tick : null;

  @override
  void dispose() {
    _backend?.dispose().catchError((Object _) {});
    super.dispose();
  }
}

class SoundScope extends InheritedNotifier<SoundController> {
  const SoundScope({
    super.key,
    required SoundController controller,
    required super.child,
  }) : super(notifier: controller);

  /// The controller, without rebuilding the caller when the setting
  /// changes (safe in `initState` and in callbacks).
  static SoundController of(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<SoundScope>();
    assert(scope != null, 'SoundScope not found');
    return scope!.notifier!;
  }
}

extension SoundContext on BuildContext {
  SoundController get sound => SoundScope.of(this);
}
