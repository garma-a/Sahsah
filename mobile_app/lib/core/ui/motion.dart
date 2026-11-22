import 'dart:math' as math;

import 'package:flutter/material.dart';

/// [duration], or no time at all with the system's animations off
/// (Android's "Remove animations", iOS's "Reduce motion"): for implicit
/// animations, whose end state then simply appears.
Duration motionFor(BuildContext context, Duration duration) =>
    MediaQuery.disableAnimationsOf(context) ? Duration.zero : duration;

/// A page transition that steps aside with animations off: the new page is
/// simply there.
class CalmPageTransitions extends PageTransitionsBuilder {
  const CalmPageTransitions(this.inner);

  final PageTransitionsBuilder inner;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) => MediaQuery.disableAnimationsOf(context)
      ? child
      : inner.buildTransitions(
          route,
          context,
          animation,
          secondaryAnimation,
          child,
        );
}

/// The website's `rise` keyframes (`globals.css`): a card slides up 22px
/// and fades in, settling at its own small [turn]. Plays once, when the
/// card first appears; [delay] staggers a row of them. With animations
/// off it simply sits at its turn.
class Rise extends StatefulWidget {
  const Rise({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.turn = 0,
  });

  final Widget child;
  final Duration delay;

  /// Resting tilt, in degrees.
  final double turn;

  /// The website's curve, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
  static const curve = Cubic(0.2, 0.8, 0.2, 1);
  static const duration = Duration(milliseconds: 700);

  /// A stagger step that keeps long rows short.
  static Duration step(int index, {int ms = 60, int max = 8}) =>
      Duration(milliseconds: ms * math.min(index, max));

  @override
  State<Rise> createState() => _RiseState();
}

class _RiseState extends State<Rise> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _t;

  @override
  void initState() {
    super.initState();
    final total = widget.delay + Rise.duration;
    _c = AnimationController(vsync: this, duration: total);
    // The delay is the start of one timeline, not a timer, so nothing is
    // left pending if the card goes away first.
    _t = CurvedAnimation(
      parent: _c,
      curve: Interval(
        widget.delay.inMicroseconds / total.inMicroseconds,
        1,
        curve: Rise.curve,
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _c.isCompleted) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final turn = widget.turn * math.pi / 180;
    return AnimatedBuilder(
      animation: _t,
      child: widget.child,
      builder: (context, child) {
        final v = _t.value;
        return Opacity(
          opacity: v.clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(0, 22 * (1 - v)),
            child: turn == 0
                ? child
                : Transform.rotate(angle: turn, child: child),
          ),
        );
      },
    );
  }
}

/// The website's `pop` (`cubic-bezier(0.3, 1.6, 0.5, 1)`, 0.35s): a sticker
/// springs from 60% to full size, each time [trigger] changes.
class Pop extends StatelessWidget {
  const Pop({super.key, required this.trigger, required this.child});

  final Object? trigger;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return TweenAnimationBuilder<double>(
      key: ValueKey(trigger),
      tween: Tween(begin: 0.6, end: 1),
      duration: const Duration(milliseconds: 350),
      curve: const Cubic(0.3, 1.6, 0.5, 1),
      child: child,
      builder: (context, s, child) => Transform.scale(scale: s, child: child),
    );
  }
}
