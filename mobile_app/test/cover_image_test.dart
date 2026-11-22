import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/ui/cover_image.dart';

/// Covers are decoded just big enough to cover the box they're drawn in,
/// not at the file's full size.
void main() {
  test('just big enough to cover, keeping the proportions', () {
    // A 16:9 cover in a square box: the height decides.
    expect(CoverImage.targetFor(1800, 1013, 128, 128), (
      width: 228,
      height: 128,
    ));
    // In a wide box the width decides.
    expect(CoverImage.targetFor(1000, 750, 400, 100), (
      width: 400,
      height: 300,
    ));
    // Never bigger than the file.
    expect(CoverImage.targetFor(900, 675, 2000, 1500), (
      width: 900,
      height: 675,
    ));
  });

  testWidgets('a 1800px cover decodes small for a small box', (tester) async {
    final info = await tester.runAsync(() async {
      final provider = CoverImage(
        const AssetImage('assets/img/herowide.webp'),
        width: 128,
        height: 128,
      );
      final done = Completer<ImageInfo>();
      provider
          .resolve(ImageConfiguration.empty)
          .addListener(ImageStreamListener((info, _) => done.complete(info)));
      return done.future;
    });
    // herowide.webp is 1800 × 771: covering 128 × 128 needs a height of
    // 128, so about 299 × 128 instead of 1800 × 771.
    expect(info!.image.height, 128);
    expect(info.image.width, lessThan(320));
  });
}
