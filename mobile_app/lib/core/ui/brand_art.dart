import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../data/categories.dart';
import '../i18n/lang.dart';
import '../theme/app_theme.dart';
import 'retro.dart';

abstract final class BrandImages {
  static const plaque = 'assets/logo/plaque.png';
  static const divider = 'assets/logo/divider.png';
  static const hero = 'assets/img/hero.webp';
  static const herowide = 'assets/img/herowide.webp';
  static const coins = 'assets/img/coins.webp';
  static const comedy = 'assets/img/comedy.webp';
  static const cinema = 'assets/img/cinema.webp';
  static const football = 'assets/img/football.webp';
  static const music = 'assets/img/music.webp';
  static const ramadan = 'assets/img/ramadan.webp';

  static String category(String id) => 'assets/img/$id.webp';
}

/// The brand mark: the stacked retro "صح صح" ([RetroLogo]), [size] tall.
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) => RetroLogo(fontSize: size * 0.72);
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

/// Category poster: A4-portrait artwork with a gold-ruled title strip.
class Poster extends StatelessWidget {
  const Poster({
    super.key,
    required this.category,
    this.titleSize = 18,
    this.radius = 18,
    this.showNewBadge = true,
  });

  final Category category;
  final double titleSize;
  final double radius;

  /// Shows "جديد" on the new challenge formats.
  final bool showNewBadge;

  /// `min-h-[3.5rem]` (border-box, so it includes the 3px rule).
  static const stripMinHeight = 56.0;

  /// Space to reserve below the artwork: a two-line title is 3 + 12 + 45,
  /// plus 2px for text-metric rounding.
  static const stripMaxHeight = 62.0;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: ColoredBox(
        color: AppColors.poster,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 210 / 297,
              child: ColoredBox(
                color: AppColors.card,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Image.asset(
                      BrandImages.category(category.id),
                      fit: BoxFit.cover,
                    ),
                    if (showNewBadge && category.isNew)
                      PositionedDirectional(
                        top: 8,
                        start: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.gold,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            lang.t('جديد', 'Gdeed'),
                            style: AppText.sans(
                              11,
                              weight: FontWeight.w700,
                              color: AppColors.forest,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            Container(
              constraints: const BoxConstraints(minHeight: stripMinHeight),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.poster,
                border: Border(
                  top: BorderSide(
                    color: AppColors.gold.withValues(alpha: 0.7),
                    width: 3,
                  ),
                ),
              ),
              alignment: Alignment.center,
              child: Text(
                lang.t(category.name, category.nameEn),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(titleSize, height: 1.25),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
