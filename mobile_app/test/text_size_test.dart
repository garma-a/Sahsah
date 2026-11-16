import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The smallest text the app may use. The game is read from across a
/// table, so nothing goes below this.
const minFontSize = 12;

void main() {
  test('no text style is smaller than $minFontSize px', () {
    final call = RegExp(r'AppText\.(?:sans|num|display)\(\s*(\d+(?:\.\d+)?)');
    final tooSmall = <String>[];
    for (final file in Directory('lib').listSync(recursive: true)) {
      if (file is! File || !file.path.endsWith('.dart')) continue;
      final source = file.readAsStringSync();
      for (final match in call.allMatches(source)) {
        if (double.parse(match[1]!) < minFontSize) {
          final line = source.substring(0, match.start).split('\n').length;
          tooSmall.add('${file.path}:$line uses ${match[1]} px');
        }
      }
    }
    expect(tooSmall, isEmpty);
  });
}
