import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../i18n/lang.dart';
import '../theme/app_theme.dart';
import 'motion.dart';
import 'pressable.dart';

/// A paper sheet's scrolling page that shows it scrolls: an ink scrollbar,
/// the words fading into the paper at an edge with more past it, and, until
/// the reader first scrolls, a "scroll down" tab on the sheet's bottom edge.
/// Without them a landscape page cut off at a card's edge looked finished.
///
/// [frame] draws the sheet around the scroll view; the tab sits half over
/// its bottom edge, in the [footRoom] below it, so it never covers a button.
class PaperScroll extends StatefulWidget {
  const PaperScroll({
    super.key,
    required this.controller,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.frame = _bare,
    this.footRoom = 0,
  });

  final ScrollController controller;
  final EdgeInsetsGeometry padding;
  final Widget Function(Widget scroll) frame;
  final double footRoom;
  final Widget child;

  static Widget _bare(Widget scroll) => scroll;

  @override
  State<PaperScroll> createState() => _PaperScrollState();
}

class _PaperScrollState extends State<PaperScroll> {
  static const _fade = 36.0;

  double _before = 0;
  double _after = 0;
  double _viewport = 0;

  bool _onMetrics(ScrollMetrics m) {
    if (m.axis != Axis.vertical) return false;
    final before = m.extentBefore;
    final after = m.extentAfter;
    if (before != _before ||
        after != _after ||
        m.viewportDimension != _viewport) {
      setState(() {
        _before = before;
        _after = after;
        _viewport = m.viewportDimension;
      });
    }
    return false;
  }

  void _scrollDown() {
    final c = widget.controller;
    if (!c.hasClients) return;
    final target = (c.offset + _viewport * 0.7).clamp(
      0.0,
      c.position.maxScrollExtent,
    );
    final duration = motionFor(context, const Duration(milliseconds: 420));
    if (duration == Duration.zero) {
      c.jumpTo(target);
    } else {
      c.animateTo(target, duration: duration, curve: Curves.easeOutCubic);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    // Each fade grows in over its first few pixels of overflow, so a page
    // that only just doesn't fit isn't smudged.
    final top = (_before / _fade).clamp(0.0, 1.0);
    final bottom = (_after / _fade).clamp(0.0, 1.0);
    final hint = _before < 1 && _after > 24;

    Widget scroll = SingleChildScrollView(
      controller: widget.controller,
      padding: widget.padding,
      child: widget.child,
    );
    scroll = ShaderMask(
      blendMode: BlendMode.dstIn,
      shaderCallback: (rect) {
        final edge = (_fade / rect.height).clamp(0.0, 0.5);
        return LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: 1 - top),
            Colors.white,
            Colors.white,
            Colors.white.withValues(alpha: 1 - bottom),
          ],
          stops: [0, edge, 1 - edge, 1],
        ).createShader(rect);
      },
      child: scroll,
    );

    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
      child: NotificationListener<ScrollNotification>(
        // Only this page's own scroll, not a list inside it.
        onNotification: (n) => n.depth == 0 && _onMetrics(n.metrics),
        child: Stack(
          children: [
            Positioned.fill(
              bottom: widget.footRoom,
              child: widget.frame(
                // The sheet is already clear of the camera cutout: without
                // this the bar stood in by the cutout's width, over cards.
                MediaQuery.removePadding(
                  context: context,
                  removeLeft: true,
                  removeTop: true,
                  removeRight: true,
                  removeBottom: true,
                  child: RawScrollbar(
                    controller: widget.controller,
                    thumbVisibility: true,
                    thickness: 5,
                    radius: const Radius.circular(3),
                    thumbColor: AppColors.ink.withValues(alpha: 0.5),
                    mainAxisMargin: 14,
                    crossAxisMargin: 9, // clear of the sheet's 4px ink border
                    child: scroll,
                  ),
                ),
              ),
            ),
            // Below the scrollbar, half over the sheet's edge: off the
            // content, and not centred, where a two-column page's tab sat
            // on both columns.
            PositionedDirectional(
              end: 24,
              bottom: math.max(0, widget.footRoom - 20),
              child: Center(
                widthFactor: 1,
                heightFactor: 1,
                child: IgnorePointer(
                  ignoring: !hint,
                  child: AnimatedOpacity(
                    opacity: hint ? 1 : 0,
                    duration: motionFor(
                      context,
                      const Duration(milliseconds: 200),
                    ),
                    child: AnimatedSlide(
                      offset: hint ? Offset.zero : const Offset(0, 0.4),
                      duration: motionFor(
                        context,
                        const Duration(milliseconds: 200),
                      ),
                      curve: Curves.easeOutCubic,
                      child: _MoreBelow(
                        label: lang.t('انزل لتحت', 'Enzel ta7t'),
                        onTap: _scrollDown,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// An ink tab, like the website's stamps: "there's more below".
class _MoreBelow extends StatelessWidget {
  const _MoreBelow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      key: const ValueKey('more-below'),
      semanticLabel: label,
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Center(
          widthFactor: 1,
          child: Container(
            padding: const EdgeInsetsDirectional.fromSTEB(14, 7, 10, 7),
            decoration: BoxDecoration(
              color: AppColors.ink,
              borderRadius: BorderRadius.circular(999),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  offset: Offset(0, 3),
                  blurRadius: 8,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: AppText.sans(
                    13,
                    weight: FontWeight.w700,
                    color: AppColors.sheet,
                  ),
                ),
                const SizedBox(width: 6),
                const Icon(
                  LucideIcons.chevronDown,
                  size: 17,
                  color: AppColors.gold,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
