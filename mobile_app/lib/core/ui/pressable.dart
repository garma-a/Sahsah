import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'play_button.dart';
import 'motion.dart';

/// Tappable wrapper with game-style feedback: a quick squash on press and an
/// optional haptic tick.
class Pressable extends StatefulWidget {
  const Pressable({
    super.key,
    required this.child,
    required this.onTap,
    this.haptic = true,
    this.scale = 0.96,
    this.semanticLabel,
    this.selected,
    this.link = false,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool haptic;
  final double scale;

  /// What a screen reader says for this control, in place of the text
  /// inside it. The label keeps the tap with it: wrapping a Pressable in
  /// `Semantics(excludeSemantics: true)` instead would drop the tap, so
  /// TalkBack and VoiceOver could read the button but not press it.
  final String? semanticLabel;

  /// For a choice among several: whether this one is picked.
  final bool? selected;

  /// Announced as a link (it leaves the app), not a button.
  final bool link;

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
    final onTap = widget.onTap;
    final tap = onTap == null
        ? null
        : () {
            if (widget.haptic) HapticFeedback.selectionClick();
            onTap();
          };
    final pressable = GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: tap,
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: motionFor(context, const Duration(milliseconds: 120)),
        curve: easeBrand,
        child: widget.child,
      ),
    );
    final label = widget.semanticLabel;
    if (label == null) return pressable;
    return Semantics(
      container: true,
      button: !widget.link,
      link: widget.link,
      enabled: tap != null,
      selected: widget.selected,
      label: label,
      onTap: tap,
      excludeSemantics: true,
      child: pressable,
    );
  }
}
