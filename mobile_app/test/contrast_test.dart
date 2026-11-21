import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/theme/app_theme.dart';
import 'package:sahsah_mobile/features/game/ui/game_ui.dart';

/// WCAG 2 contrast ratio between two opaque colours.
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// The colour pairs the website's look puts text on must clear AA (4.5:1),
/// like the website's own tones (`components/brand/tones.ts`).
void main() {
  const sheet = Color(0xFFF3E6C8);
  const aa = 4.5;

  void expectAA(String what, Color text, Color fill) {
    final ratio = contrast(text, fill);
    expect(
      ratio,
      greaterThanOrEqualTo(aa),
      reason: '$what: ${ratio.toStringAsFixed(2)}:1',
    );
  }

  test('text on paper', () {
    for (final (name, fill) in [
      ('card', AppColors.paper),
      ('sheet', sheet),
      ('white', const Color(0xFFFFFFFF)),
    ]) {
      expectAA('ink on $name', AppColors.ink, fill);
      expectAA('muted ink on $name', AppColors.inkMuted, fill);
      expectAA('red accent on $name', AppColors.pressDeep, fill);
    }
  });

  test('text on dark', () {
    for (final (name, fill) in [
      ('page', AppColors.deep),
      ('card', AppColors.ui),
      ('ink', AppColors.ink),
    ]) {
      expectAA('cream on $name', AppColors.ivory, fill);
      expectAA('yellow on $name', AppColors.gold, fill);
    }
    // The compact cover's name slab.
    expectAA('slab title', const Color(0xFFF6D64A), AppColors.ink);
  });

  test('buttons, tiles and teams', () {
    expectAA('main button', const Color(0xFFFFFFFF), AppColors.press);
    for (final fill in AppColors.categoryColors) {
      expectAA('tile $fill', AppColors.inkOn(fill), fill);
    }
    for (final fill in teamColors) {
      expectAA('team $fill', AppColors.ink, fill);
    }
    expectAA('green button', AppColors.ink, AppColors.green);
    expectAA('time up', const Color(0xFFFFFFFF), AppColors.press);
  });
}
