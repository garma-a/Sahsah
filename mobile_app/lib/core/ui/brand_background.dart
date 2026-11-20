import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// The fixed page background: charcoal, lit a little from the top, with two
/// soft brand glows. Game screens pass `decorated: false` to drop the glows.
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

/// Charcoal gradient and two glows (cyan and red).
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
          colors: [Color(0xFF3A4340), AppColors.deep],
        ).createShader(rect),
    );
    if (glows) {
      _glow(canvas, size, const Offset(0.8, 0.15), 0.55, AppColors.cyan, 0.14);
      _glow(canvas, size, const Offset(0.15, 0.95), 0.45, AppColors.play, 0.10);
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
