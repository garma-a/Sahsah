import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/i18n/lang.dart';
import '../../../core/theme/app_theme.dart';
import 'game_ui.dart';

/// Opens a question picture full screen so players can zoom in: pinch, or
/// double-tap to zoom on a spot. [builder] draws the same picture as the
/// question (crop and grayscale included), so nothing leaks before the
/// reveal.
Future<void> showPhotoViewer(BuildContext context, WidgetBuilder builder) {
  return Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: false,
      barrierColor: Colors.black.withValues(alpha: 0.92),
      transitionDuration: const Duration(milliseconds: 220),
      reverseTransitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, _, _) => _PhotoViewer(builder: builder),
      transitionsBuilder: (context, animation, _, child) =>
          MediaQuery.disableAnimationsOf(context)
          ? child
          : FadeTransition(opacity: animation, child: child),
    ),
  );
}

class _PhotoViewer extends StatefulWidget {
  const _PhotoViewer({required this.builder});

  final WidgetBuilder builder;

  @override
  State<_PhotoViewer> createState() => _PhotoViewerState();
}

class _PhotoViewerState extends State<_PhotoViewer>
    with SingleTickerProviderStateMixin {
  static const _doubleTapScale = 2.5;

  final _transform = TransformationController();
  late final AnimationController _zoom = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  );
  Animation<Matrix4>? _animation;
  Offset _tapAt = Offset.zero;

  @override
  void initState() {
    super.initState();
    _zoom.addListener(() {
      final a = _animation;
      if (a != null) _transform.value = a.value;
    });
  }

  @override
  void dispose() {
    _zoom.dispose();
    _transform.dispose();
    super.dispose();
  }

  /// Double tap zooms in on the tapped spot, or back out if zoomed.
  void _toggleZoom() {
    final zoomedIn = _transform.value.getMaxScaleOnAxis() > 1.01;
    final Matrix4 end;
    if (zoomedIn) {
      end = Matrix4.identity();
    } else {
      final p = _tapAt;
      end = Matrix4.identity()
        ..translateByDouble(
          -p.dx * (_doubleTapScale - 1),
          -p.dy * (_doubleTapScale - 1),
          0,
          1,
        )
        ..scaleByDouble(_doubleTapScale, _doubleTapScale, 1, 1);
    }
    _animation = Matrix4Tween(
      begin: _transform.value,
      end: end,
    ).animate(CurvedAnimation(parent: _zoom, curve: Curves.easeOutCubic));
    if (MediaQuery.disableAnimationsOf(context)) {
      _transform.value = end;
    } else {
      _zoom.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final padding = MediaQuery.paddingOf(context);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              onDoubleTapDown: (d) => _tapAt = d.localPosition,
              onDoubleTap: _toggleZoom,
              child: InteractiveViewer(
                transformationController: _transform,
                minScale: 1,
                maxScale: 5,
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    padding.left + 24,
                    padding.top + 24,
                    padding.right + 24,
                    padding.bottom + 24,
                  ),
                  child: Center(child: widget.builder(context)),
                ),
              ),
            ),
          ),
          PositionedDirectional(
            top: padding.top + 14,
            end: 16,
            child: RoundIconButton(
              key: const ValueKey('photo-close'),
              icon: LucideIcons.x,
              label: lang.t('اقفل الصورة', 'E2fel el soora'),
              onTap: () => Navigator.of(context).pop(),
            ),
          ),
          Positioned(
            bottom: padding.bottom + 14,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    lang.t(
                      'قرّب بصباعين أو اضغط مرتين',
                      'Karrab b sobae3een aw edghat marteen',
                    ),
                    style: AppText.sans(13, color: AppColors.ivory),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
