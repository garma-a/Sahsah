import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/audio/sound.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/join/scan_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'game_flow_test.dart' show settle;
import 'screen_reader_test.dart' show press;
import 'sound_test.dart' show FakeSound;
import 'support/fake_server.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('joinCodeFrom', () {
    test('reads the host\'s join link', () {
      expect(joinCodeFrom('https://sa7sa7.cc/join/956323'), '956323');
      expect(joinCodeFrom('https://www.sa7sa7.cc/join/012345/'), '012345');
      expect(joinCodeFrom('  https://sa7sa7.cc/join/956323?ref=qr '), '956323');
    });

    test('takes a bare code, in either digits', () {
      expect(joinCodeFrom('956323'), '956323');
      expect(joinCodeFrom('٩٥٦٣٢٣'), '956323');
    });

    test('anything else is not a room code', () {
      expect(joinCodeFrom('https://sa7sa7.cc/act/g/1/2?t=x'), isNull);
      expect(joinCodeFrom('https://sa7sa7.cc/join/12345'), isNull);
      expect(joinCodeFrom('hello'), isNull);
      expect(joinCodeFrom('1234567'), isNull);
    });
  });

  testWidgets('scanning the host\'s QR opens the room to join', (tester) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(892 * 3, 412 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    final server = FakeServer();
    final host = await server.game();
    addTearDown(host.dispose);
    await host.openRoom(
      categoryIds: [
        'cat-90s',
        'cat-football',
        'cat-emoji',
        'cat-places',
        'cat-cinema',
        'cat-songs',
      ],
      teams: ['الفراعنة', 'الجدعان'],
    );
    // The camera reads the lobby's QR: its join link.
    final link = 'https://sa7sa7.test/join/${server.room!.code}';
    final original = JoinScanner.scan;
    JoinScanner.scan = (_) async => joinCodeFrom(link);
    addTearDown(() => JoinScanner.scan = original);

    final player = server.guest();
    addTearDown(player.dispose);
    await tester.pumpWidget(
      SahsahApp(
        api: server.api,
        lang: LangController(Lang.ar),
        game: player,
        sound: SoundController(backend: FakeSound()),
      ),
    );
    await settle(tester);
    await press(tester, 'ادخل بكود');
    await press(tester, 'امسح الـQR');
    await settle(tester);

    // The code is checked at once: the room's teams to pick from.
    expect(find.text('لقينا الغرفة!'), findsOneWidget);
    expect(find.text('الجدعان'), findsOneWidget);
    semantics.dispose();
  });
}
