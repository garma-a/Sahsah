import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/retro.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import '../categories/category_widgets.dart';
import '../game/board_screen.dart';
import '../game/game_controller.dart';
import '../game/ui/game_ui.dart';
import '../shell/app_route.dart';

part 'lobby.dart';

/// Game lobby: start or join first, then browse categories.
/// See `docs/mobile-game-design.md`.
class HomePage extends StatelessWidget {
  const HomePage({super.key, required this.tokens});

  final int tokens;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);

    final active = context.game.hasActiveGame ? context.game.game : null;
    final size = MediaQuery.sizeOf(context);

    // Landscape (the app's orientation): a one-screen game lobby. The
    // scrolling layout below is the portrait fallback.
    if (size.width > size.height) {
      return _Reveal(
        child: _Lobby(tokens: tokens, active: active),
      );
    }

    Widget padded(Widget child) => Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: child,
    );

    final resume = active == null ? null : padded(_ResumeCard(game: active));
    final play = padded(_PlayCard(tokens: tokens));
    final rows = [
      for (final section in categorySections)
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionHeader(
              title: lang.t(section.name, section.nameEn),
              onSeeAll: () => nav.go(AppRoute.categories),
            ),
            PosterRow(categories: section.categories, width: 132),
          ],
        ),
    ];
    final howTo = padded(
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Semantics(
              header: true,
              child: Text(
                lang.t('إزاي نلعب؟', 'Ezay nel3ab?'),
                style: AppText.display(24, height: 1.2),
              ),
            ),
          ),
          _Steps(steps: _howToSteps(lang)),
        ],
      ),
    );
    final gift = padded(_GiftCard(onTap: () => nav.go(AppRoute.gift)));

    Widget stack(List<Widget> items, {double gap = 28}) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (i, item) in items.indexed) ...[
          if (i > 0) SizedBox(height: gap),
          item,
        ],
      ],
    );

    return _Reveal(
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (resume != null) ...[resume, const SizedBox(height: 14)],
            stack([play, ...rows, howTo, gift]),
          ],
        ),
      ),
    );
  }
}

/// The main call to action: host a game or join one.
class _PlayCard extends StatelessWidget {
  const _PlayCard({required this.tokens});

  final int tokens;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final radius = BorderRadius.circular(28);

    return Container(
      decoration: BoxDecoration(
        borderRadius: radius,
        color: AppColors.card,
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.25)),
        boxShadow: [cssShadow(const Color(0x73000000), y: 24, blur: 60)],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            Positioned.fill(
              child: Image.asset(
                BrandImages.herowide,
                fit: BoxFit.cover,
                alignment: const Alignment(-0.6, -0.4),
              ),
            ),
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      AppColors.card,
                      Color(0xE6101540),
                      Color(0x33101540),
                    ],
                    stops: [0, 0.45, 1],
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 120, 18, 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    lang.t('يلا نلعب؟', 'Yalla nel3ab?'),
                    style: AppText.display(40, height: 1.1),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _Chip(
                        icon: LucideIcons.users,
                        label: lang.t('فريقين', 'Fare2een'),
                      ),
                      _Chip(
                        icon: LucideIcons.layoutGrid,
                        label: lang.t(
                          '${lang.toAr(boardCategories)} فئات',
                          '$boardCategories fe2at',
                        ),
                      ),
                      _Chip(
                        icon: LucideIcons.circleQuestionMark,
                        label: lang.t(
                          '${lang.toAr(boardQuestions)} سؤال',
                          '$boardQuestions so2al',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: PlayButton(
                          height: 60,
                          sheen: true,
                          onPressed: () => nav.go(AppRoute.play),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.play_arrow_rounded, size: 26),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  lang.t('ابدأ لعبة', 'Ebda2 le3ba'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.sans(
                                    20,
                                    weight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: Semantics(
                          button: true,
                          child: Pressable(
                            onTap: nav.openJoin,
                            child: Container(
                              height: 60,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                              ),
                              decoration: glassDecoration(
                                radius: BorderRadius.circular(16),
                                borderColor: AppColors.gold.withValues(
                                  alpha: 0.45,
                                ),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(
                                    LucideIcons600.keyRound,
                                    size: 19,
                                    color: AppColors.gold,
                                  ),
                                  const SizedBox(width: 8),
                                  Flexible(
                                    child: FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        lang.t('ادخل بكود', 'Bel code'),
                                        maxLines: 1,
                                        style: AppText.sans(
                                          16,
                                          weight: FontWeight.w700,
                                          color: AppColors.gold,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _TokenLine(tokens: tokens),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Token note under the play buttons. Local games are free until the
/// backend has accounts and the shop.
class _TokenLine extends StatelessWidget {
  const _TokenLine({required this.tokens});

  final int tokens;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(LucideIcons.coins, size: 15, color: AppColors.gold),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            lang.t(
              'تجريبي: اللعب مجاني لحد ما المتجر يفتح',
              'Tagreeby: el le3b magany le7ad ma el matgar yeftah',
            ),
            style: AppText.sans(
              13,
              color: AppColors.ivory.withValues(alpha: 0.65),
            ),
          ),
        ),
      ],
    );
  }
}

/// Unfinished game on this phone: jump back to the board.
class _ResumeCard extends StatelessWidget {
  const _ResumeCard({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    void resume() => Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const BoardScreen()));

    return Semantics(
      button: true,
      child: Pressable(
        scale: 0.98,
        onTap: resume,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            color: AppColors.play.withValues(alpha: 0.14),
            border: Border.all(color: AppColors.play.withValues(alpha: 0.6)),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: AppColors.play,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  size: 28,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lang.t('كمّلوا لعبتكم', 'Kammelo le3betkom'),
                      style: AppText.display(20, height: 1.2),
                    ),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(
                        children: [
                          for (var t = 0; t < 2; t++) ...[
                            if (t > 0) const TextSpan(text: '  ·  '),
                            TextSpan(
                              text: '${game.teamNames[t]} ',
                              style: AppText.sans(13, weight: FontWeight.w600),
                            ),
                            TextSpan(
                              text: lang.toAr(game.scores[t]),
                              style: AppText.num(14, color: teamColors[t]),
                            ),
                          ],
                        ],
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                lang.toAr('${game.resolvedCount}/${game.totalQuestions}'),
                textDirection: TextDirection.ltr,
                style: AppText.num(
                  14,
                  color: AppColors.ivory.withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.black.withValues(alpha: 0.25),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.gold),
          const SizedBox(width: 6),
          Text(label, style: AppText.sans(13, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// "How to play": the three steps as compact rows in one card.
class _Steps extends StatelessWidget {
  const _Steps({required this.steps});

  final List<(String, String)> steps;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Glass(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 6),
      child: Column(
        children: [
          for (final (i, (title, sub)) in steps.indexed) ...[
            if (i > 0)
              Divider(height: 1, color: Colors.white.withValues(alpha: 0.08)),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      lang.toAr(i + 1),
                      style: AppText.num(18, color: AppColors.forest),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppText.display(21, height: 1.3)),
                        Text(
                          sub,
                          style: AppText.sans(
                            13,
                            color: AppColors.ivory.withValues(alpha: 0.6),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Compact gift promo that leads to the shop's gift section.
class _GiftCard extends StatelessWidget {
  const _GiftCard({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final discount = lang.toAr((giftDiscount * 100).round());
    final radius = BorderRadius.circular(22);
    return Semantics(
      button: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 116),
          foregroundDecoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
          ),
          child: ClipRRect(
            borderRadius: radius,
            child: Stack(
              children: [
                Positioned.fill(
                  child: Image.asset(
                    BrandImages.coins,
                    fit: BoxFit.cover,
                    alignment: const Alignment(0.6, 0),
                  ),
                ),
                Positioned.fill(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        begin: AlignmentDirectional.centerStart,
                        end: AlignmentDirectional.centerEnd,
                        colors: [
                          AppColors.card,
                          Color(0xD9101540),
                          Color(0x33101540),
                        ],
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: AppColors.play,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                lang.t('خصم $discount٪', '$discount% off'),
                                style: AppText.sans(
                                  12,
                                  weight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              lang.t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba'),
                              style: AppText.display(24, height: 1.1),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        width: 44,
                        height: 44,
                        decoration: const BoxDecoration(
                          color: AppColors.gold,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          LucideIcons600.gift,
                          size: 22,
                          color: AppColors.forest,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Fade up 12px over 420 ms when the page opens.
class _Reveal extends StatelessWidget {
  const _Reveal({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 420),
      curve: easeBrand,
      builder: (context, v, child) => Opacity(
        opacity: v,
        child: Transform.translate(
          offset: Offset(0, 12 * (1 - v)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}
