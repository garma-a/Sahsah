import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';

/// The prototype's `--ease-brand` curve.
const easeBrand = Cubic(0.22, 1, 0.36, 1);

/// The website's signature control (`components/ui/button.tsx`, default
/// variant): a flat orange-red pill with a cyan ring, standing on a darker
/// lip that it sinks onto when pressed.
class PlayButton extends StatefulWidget {
  const PlayButton({
    super.key,
    required this.child,
    required this.onPressed,
    this.height,
    this.width,
    this.radius,
    this.padding = EdgeInsets.zero,
    this.ringColor = AppColors.cyan,
    this.ringWidth = 4,
    this.depth = 5,
    this.semanticLabel,
  });

  final Widget child;
  final VoidCallback? onPressed;

  /// Overall height, lip included.
  final double? height;
  final double? width;

  /// Corner radius; a full pill when null.
  final double? radius;
  final EdgeInsetsGeometry padding;
  final Color ringColor;
  final double ringWidth;

  /// How far the face stands above its lip.
  final double depth;
  final String? semanticLabel;

  @override
  State<PlayButton> createState() => _PlayButtonState();
}

class _PlayButtonState extends State<PlayButton> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (widget.onPressed == null || _pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final radius = BorderRadius.circular(widget.radius ?? 999);
    final ink = enabled ? Colors.white : AppColors.ink.withValues(alpha: 0.7);
    final sink = _pressed ? widget.depth : 0.0;

    final face = Container(
      decoration: BoxDecoration(
        borderRadius: radius,
        color: enabled ? AppColors.press : const Color(0xFF6F7471),
        border: widget.ringWidth > 0
            ? Border.all(
                color: enabled
                    ? widget.ringColor
                    : AppColors.ink.withValues(alpha: 0.4),
                width: widget.ringWidth,
              )
            : null,
      ),
      padding: widget.padding,
      child: IconTheme.merge(
        data: IconThemeData(color: ink),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: ink, fontWeight: FontWeight.w700),
          child: Center(widthFactor: 1, child: widget.child),
        ),
      ),
    );

    return Semantics(
      // Its own stop for screen readers, even inside a labelled area.
      container: true,
      button: true,
      enabled: enabled,
      label: widget.semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        onTap: widget.onPressed == null
            ? null
            : () {
                HapticFeedback.lightImpact();
                widget.onPressed!();
              },
        child: SizedBox(
          height: widget.height,
          width: widget.width,
          child: Stack(
            // The face sizes the button (it may hug its label); the lip
            // fills in behind it.
            fit: StackFit.passthrough,
            children: [
              if (enabled)
                Positioned.fill(
                  top: widget.depth,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.pressDeep,
                      borderRadius: radius,
                    ),
                  ),
                ),
              AnimatedPadding(
                duration: const Duration(milliseconds: 90),
                curve: easeBrand,
                padding: EdgeInsets.only(
                  top: sink,
                  bottom: widget.depth - sink,
                ),
                child: face,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
