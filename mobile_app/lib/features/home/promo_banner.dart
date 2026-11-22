import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/category_cover.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/promos.dart';
import '../game/ui/game_ui.dart';
import '../../core/ui/motion.dart';

/// One promo as an ad banner: a picture (or a fan of the new posters) with
/// the title, a line and a button over a dark wash on the words' side.
class PromoBanner extends StatelessWidget {
  const PromoBanner({
    super.key,
    required this.promo,
    required this.onAction,
    this.large = false,
  });

  final Promo promo;
  final VoidCallback onAction;

  /// The pop-up's bigger type.
  final bool large;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    // The words' side, as a fixed side of the screen.
    final textRight = promo.textAtStart == rtl;
    final scale = large ? 1.2 : 1.0;
    // A discount is printed in ink straight on its yellow paper; the
    // others are light words over a dark wash on a picture.
    final paper = promo.stamp != null;
    final ink = paper ? AppColors.ink : AppColors.ivory;
    final lift = paper ? const <Shadow>[] : const [_lift];

    return Semantics(
      container: true,
      label: '${promo.title}. ${promo.body}',
      child: LayoutBuilder(
        builder: (context, box) {
          final wide = box.maxWidth;
          final column = wide * (promo.posters.isEmpty ? 0.56 : 0.54);
          final ctaStyle = AppText.sans(15 * scale, weight: FontWeight.w700);
          // The button's width: its words, the arrow, the padding and the
          // outline, but never wider than the column.
          final label = TextPainter(
            text: TextSpan(text: promo.cta, style: ctaStyle),
            textDirection: Directionality.of(context),
            textScaler: MediaQuery.textScalerOf(context),
            maxLines: 1,
          )..layout();
          final ctaWidth = math.min(
            label.width + (16 + 6 + 2 * 12) * scale + 6 + 24,
            column - 40 * scale,
          );
          label.dispose();
          final words = Align(
            alignment: textRight ? Alignment.centerRight : Alignment.centerLeft,
            child: SizedBox(
              width: column,
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: 20 * scale,
                  vertical: 16 * scale,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The banner's own label reads these; the button
                    // stays its own stop.
                    ExcludeSemantics(
                      child: Text(
                        promo.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(
                          30 * scale,
                          color: ink,
                          height: 1.15,
                        ).copyWith(shadows: lift),
                      ),
                    ),
                    SizedBox(height: 6 * scale),
                    ExcludeSemantics(
                      child: Text(
                        promo.body,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.sans(
                          14 * scale,
                          color: ink,
                          height: 1.45,
                        ).copyWith(shadows: lift),
                      ),
                    ),
                    SizedBox(height: 12 * scale),
                    GameButton(
                      // Hugs its words rather than spanning the column.
                      width: ctaWidth,
                      height: 42 * scale,
                      radius: 999,
                      depth: 4,
                      // Yellow on yellow would vanish: ink on the discount.
                      color: paper ? AppColors.ink : AppColors.gold,
                      semanticLabel: promo.cta,
                      onTap: onAction,
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12 * scale),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Flexible(
                              child: Text(
                                promo.cta,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: ctaStyle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Icon(
                              rtl
                                  ? LucideIcons.arrowLeft
                                  : LucideIcons.arrowRight,
                              size: 16 * scale,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );

          return Stack(
            fit: StackFit.expand,
            children: [
              ExcludeSemantics(
                child: _Art(promo: promo, textRight: textRight),
              ),
              // A dark wash under the words, clear over the art.
              if (!paper)
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: textRight
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      end: textRight
                          ? Alignment.centerLeft
                          : Alignment.centerRight,
                      colors: const [
                        Color(0xE6151B19),
                        Color(0x99151B19),
                        Color(0x00151B19),
                      ],
                      stops: const [0, 0.45, 0.75],
                    ),
                  ),
                ),
              const DecoratedBox(decoration: BoxDecoration(image: grainImage)),
              words,
            ],
          );
        },
      ),
    );
  }

  static const _lift = Shadow(color: Color(0x99000000), blurRadius: 8);
}

/// The banner's picture, or the new posters fanned out on a red wall.
class _Art extends StatelessWidget {
  const _Art({required this.promo, required this.textRight});

  final Promo promo;
  final bool textRight;

  @override
  Widget build(BuildContext context) {
    final image = promo.image;
    if (image != null) {
      return Image.asset(
        image,
        fit: BoxFit.cover,
        alignment: promo.imageAlignment,
        errorBuilder: (_, _, _) => const ColoredBox(color: AppColors.forest),
      );
    }
    final stamp = promo.stamp;
    if (stamp != null) return _Ticket(stamp: stamp, textRight: textRight);
    final lang = context.lang;
    return ColoredBox(
      color: AppColors.press,
      child: LayoutBuilder(
        builder: (context, box) {
          final count = promo.posters.length;
          // The fan fills the art half (away from the words): each poster
          // overlaps the next by half, at most 74% of the banner tall.
          const spread = 0.5;
          final art = box.maxWidth * 0.46;
          var w = art * 0.96 / (1 + (count - 1) * spread);
          var h = w / 0.8;
          if (h > box.maxHeight * 0.74) {
            h = box.maxHeight * 0.74;
            w = h * 0.8;
          }
          final centre = textRight
              ? box.maxWidth * 0.03 + art / 2
              : box.maxWidth * 0.97 - art / 2;
          return Stack(
            children: [
              for (final (i, c) in promo.posters.indexed)
                Positioned(
                  left: centre - w / 2 + (i - (count - 1) / 2) * w * spread,
                  top:
                      (box.maxHeight - h) / 2 +
                      (i.isOdd ? -h * 0.04 : h * 0.04),
                  width: w,
                  height: h,
                  child: Transform.rotate(
                    angle: (i - (count - 1) / 2) * 7 * math.pi / 180,
                    child: Container(
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: coverBorders[toneOf(i + 1)],
                          width: 3,
                        ),
                        boxShadow: [inkDrop(5)],
                      ),
                      child: CategoryCover(
                        image: BrandImages.category(c.id),
                        name: lang.t(c.name, c.nameEn),
                        tone: i + 1,
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// A discount's art: a red ticket with the figure, stuck on crooked on
/// sun-yellow paper, in the half away from the words.
class _Ticket extends StatelessWidget {
  const _Ticket({required this.stamp, required this.textRight});

  final String stamp;
  final bool textRight;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return ColoredBox(
      color: AppColors.sun,
      child: LayoutBuilder(
        builder: (context, box) {
          final h = box.maxHeight * 0.56;
          final w = math.min(box.maxWidth * 0.34, h * 1.25);
          final centre = textRight ? box.maxWidth * 0.26 : box.maxWidth * 0.74;
          return Stack(
            children: [
              const Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(image: grainImage),
                ),
              ),
              Positioned(
                left: centre - w / 2,
                top: (box.maxHeight - h) / 2,
                width: w,
                height: h,
                child: Transform.rotate(
                  angle: -6 * math.pi / 180,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.press,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.ink, width: 4),
                      boxShadow: [inkDrop(7)],
                    ),
                    padding: EdgeInsets.all(h * 0.08),
                    child: FittedBox(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                LucideIcons.gift,
                                color: Colors.white,
                                size: 22,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                lang.t('خصم', 'Khasm'),
                                style: AppText.display(
                                  24,
                                  color: Colors.white,
                                  height: 1,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            stamp,
                            textDirection: TextDirection.ltr,
                            style:
                                AppText.display(
                                  64,
                                  color: Colors.white,
                                  height: 1.05,
                                ).copyWith(
                                  shadows: const [
                                    Shadow(
                                      color: AppColors.ink,
                                      offset: Offset(3, 4),
                                    ),
                                  ],
                                ),
                          ),
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
    );
  }
}

/// The lobby's stage: the promos as a banner carousel that turns every few
/// seconds (unless animations are off) and can be swiped, with page dots.
class PromoCarousel extends StatefulWidget {
  const PromoCarousel({
    super.key,
    required this.promos,
    required this.onAction,
  });

  final List<Promo> promos;
  final void Function(Promo promo) onAction;

  static const interval = Duration(seconds: 6);

  @override
  State<PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<PromoCarousel> {
  final _pages = PageController();
  Timer? _timer;
  int _page = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Turns on its own unless animations are off or a screen reader is on
    // (slides moving under it are disorienting; they can still be swiped).
    // Only a change in that restarts the turn: other MediaQuery changes
    // mustn't keep resetting it.
    final auto =
        widget.promos.length > 1 &&
        !MediaQuery.disableAnimationsOf(context) &&
        !MediaQuery.accessibleNavigationOf(context);
    if (auto != _auto) {
      _auto = auto;
      _schedule();
    }
  }

  bool? _auto;

  /// (Re)starts the turn, so a swipe gets the full interval.
  void _schedule() {
    _timer?.cancel();
    if (_auto != true) return;
    _timer = Timer.periodic(PromoCarousel.interval, (_) {
      if (!_pages.hasClients) return;
      _pages.animateToPage(
        (_page + 1) % widget.promos.length,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final promos = widget.promos;
    return Stack(
      children: [
        NotificationListener<ScrollStartNotification>(
          onNotification: (n) {
            if (n.dragDetails != null) _schedule();
            return false;
          },
          child: PageView.builder(
            controller: _pages,
            itemCount: promos.length,
            onPageChanged: (i) => setState(() => _page = i),
            itemBuilder: (context, i) => PromoBanner(
              promo: promos[i],
              onAction: () => widget.onAction(promos[i]),
            ),
          ),
        ),
        PositionedDirectional(
          bottom: 10,
          start: 0,
          end: 0,
          child: ExcludeSemantics(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var i = 0; i < promos.length; i++)
                  AnimatedContainer(
                    duration: motionFor(
                      context,
                      const Duration(milliseconds: 250),
                    ),
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    width: i == _page ? 22 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == _page
                          ? AppColors.gold
                          : AppColors.ivory.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: AppColors.ink, width: 1.5),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

/// Shows [promo] as a pop-up over the lobby: the banner on a sheet with a
/// close button. Returns the promo when its button was pressed, or null if
/// it was closed.
Future<Promo?> showPromoPopup(BuildContext context, Promo promo) {
  final lang = context.lang;
  final calm = MediaQuery.disableAnimationsOf(context);
  return showGeneralDialog<Promo>(
    context: context,
    barrierDismissible: true,
    barrierLabel: lang.t('اقفل', 'E2fel'),
    barrierColor: Colors.black.withValues(alpha: 0.65),
    transitionDuration: Duration(milliseconds: calm ? 0 : 380),
    pageBuilder: (context, _, _) {
      final size = MediaQuery.sizeOf(context);
      final width = math.min(size.width * 0.78, 640.0);
      final height = math.min(size.height * 0.74, width * 0.52);
      final radius = BorderRadius.circular(26);
      return Center(
        child: SizedBox(
          key: const ValueKey('promo-popup'),
          width: width,
          height: height,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: Container(
                  decoration: sheetDecoration(radius: radius),
                  child: ClipRRect(
                    // Inside the sheet's 4px outline.
                    borderRadius: BorderRadius.circular(22),
                    child: Material(
                      type: MaterialType.transparency,
                      child: PromoBanner(
                        promo: promo,
                        large: true,
                        onAction: () => Navigator.of(context).pop(promo),
                      ),
                    ),
                  ),
                ),
              ),
              PositionedDirectional(
                top: -14,
                end: -14,
                child: RoundIconButton(
                  icon: LucideIcons.x,
                  label: lang.t('اقفل', 'E2fel'),
                  onTap: () => Navigator.of(context).pop(),
                ),
              ),
            ],
          ),
        ),
      );
    },
    // The website's pop: the sheet springs up from a little smaller.
    transitionBuilder: (context, animation, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
      child: ScaleTransition(
        scale: Tween(begin: 0.85, end: 1.0).animate(
          CurvedAnimation(
            parent: animation,
            curve: const Cubic(0.3, 1.6, 0.5, 1),
            reverseCurve: Curves.easeIn,
          ),
        ),
        child: child,
      ),
    ),
  );
}
