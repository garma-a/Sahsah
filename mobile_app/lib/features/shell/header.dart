import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import 'app_route.dart';

/// Game top bar: logo at the start, language and token wallet at the end.
const headerBarHeight = 64.0;

/// Floating header: slides away while scrolling down, snaps back on the way
/// up. Translucent deep green with a backdrop blur.
class ShellHeaderDelegate extends SliverPersistentHeaderDelegate {
  const ShellHeaderDelegate({required this.tokens, required this.vsync});

  final int tokens;

  @override
  final TickerProvider vsync;

  static const extent = headerBarHeight;

  @override
  double get minExtent => extent;

  @override
  double get maxExtent => extent;

  @override
  FloatingHeaderSnapConfiguration get snapConfiguration =>
      FloatingHeaderSnapConfiguration(
        curve: Curves.easeOutCubic,
        duration: const Duration(milliseconds: 220),
      );

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlaps) {
    return ClipRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Container(
          // The sliver hands us loose constraints; fill the whole bar.
          height: headerBarHeight,
          color: AppColors.deep.withValues(alpha: 0.8),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                // The logo gives way first on narrow phones.
                const Expanded(
                  child: Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: FittedBox(fit: BoxFit.scaleDown, child: _HomeLogo()),
                  ),
                ),
                const SizedBox(width: 8),
                const LangToggle(),
                const SizedBox(width: 8),
                TokenWallet(tokens: tokens),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(ShellHeaderDelegate oldDelegate) =>
      tokens != oldDelegate.tokens || vsync != oldDelegate.vsync;
}

class _HomeLogo extends StatelessWidget {
  const _HomeLogo();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      label: lang.t('الرئيسية', 'El Re2eseya'),
      child: Pressable(
        haptic: false,
        onTap: () => ShellNav.of(context).go(AppRoute.home),
        child: const Logo(size: 44),
      ),
    );
  }
}

/// Round glass button that switches Arabic ↔ Franco.
class LangToggle extends StatelessWidget {
  const LangToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      label: lang.t('Switch to English (Franco)', 'غيّر للعربي'),
      excludeSemantics: true,
      child: Pressable(
        onTap: lang.toggle,
        child: Container(
          height: 44,
          constraints: const BoxConstraints(minWidth: 44),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: glassDecoration(
            radius: BorderRadius.circular(999),
            shadow: false,
          ),
          child: Center(
            widthFactor: 1,
            child: Text(
              lang.ar ? 'EN' : 'عربي',
              style: AppText.sans(14, weight: FontWeight.w700),
            ),
          ),
        ),
      ),
    );
  }
}

/// Game-style wallet: coin, balance and a "+" to top up in the shop.
class TokenWallet extends StatelessWidget {
  const TokenWallet({super.key, required this.tokens});

  final int tokens;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    // While the shop is closed every game is free, so say that instead of
    // a zero balance (an Arabic "٠" also reads like a stray dot).
    final free = tokens == 0;
    return Semantics(
      button: true,
      label: free
          ? lang.t(
              'اللعب مجاني دلوقتي، المتجر',
              'El le3b magany delwa2ty, el matgar',
            )
          : lang.t(
              'رصيدك $tokens توكن، اشتري توكنز',
              'Rasidak $tokens token, eshtery tokens',
            ),
      excludeSemantics: true,
      child: Pressable(
        onTap: () => ShellNav.of(context).go(AppRoute.shop),
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 5),
          decoration: glassDecoration(
            radius: BorderRadius.circular(999),
            shadow: false,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: const BoxDecoration(
                  color: AppColors.gold,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  LucideIcons600.coins,
                  size: 18,
                  color: AppColors.forest,
                ),
              ),
              const SizedBox(width: 10),
              free
                  ? Text(
                      lang.t('مجاني', 'Magany'),
                      style: AppText.sans(
                        15,
                        weight: FontWeight.w700,
                        color: AppColors.gold,
                        height: 1,
                      ),
                    )
                  : Text(
                      lang.toAr(tokens),
                      textDirection: TextDirection.ltr,
                      style: AppText.num(20, height: 1),
                    ),
              const SizedBox(width: 10),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.18),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.5),
                  ),
                ),
                child: const Icon(
                  LucideIcons600.plus,
                  size: 15,
                  color: AppColors.gold,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
