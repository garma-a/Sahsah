import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import 'surfaces.dart';

/// The prototype's `--ease-brand` curve.
const easeBrand = Cubic(0.22, 1, 0.36, 1);

/// `.btn-play` (red, glossy, raised) with optional `.sheen` light sweep.
class PlayButton extends StatefulWidget {
  const PlayButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.height,
    this.width,
    this.radius = 16,
    this.padding = EdgeInsets.zero,
    this.sheen = false,
    this.ringColor,
    this.ringWidth = 0,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onPressed;
  final double? height;
  final double? width;
  final double radius;
  final EdgeInsetsGeometry padding;
  final bool sheen;

  /// `ring-4 ring-deep` around the round nav button.
  final Color? ringColor;
  final double ringWidth;
  final String? semanticLabel;

  @override
  State<PlayButton> createState() => _PlayButtonState();
}

class _PlayButtonState extends State<PlayButton>
    with SingleTickerProviderStateMixin {
  AnimationController? _sheen;
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    if (widget.sheen) {
      _sheen = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 5500),
      )..repeat();
    }
  }

  @override
  void dispose() {
    _sheen?.dispose();
    super.dispose();
  }

  void _setPressed(bool value) {
    if (widget.onPressed == null || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final radius = BorderRadius.circular(widget.radius);
    final innerRadius = BorderRadius.circular(
      math.max(0, widget.radius - widget.ringWidth),
    );

    final face = ClipRRect(
      borderRadius: innerRadius,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: enabled
                    ? const LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color(0xFFF04A3C),
                          AppColors.play,
                          Color(0xFFC42E22),
                        ],
                        stops: [0, 0.6, 1],
                      )
                    : null,
                color: enabled ? null : const Color(0x1AFFFFFF),
              ),
            ),
          ),
          if (enabled) ...const [
            // inset 0 1px 0 rgba(255,255,255,.35)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              child: ColoredBox(color: Color(0x59FFFFFF)),
            ),
            // inset 0 -4px 0 rgba(0,0,0,.18)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              child: ColoredBox(color: Color(0x2E000000)),
            ),
          ],
          if (_sheen != null) Positioned.fill(child: _Sheen(_sheen!)),
          Padding(
            padding: widget.padding,
            child: IconTheme.merge(
              data: IconThemeData(
                color: enabled ? Colors.white : const Color(0x73FFFCF5),
              ),
              child: DefaultTextStyle.merge(
                style: TextStyle(
                  color: enabled ? Colors.white : const Color(0x73FFFCF5),
                  fontWeight: FontWeight.w700,
                ),
                child: Center(widthFactor: 1, child: widget.child),
              ),
            ),
          ),
        ],
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        onTap: widget.onPressed == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onPressed!();
              },
        child: AnimatedScale(
          scale: _pressed ? 0.98 : 1,
          duration: const Duration(milliseconds: 140),
          curve: easeBrand,
          child: AnimatedSlide(
            offset: Offset(
              0,
              _pressed && widget.height != null ? 1 / widget.height! : 0,
            ),
            duration: const Duration(milliseconds: 140),
            curve: easeBrand,
            child: Container(
              height: widget.height,
              width: widget.width,
              padding: EdgeInsets.all(widget.ringWidth),
              decoration: BoxDecoration(
                borderRadius: radius,
                color: widget.ringColor,
                boxShadow: enabled
                    ? [cssShadow(const Color(0x80E63B2E), y: 14, blur: 34)]
                    : null,
              ),
              child: face,
            ),
          ),
        ),
      ),
    );
  }
}

/// `.sheen::before`: a tilted light band that sweeps across every 5.5 s.
class _Sheen extends StatelessWidget {
  const _Sheen(this.animation);

  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, box) => AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            final v = animation.value;
            final progress = v < 0.6
                ? 0.0
                : easeBrand.transform((v - 0.6) / 0.4);
            final left = -0.6 + 2.2 * progress;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: box.maxWidth * left,
                  top: -box.maxHeight * 0.4,
                  bottom: -box.maxHeight * 0.4,
                  width: box.maxWidth * 0.4,
                  child: Transform.rotate(
                    angle: 18 * math.pi / 180,
                    child: const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Color(0x00FFFFFF),
                            Color(0x47FFFFFF),
                            Color(0x00FFFFFF),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
