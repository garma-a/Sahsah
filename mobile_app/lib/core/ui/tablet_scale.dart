import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// On a tablet the app is the phone's game, scaled up, the way games fill
/// a bigger screen: text, buttons and art grow together instead of a phone
/// layout stretching around phone-sized type.
///
/// The screens are designed on a landscape phone ([designLong] ×
/// [designShort]). A screen whose short side is at least [tabletShort] is
/// laid out at the size that keeps that proportion and scaled up to fill
/// it, by at most [maxScale]. Phones are left alone.
class TabletScale extends StatelessWidget {
  const TabletScale({super.key, required this.child});

  final Widget child;

  static const designLong = 892.0;
  static const designShort = 412.0;
  static const tabletShort = 600.0;
  static const maxScale = 1.6;

  /// How much the app is scaled up on a screen of [size] (1 on phones).
  static double scaleFor(Size size) {
    final short = math.min(size.width, size.height);
    if (short < tabletShort) return 1;
    final long = math.max(size.width, size.height);
    return math.min(maxScale, math.min(long / designLong, short / designShort));
  }

  @override
  Widget build(BuildContext context) {
    final data = MediaQuery.of(context);
    final scale = scaleFor(data.size);
    if (scale == 1) return child;
    final size = data.size / scale;
    EdgeInsets shrink(EdgeInsets e) => e / scale;
    return FittedBox(
      fit: BoxFit.fill,
      alignment: Alignment.topLeft,
      child: SizedBox.fromSize(
        size: size,
        child: MediaQuery(
          data: data.copyWith(
            size: size,
            padding: shrink(data.padding),
            viewPadding: shrink(data.viewPadding),
            viewInsets: shrink(data.viewInsets),
            systemGestureInsets: shrink(data.systemGestureInsets),
            // Images are decoded for the size they really show at.
            devicePixelRatio: data.devicePixelRatio * scale,
          ),
          child: child,
        ),
      ),
    );
  }
}
