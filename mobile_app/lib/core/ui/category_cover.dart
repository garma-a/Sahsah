import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/app_theme.dart';
import 'surfaces.dart';
import 'motion.dart';
import 'cover_image.dart';

/// The second ink of each category tone, in the website's order
/// (`components/brand/cover.tsx`): the title's offset shadow.
const coverAccents = [
  Color(0xFFF0B323),
  Color(0xFF5FC0C4),
  Color(0xFFE9C46A),
  Color(0xFFF6A5BF),
  Color(0xFFF0B323),
  AppColors.slabYellow,
];

/// The poster frame colour of each tone (`components/brand/tones.ts`).
const coverBorders = [
  AppColors.red,
  AppColors.cyan,
  AppColors.green,
  AppColors.pink,
  AppColors.logoBlue,
  AppColors.sun,
];

/// A tone from any index.
int toneOf(int index) => index % coverAccents.length;

/// A stable tone from a category id, for covers shown outside a list.
int toneFor(String id) {
  var h = 0;
  for (final c in id.codeUnits) {
    h = (h * 31 + c) & 0x7fffffff;
  }
  return toneOf(h);
}

/// A category cover as a film still from a lavish 1960s Technicolor
/// picture, after the website: the photograph fills the frame, darkened at
/// the foot, where the name is hand-lettered in Rakkas, with a vignette,
/// grain and a warm cast. (The website's "صحصح تقدّم" billing line is left
/// out.)
///
/// Below [compactWidth] the name moves to a solid slab at the top, in
/// Lalezar, so it stays readable (yellow on ink). The website switches at
/// 160px; a phone's posters are narrower, so the app switches at 110.
/// Sizes follow the frame, like the website's container units.
class CategoryCover extends StatelessWidget {
  const CategoryCover({
    super.key,
    required this.image,
    required this.name,
    this.tone = 0,
    this.showName = true,
    this.footInset = 0,
  });

  /// The cover picture; null draws the warm fallback (no cover yet).
  final ImageProvider<Object>? image;
  final String name;

  /// Tone index (see [coverAccents]): the title's offset shadow.
  final int tone;

  /// False when the name is shown elsewhere (the pack screen's side panel).
  final bool showName;

  /// Extra room under the title, for a row drawn over the cover's foot.
  final double footInset;

  /// Narrower than this, the name sits on a slab at the top.
  static const compactWidth = 110.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final width = box.maxWidth;
        // One "cqw" of the website's 4:5 cover; wide frames (the board's
        // cards) size by their height instead.
        final unit =
            math.min(width, box.maxHeight.isFinite ? box.maxHeight : width) /
            100;
        final compact = width < compactWidth;
        final accent = coverAccents[toneOf(tone)];
        final length = name.characters.length;
        // A little larger than the website's 17/14/11.5: Rakkas runs small,
        // and a phone's posters are narrow.
        final size = unit * (length <= 8 ? 20 : (length <= 13 ? 17 : 14));

        return ClipRect(
          child: Stack(
            fit: StackFit.expand,
            children: [
              const ColoredBox(color: AppColors.card),
              if (image case final image?)
                CoverPicture(
                  image,
                  alignment: const Alignment(0, -0.3),
                  errorBuilder: (_, _, _) => const _NoCover(),
                )
              else
                const _NoCover(),
              // The foot darkened for the title (the head, when compact).
              if (showName)
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: compact
                        ? const LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.center,
                            colors: [Color(0x8C120A06), Color(0x00120A06)],
                          )
                        : const LinearGradient(
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                            colors: [
                              Color(0xEB120A06),
                              Color(0x8C120A06),
                              Color(0x00120A06),
                            ],
                            stops: [0, 0.26, 0.5],
                          ),
                  ),
                ),
              // Age: a vignette, grain and a warm cast.
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    radius: 0.85,
                    colors: [Color(0x00281206), Color(0x8C281206)],
                    stops: [0.55, 1],
                  ),
                ),
              ),
              const DecoratedBox(decoration: BoxDecoration(image: grainImage)),
              const ColoredBox(color: Color(0x12D9A55A)),
              if (showName && compact)
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    color: AppColors.ink,
                    padding: EdgeInsets.symmetric(
                      horizontal: width * 0.04,
                      vertical: width * 0.03,
                    ),
                    child: Text(
                      name,
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.display(
                        math.max(12, width * 0.12),
                        height: 1.15,
                        color: AppColors.slabYellow,
                      ),
                    ),
                  ),
                )
              else if (showName)
                Positioned(
                  left: width * 0.06,
                  right: width * 0.06,
                  bottom: box.maxHeight * 0.06 + footInset,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.rotate(
                        angle: -2 * math.pi / 180,
                        child: Text(
                          name,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style:
                              AppText.poster(
                                size,
                                height: 1.05,
                                color: AppColors.filmCream,
                              ).copyWith(
                                shadows: [
                                  Shadow(
                                    color: AppColors.soot,
                                    offset: Offset(0, unit * 0.4),
                                  ),
                                  Shadow(
                                    color: accent.withValues(alpha: 0.6),
                                    offset: Offset(unit * 1.1, unit * 1.3),
                                  ),
                                  Shadow(
                                    color: const Color(0x99000000),
                                    blurRadius: unit * 6,
                                  ),
                                ],
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// What a cover shows without its picture (none yet, or it didn't load).
class _NoCover extends StatelessWidget {
  const _NoCover();

  @override
  Widget build(BuildContext context) => const DecoratedBox(
    decoration: BoxDecoration(
      gradient: RadialGradient(
        center: Alignment(0, -0.4),
        colors: [Color(0xFF7A2E22), AppColors.card],
      ),
    ),
  );
}

/// The round sticker on a poster's corner (`components/home/poster.tsx`):
/// a yellow "؟" that turns green when the category is picked. A picked
/// poster shows its place in the pick ([order]) or a tick.
class PosterBadge extends StatelessWidget {
  const PosterBadge({
    super.key,
    this.selected = false,
    this.order,
    this.size = 36,
  });

  final bool selected;
  final String? order;
  final double size;

  @override
  Widget build(BuildContext context) {
    final sticker = AnimatedContainer(
      duration: motionFor(context, const Duration(milliseconds: 200)),
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? AppColors.green : AppColors.sun,
        border: Border.all(color: AppColors.ink, width: 3),
        boxShadow: [inkDrop(3)],
      ),
      child: selected && order == null
          ? Icon(LucideIcons.check, size: size * 0.5, color: AppColors.ink)
          : Text(
              selected ? order! : '؟',
              style: AppText.display(
                size * 0.5,
                color: AppColors.ink,
                height: 1,
              ),
            ),
    );
    // Picking springs the sticker in, as on the website.
    return selected ? Pop(trigger: order ?? true, child: sticker) : sticker;
  }
}
