import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Retro pieces from the brand deck: the stacked 3D logo, rainbow stripes
/// and torn paper.

/// "صح صح" in stacked retro layers (cream face, then yellow, orange, red and
/// teal steps), like the deck's logo studies.
class RetroLogo extends StatelessWidget {
  const RetroLogo({super.key, this.fontSize = 34});

  final double fontSize;

  static const _layers = [
    AppColors.gold,
    AppColors.orange,
    AppColors.play,
    AppColors.teal,
  ];

  @override
  Widget build(BuildContext context) {
    final step = fontSize * 0.045;
    TextStyle style(Color color) => TextStyle(
      fontFamily: AppFonts.display,
      fontSize: fontSize,
      height: 1.15,
      color: color,
    );
    const text = 'صح صح';
    return Semantics(
      label: text,
      image: true,
      child: ExcludeSemantics(
        child: Padding(
          padding: EdgeInsets.only(
            right: step * _layers.length,
            bottom: step * _layers.length,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              for (var i = _layers.length - 1; i >= 0; i--)
                Transform.translate(
                  offset: Offset(step * (i + 1), step * (i + 1)),
                  child: Text(
                    text,
                    textDirection: TextDirection.rtl,
                    style: style(_layers[i]),
                  ),
                ),
              // Dark outline under the face keeps the layers apart.
              Text(
                text,
                textDirection: TextDirection.rtl,
                style: style(AppColors.deep).copyWith(
                  foreground: Paint()
                    ..style = PaintingStyle.stroke
                    ..strokeWidth = fontSize * 0.08
                    ..color = AppColors.deep,
                ),
              ),
              Text(
                text,
                textDirection: TextDirection.rtl,
                style: style(AppColors.ivory),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Which corner a rainbow sweeps out of.
enum RainbowCorner { topStart, topEnd, bottomStart, bottomEnd }

/// Quarter-circle rainbow bands in a corner, like the deck's question and
/// board mock-ups. Size it with a SizedBox or Positioned.
class Rainbow extends StatelessWidget {
  const Rainbow({super.key, required this.corner, this.band = 9});

  final RainbowCorner corner;
  final double band;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final start =
        corner == RainbowCorner.topStart || corner == RainbowCorner.bottomStart;
    final left = start != rtl;
    final top =
        corner == RainbowCorner.topStart || corner == RainbowCorner.topEnd;
    return IgnorePointer(
      child: CustomPaint(
        painter: _RainbowPainter(left: left, top: top, band: band),
      ),
    );
  }
}

class _RainbowPainter extends CustomPainter {
  const _RainbowPainter({
    required this.left,
    required this.top,
    required this.band,
  });

  final bool left;
  final bool top;
  final double band;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final center = Offset(left ? 0 : size.width, top ? 0 : size.height);
    final outer = math.min(size.width, size.height);
    const colors = AppColors.rainbow;
    for (var i = 0; i < colors.length; i++) {
      final r = outer - band * (i + 0.5);
      if (r <= 0) break;
      canvas.drawCircle(
        center,
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = band
          ..color = colors[i],
      );
    }
  }

  @override
  bool shouldRepaint(_RainbowPainter old) =>
      old.left != left || old.top != top || old.band != band;
}

/// A strip of cream paper with torn top and bottom edges (deck slide 41).
class TornPaper extends StatelessWidget {
  const TornPaper({super.key, required this.child, this.tear = 7});

  final Widget child;
  final double tear;

  @override
  Widget build(BuildContext context) {
    return ClipPath(
      clipper: _TornClipper(tear),
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.cream, AppColors.stroke, AppColors.cream],
          ),
        ),
        child: child,
      ),
    );
  }
}

class _TornClipper extends CustomClipper<Path> {
  const _TornClipper(this.tear);

  final double tear;

  @override
  Path getClip(Size size) {
    // Deterministic jitter so the edge doesn't change between frames.
    final random = math.Random(7);
    final path = Path()..moveTo(0, tear);
    for (var x = 0.0; x < size.width; x += 10) {
      path.lineTo(x + 5, random.nextDouble() * tear);
      path.lineTo(math.min(size.width, x + 10), tear * 0.6);
    }
    path.lineTo(size.width, size.height - tear);
    for (var x = size.width; x > 0; x -= 10) {
      path.lineTo(x - 5, size.height - random.nextDouble() * tear);
      path.lineTo(math.max(0, x - 10), size.height - tear * 0.6);
    }
    return path..close();
  }

  @override
  bool shouldReclip(_TornClipper old) => old.tear != tear;
}
