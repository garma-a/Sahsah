import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'home_test.dart' show settle, tapText;

import 'support/fake_api.dart';

/// Records what would have been played.
class FakeSound implements SoundBackend {
  final played = <Sfx>[];
  bool fail = false;

  @override
  Future<void> play(Sfx sound) async {
    if (fail) throw StateError('no audio device');
    played.add(sound);
  }

  @override
  Future<void> dispose() async {}
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('the clock ticks for the last ten seconds only', () {
    expect(SoundController.forSecond(60), isNull);
    expect(SoundController.forSecond(11), isNull);
    expect(SoundController.forSecond(10), Sfx.tick);
    expect(SoundController.forSecond(1), Sfx.tick);
    // Time-up plays when the clock stops, not as a tick.
    expect(SoundController.forSecond(0), isNull);
  });

  test('sounds play only while enabled, and the choice is saved', () async {
    final backend = FakeSound();
    final sound = await SoundController.load(backend);
    expect(sound.enabled, isTrue);
    sound.play(Sfx.correct);

    sound.setEnabled(false);
    sound.play(Sfx.win);
    expect(backend.played, [Sfx.correct]);

    final again = await SoundController.load(FakeSound());
    expect(again.enabled, isFalse);
  });

  test('a sound that fails to play is ignored', () async {
    final backend = FakeSound()..fail = true;
    final sound = SoundController(backend: backend);
    sound.play(Sfx.tick);
    await Future<void>.delayed(Duration.zero);
    expect(backend.played, isEmpty);

    // And with no audio at all (the default in tests) nothing happens.
    SoundController().play(Sfx.tick);
  });

  testWidgets('More: the sound switch turns sounds off and on', (tester) async {
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final backend = FakeSound();
    final sound = SoundController(backend: backend);
    await tester.pumpWidget(
      SahsahApp(api: fakeApi(), lang: LangController(Lang.ar), sound: sound),
    );
    await settle(tester);
    await tapText(tester, 'المزيد');

    final toggle = find.byKey(const ValueKey('sound-switch'));
    expect(find.text('أصوات اللعبة'), findsOneWidget);
    expect(tester.widget<Switch>(toggle).value, isTrue);

    await tester.tap(toggle);
    await settle(tester);
    expect(sound.enabled, isFalse);
    expect(backend.played, isEmpty);

    // Turning them back on plays a sample.
    await tester.tap(toggle);
    await settle(tester);
    expect(sound.enabled, isTrue);
    expect(backend.played, [Sfx.correct]);
  });
}
