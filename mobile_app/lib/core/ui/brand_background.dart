import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The fixed page background: a deep navy night with soft colour glows and
/// faint stars. Game screens pass `decorated: false` to drop the glows.
/// The rainbows live on cards instead, so the page stays calm.
class BrandBackground extends StatelessWidget {
  const BrandBackground({super.key, this.decorated = true});

  final bool decorated;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _NightPainter(glows: decorated),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

/// Navy gradient, two glows (blue and red) and a scatter of stars.
class _NightPainter extends CustomPainter {
  const _NightPainter({required this.glows});

  final bool glows;

  @override
  void paint(Canvas canvas, Size size) {
    // Android can paint a 0-sized first frame.
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF121848), AppColors.deep],
        ).createShader(rect),
    );
    if (glows) {
      _glow(canvas, size, const Offset(0.8, 0.15), 0.55, AppColors.blue, 0.22);
      _glow(canvas, size, const Offset(0.15, 0.95), 0.45, AppColors.play, 0.12);
    }

    final random = math.Random(3);
    final star = Paint();
    final count = (size.width * size.height / 9000).round();
    for (var i = 0; i < count; i++) {
      final p = Offset(
        random.nextDouble() * size.width,
        random.nextDouble() * size.height,
      );
      final big = random.nextDouble() > 0.9;
      star.color = AppColors.ivory.withValues(
        alpha: big ? 0.5 : 0.12 + random.nextDouble() * 0.2,
      );
      canvas.drawCircle(p, big ? 1.4 : 0.8, star);
    }
  }

  void _glow(
    Canvas canvas,
    Size size,
    Offset at,
    double radius,
    Color color,
    double alpha,
  ) {
    final center = Offset(size.width * at.dx, size.height * at.dy);
    final r = size.longestSide * radius;
    canvas.drawCircle(
      center,
      r,
      Paint()
        ..shader = ui.Gradient.radial(center, r, [
          color.withValues(alpha: alpha),
          color.withValues(alpha: 0),
        ]),
    );
  }

  @override
  bool shouldRepaint(_NightPainter oldDelegate) => oldDelegate.glows != glows;
}
