import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../data/categories.dart';
import '../i18n/lang.dart';
import '../theme/app_theme.dart';
import 'category_cover.dart';
import 'retro.dart';
import 'motion.dart';

abstract final class BrandImages {
  static const plaque = 'assets/logo/plaque.png';
  static const divider = 'assets/logo/divider.png';
  static const hero = 'assets/img/hero.webp';
  static const herowide = 'assets/img/herowide.webp';
  static const coins = 'assets/img/coins.webp';
  static const contact = 'assets/img/contact.webp';
  static const comedy = 'assets/img/comedy.webp';
  static const cinema = 'assets/img/cinema.webp';
  static const football = 'assets/img/football.webp';
  static const music = 'assets/img/music.webp';
  static const ramadan = 'assets/img/ramadan.webp';

  /// Cover art per category. The acting pack borrows the cinema poster
  /// until it has its own artwork.
  static String category(String id) => 'assets/img/${_coverFor[id] ?? id}.webp';

  static const _coverFor = {'acting': 'cinema'};
}

/// The brand mark: the stacked retro "صح صح" ([RetroLogo]), [size] tall.
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 40});

  /// Height of the mark.
  final double size;

  /// The client's retro logo, as the website shows it
  /// (`public/brand/logo-retro.svg`), turned a little like a sticker.
  @override
  Widget build(BuildContext context) => Transform.rotate(
    angle: -0.05,
    child: SvgPicture.asset(
      'assets/logo/logo-retro.svg',
      height: size,
      semanticsLabel: 'صحصح',
    ),
  );
}

/// Decorative arch outline drawn behind the page.
class Arch extends StatelessWidget {
  const Arch({super.key, required this.height, required this.color});

  final double height;
  final Color color;

  static const _svg = '''
<svg viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#000">
  <path d="M20 520V200C20 100 100 20 200 20s180 80 180 180v320" stroke-width="2"/>
  <path d="M60 520V210C60 126 120 60 200 60s140 66 140 150v310" stroke-width="1"/>
  <path d="M200 20v-14M170 28l-8-10M230 28l8-10" stroke-width="2" stroke-linecap="round"/>
</svg>''';

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    _svg,
    height: height,
    colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
  );
}

enum Social {
  instagram('Instagram', 'https://instagram.com/', '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#000" stroke-width="2">
  <rect x="3" y="3" width="18" height="18" rx="5"/>
  <circle cx="12" cy="12" r="4"/>
  <circle cx="17.5" cy="6.5" r="1" fill="#000" stroke="none"/>
</svg>'''),
  tiktok('TikTok', 'https://tiktok.com/', '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000">
  <path d="M16.5 3c.3 2.2 1.6 3.7 3.8 3.9v3a7 7 0 0 1-3.8-1.2v6.2a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.8 2.5V3h2.9Z"/>
</svg>'''),
  youtube('YouTube', 'https://youtube.com/', '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000">
  <path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8ZM10 15V9l5.2 3L10 15Z"/>
</svg>'''),
  facebook('Facebook', 'https://facebook.com/', '''
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#000">
  <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z"/>
</svg>''');

  const Social(this.label, this.url, this.svg);

  /// Placeholder handles, as on the web; swap for the real accounts.
  final String label;
  final String url;
  final String svg;
}

class SocialIcon extends StatelessWidget {
  const SocialIcon(this.social, {super.key, this.size = 20, this.color});

  final Social social;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => SvgPicture.string(
    social.svg,
    width: size,
    height: size,
    colorFilter: ColorFilter.mode(
      color ?? IconTheme.of(context).color ?? AppColors.ivory,
      BlendMode.srcIn,
    ),
  );
}

/// A category poster on the shelf, after the website (`home/poster.tsx`):
/// the film-still cover in a frame of its tone colour, with the corner
/// sticker. Picked posters lift, tilt a little and cast an ink shadow;
/// coming-soon ones are greyed under a stamp.
class Poster extends StatelessWidget {
  const Poster({
    super.key,
    required this.category,
    this.tone,
    this.showNewBadge = true,
    this.badge = true,
    this.selected = false,
    this.order,
    this.soon = false,
  });

  final Category category;

  /// Tone index; derived from the category when null.
  final int? tone;

  /// Shows "جديد" on the new challenge formats.
  final bool showNewBadge;

  /// The corner sticker ("؟", or green when [selected]).
  final bool badge;
  final bool selected;

  /// Place in the pick, shown on the sticker when [selected].
  final String? order;

  /// Not playable yet: greyed with a "قريبًا" stamp.
  final bool soon;

  /// Cover proportions (the website's 4:5).
  static const aspect = 4 / 5;

  /// Room the corner sticker takes beyond the frame.
  static const badgeRoom = 10.0;

  /// The height a poster of [width] needs, sticker included.
  static double heightFor(double width) =>
      (width - badgeRoom) / aspect + badgeRoom;

  /// The width a poster gets in [height], sticker included.
  static double widthFor(double height) =>
      (height - badgeRoom) * aspect + badgeRoom;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final t = tone ?? toneFor(category.id);
    final frame = AnimatedContainer(
      duration: motionFor(context, const Duration(milliseconds: 200)),
      decoration: BoxDecoration(
        color: AppColors.paper,
        border: Border.all(color: coverBorders[toneOf(t)], width: 4),
        borderRadius: BorderRadius.circular(4),
        boxShadow: selected
            ? [const BoxShadow(color: AppColors.ink, offset: Offset(6, 6))]
            : const [
                BoxShadow(
                  color: Color(0x8C1D2321),
                  offset: Offset(0, 10),
                  blurRadius: 14,
                  spreadRadius: -8,
                ),
                BoxShadow(color: Color(0x401D2321), offset: Offset(0, 2)),
              ],
      ),
      child: AspectRatio(
        aspectRatio: aspect,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColorFiltered(
              colorFilter: soon
                  ? const ColorFilter.matrix(_greyscale)
                  : const ColorFilter.mode(Color(0x00000000), BlendMode.dst),
              child: CategoryCover(
                image: BrandImages.category(category.id),
                name: lang.t(category.name, category.nameEn),
                tone: t,
                // The title sits clear of the corner sticker.
                footInset: badge && !soon ? 36 - badgeRoom : 0,
              ),
            ),
            if (selected)
              const DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.fromBorderSide(
                    BorderSide(color: Color(0xCC1D2321), width: 3),
                  ),
                ),
              ),
            if (soon)
              ColoredBox(
                color: AppColors.ink.withValues(alpha: 0.55),
                child: Center(
                  child: Transform.rotate(
                    angle: -0.1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppColors.ivory, width: 3),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        lang.t('قريبًا', '2orayeban'),
                        style: AppText.display(20, color: AppColors.ivory),
                      ),
                    ),
                  ),
                ),
              )
            else if (showNewBadge && category.isNew)
              PositionedDirectional(
                top: 6,
                start: 6,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 1,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.press,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.ink, width: 2),
                  ),
                  child: Text(
                    lang.t('جديد', 'Gdeed'),
                    style: AppText.sans(
                      12,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );

    return Padding(
      // The sticker hangs off the bottom corner, inside this padding.
      padding: const EdgeInsetsDirectional.only(
        end: badgeRoom,
        bottom: badgeRoom,
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          AnimatedSlide(
            duration: motionFor(context, const Duration(milliseconds: 200)),
            offset: selected ? const Offset(0, -0.03) : Offset.zero,
            child: AnimatedRotation(
              duration: motionFor(context, const Duration(milliseconds: 200)),
              turns: selected ? -1 / 360 : 0,
              child: frame,
            ),
          ),
          if (badge && !soon)
            PositionedDirectional(
              end: -badgeRoom,
              bottom: -badgeRoom,
              child: PosterBadge(selected: selected, order: order),
            ),
        ],
      ),
    );
  }
}

/// Luminance-weighted greyscale.
const _greyscale = <double>[
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0, 0, 0, 1, 0,
];
