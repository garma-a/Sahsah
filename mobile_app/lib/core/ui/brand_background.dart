import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'surfaces.dart';

/// The fixed page background: the website's cinema lobby wall
/// (`components/room/cinema-wall.tsx`), a photographed wall of layered,
/// torn painted film posters, faded and grained. Phones get the painted
/// wall only, as on the website.
///
/// Menus pass `decorated: true` for the warmer lobby light; game screens
/// use the dimmer stage light so the TV glows in front of it.
class BrandBackground extends StatelessWidget {
  const BrandBackground({super.key, this.decorated = true});

  final bool decorated;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xFF3A2418),
            image: DecorationImage(
              image: AssetImage('assets/cinema/wall-posters.webp'),
              repeat: ImageRepeat.repeat,
              fit: BoxFit.none,
              alignment: Alignment.topCenter,
              // 1500px artwork drawn 750 wide, the website's tile size.
              scale: 2,
            ),
          ),
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.1),
                radius: 1.1,
                colors: decorated
                    // Warm lobby light pooling in the middle.
                    ? const [Color(0x8C1A0E08), Color(0xD91A0E08)]
                    // The stage: darker, so the game is the brightest thing.
                    : const [Color(0xB3140E0A), Color(0xF00E0A08)],
              ),
            ),
            child: const DecoratedBox(
              decoration: BoxDecoration(image: grainImage),
              child: SizedBox.expand(),
            ),
          ),
        ),
      ),
    );
  }
}

/// The TV the game is played on (`components/room/retro-screen.tsx`), as
/// the website draws it on a sideways phone: a slim charcoal cabinet with
/// an ink outline, and inside it the glass, deep and faintly scanlined with
/// an ink, teal and ink trim. Only the frame is decoration.
class RetroScreen extends StatelessWidget {
  const RetroScreen({super.key, required this.child});

  final Widget child;

  static const teal = Color(0xFF4FBDBA);

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF3B4240), AppColors.ui, Color(0xFF1F2624)],
          stops: [0, 0.2, 1],
        ),
        border: Border.all(color: AppColors.ink, width: 3),
        boxShadow: [
          inkDrop(6),
          const BoxShadow(
            color: Color(0x99000000),
            offset: Offset(0, 18),
            blurRadius: 30,
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(7),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: const Color(0xFF151B19),
            border: Border.all(color: AppColors.ink, width: 2),
            boxShadow: const [
              BoxShadow(color: AppColors.ink, spreadRadius: 4),
              BoxShadow(color: teal, spreadRadius: 2),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: CustomPaint(
              painter: const _Scanlines(),
              child: Padding(padding: const EdgeInsets.all(8), child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Faint horizontal scanlines and a soft teal glow, behind the content.
class _Scanlines extends CustomPainter {
  const _Scanlines();

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const RadialGradient(
          center: Alignment(0, -0.2),
          radius: 0.9,
          colors: [Color(0x1F4FBDBA), Color(0x004FBDBA)],
        ).createShader(rect),
    );
    final line = Paint()..color = const Color(0x09E8DFC6);
    for (var y = 0.0; y < size.height; y += 4) {
      canvas.drawRect(Rect.fromLTWH(0, y, size.width, 1), line);
    }
  }

  @override
  bool shouldRepaint(_Scanlines oldDelegate) => false;
}
