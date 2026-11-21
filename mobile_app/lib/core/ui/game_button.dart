import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// Chunky game-style button after the website's tiles: a flat face with an
/// ink outline, standing on an ink lip that it sinks onto when pressed. Give it a [height] (and a [width] inside a Row), or put it
/// where its size is fixed by the parent.
class GameButton extends StatefulWidget {
  const GameButton({
    super.key,
    required this.child,
    required this.onTap,
    required this.color,
    this.edgeColor,
    this.borderColor,
    this.borderWidth = 3,
    this.height,
    this.width,
    this.radius = 18,
    this.depth = 6,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onTap;

  /// Face colour.
  final Color color;

  /// The lip under the face. Defaults to ink.
  final Color? edgeColor;

  /// The outline. Defaults to ink.
  final Color? borderColor;
  final double borderWidth;
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
    final edge = widget.edgeColor ?? AppColors.ink;
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
                      color: widget.color,
                      border: Border.all(
                        color: widget.borderColor ?? AppColors.ink,
                        width: widget.borderWidth,
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
