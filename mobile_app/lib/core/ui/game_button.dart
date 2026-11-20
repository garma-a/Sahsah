import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'surfaces.dart';

/// Chunky game-style button: a raised face on a darker edge that sinks
/// when pressed. Give it a [height] (and a [width] inside a Row), or put it
/// where its size is fixed by the parent.
class GameButton extends StatefulWidget {
  const GameButton({
    super.key,
    required this.child,
    required this.onTap,
    required this.color,
    this.edgeColor,
    this.borderColor,
    this.height,
    this.width,
    this.radius = 18,
    this.depth = 6,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;

  /// Face colour; the top is lightened a little for a glossy look.
  final Color color;

  /// Side colour under the face. Defaults to [color] darkened.
  final Color? edgeColor;
  final Color? borderColor;
  final double? height;
  final double? width;
  final double radius;

  /// How far the face sits above its edge.
  final double depth;
  final String? semanticLabel;

  @override
  State<GameButton> createState() => _GameButtonState();
}

class _GameButtonState extends State<GameButton> {
  bool _down = false;

  void _set(bool value) {
    if (widget.onTap == null || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    final radius = BorderRadius.circular(widget.radius);
    final edge =
        widget.edgeColor ?? Color.lerp(widget.color, Colors.black, 0.5)!;
    final sink = _down ? widget.depth : 0.0;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _set(true),
        onTapUp: (_) => _set(false),
        onTapCancel: () => _set(false),
        onTap: enabled
            ? () {
                HapticFeedback.lightImpact();
                widget.onTap!();
              }
            : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.5,
          child: SizedBox(
            width: widget.width,
            height: widget.height,
            child: Stack(
              children: [
                Positioned.fill(
                  top: widget.depth,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: edge,
                      borderRadius: radius,
                      boxShadow: [
                        cssShadow(const Color(0x66000000), y: 8, blur: 16),
                      ],
                    ),
                  ),
                ),
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 70),
                  left: 0,
                  right: 0,
                  top: sink,
                  bottom: widget.depth - sink,
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: radius,
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Color.lerp(widget.color, Colors.white, 0.16)!,
                          widget.color,
                        ],
                      ),
                      border: Border.all(
                        color:
                            widget.borderColor ??
                            Colors.white.withValues(alpha: 0.22),
                        width: 1.5,
                      ),
                    ),
                    child: Center(child: widget.child),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
