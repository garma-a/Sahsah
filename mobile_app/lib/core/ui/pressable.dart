import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'play_button.dart';

/// Tappable wrapper with game-style feedback: a quick squash on press and an
/// optional haptic tick.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    required this.onTap,
    this.haptic = true,
    this.scale = 0.96,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool haptic;
  final double scale;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool value) {
    if (widget.onTap == null || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    // Callers add their own Semantics (button/link labels).
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              if (widget.haptic) HapticFeedback.selectionClick();
              widget.onTap!();
            },
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: const Duration(milliseconds: 120),
        curve: easeBrand,
        child: widget.child,
      ),
    );
  }
}
