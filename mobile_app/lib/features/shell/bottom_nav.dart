import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import 'app_route.dart';

/// Height of the floating bar (56px items + 6px padding each side).
const bottomNavHeight = 68.0;

/// The four tabs around the play button.
List<_Tab> _tabs(LangController lang, AppRoute route) => [
  _Tab(
    LucideIcons.house,
    lang.t('الرئيسية', 'Re2eseya'),
    AppRoute.home,
    route == AppRoute.home,
  ),
  _Tab(
    LucideIcons.layoutGrid,
    lang.t('الفئات', 'Fe2at'),
    AppRoute.categories,
    route == AppRoute.categories,
  ),
  _Tab(
    LucideIcons.shoppingBag,
    lang.t('المتجر', 'El Matgar'),
    AppRoute.shop,
    route == AppRoute.shop || route == AppRoute.gift,
  ),
  _Tab(
    LucideIcons.ellipsis,
    lang.t('المزيد', 'Aktar'),
    AppRoute.more,
    const {
      AppRoute.more,
      AppRoute.account,
      AppRoute.contact,
      AppRoute.business,
      AppRoute.experience,
    }.contains(route),
  ),
];

class _Tab {
  const _Tab(this.icon, this.label, this.route, this.active);

  final IconData icon;
  final String label;
  final AppRoute route;
  final bool active;
}

/// Frosted glass panel behind the nav, with its shadow outside the clip.
class _GlassPanel extends StatelessWidget {
  const _GlassPanel({required this.radius});

  final BorderRadius radius;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Positioned.fill(
          child: ClipRRect(
            borderRadius: radius,
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 7, sigmaY: 7),
              child: DecoratedBox(
                decoration: glassDecoration(radius: radius, shadow: false),
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: radius,
                boxShadow: [
                  cssShadow(const Color(0x40000000), y: 20, blur: 50),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// The round red "العب" button.
class _PlayTab extends StatelessWidget {
  const _PlayTab({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return PlayButton(
      width: size,
      height: size,
      radius: size / 2,
      ringColor: AppColors.deep,
      ringWidth: 4,
      semanticLabel: lang.t('العب', 'El3ab'),
      onPressed: () => ShellNav.of(context).go(AppRoute.play),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.play_arrow_rounded, size: 24),
          const SizedBox(height: 4),
          Text(
            lang.t('العب', 'El3ab'),
            style: AppText.sans(
              15,
              weight: FontWeight.w700,
              color: Colors.white,
              height: 1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Portrait fallback: floating glass tab bar with the raised play button.
class BottomNav extends StatelessWidget {
  const BottomNav({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final tabs = _tabs(lang, ShellNav.of(context).route);
    final radius = BorderRadius.circular(16);

    return Semantics(
      container: true,
      label: lang.t('التنقل', 'El tan2ol'),
      child: SizedBox(
        height: bottomNavHeight,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned.fill(child: _GlassPanel(radius: radius)),
            Padding(
              padding: const EdgeInsets.all(6),
              child: Row(
                children: [
                  for (final (i, tab) in tabs.indexed) ...[
                    if (i == 2) const Expanded(child: SizedBox()),
                    Expanded(child: _NavItem(tab: tab)),
                  ],
                ],
              ),
            ),
            // `-mt-7` on a 70px button centred in the 56px row; ring adds 4px.
            const Positioned(
              top: -19,
              left: 0,
              right: 0,
              child: Center(child: _PlayTab(size: 78)),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.tab});

  final _Tab tab;

  @override
  Widget build(BuildContext context) {
    final color = tab.active
        ? AppColors.gold
        : AppColors.ivory.withValues(alpha: 0.75);
    return Semantics(
      button: true,
      selected: tab.active,
      child: Pressable(
        onTap: () => ShellNav.of(context).go(tab.route),
        child: SizedBox(
          height: 56,
          width: 84,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(tab.icon, size: 20, color: color),
              const SizedBox(height: 2),
              Text(
                tab.label,
                maxLines: 1,
                overflow: TextOverflow.fade,
                softWrap: false,
                style: AppText.sans(11, weight: FontWeight.w600, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
