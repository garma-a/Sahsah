import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../game/ui/game_ui.dart';
import 'app_route.dart';
import 'header.dart';

/// Height of the landscape top bar.
const hudHeight = 52.0;

/// Landscape top bar, like a game lobby: logo and player badge in the lobby,
/// a back button and the screen title elsewhere; coins and language on the
/// other side.
class GameHud extends StatelessWidget {
  const GameHud({super.key, required this.route, required this.tokens});

  final AppRoute route;
  final int tokens;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final home = route == AppRoute.home;

    return SizedBox(
      height: hudHeight,
      child: Row(
        children: [
          if (home) ...[
            const Logo(size: 44),
            const SizedBox(width: 12),
            const _PlayerBadge(),
            const Spacer(),
          ] else ...[
            RoundIconButton(
              key: const ValueKey('hud-back'),
              icon: lang.ar ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
              label: lang.t('رجوع', 'Rogoo3'),
              onTap: () => nav.go(AppRoute.home),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                routeTitle(lang, route),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(28, height: 1.1),
              ),
            ),
          ],
          TokenWallet(tokens: tokens),
          const SizedBox(width: 8),
          const LangToggle(),
        ],
      ),
    );
  }
}

/// Screen names for the top bar.
String routeTitle(LangController lang, AppRoute route) => switch (route) {
  AppRoute.home => lang.t('الرئيسية', 'El Re2eseya'),
  AppRoute.categories => lang.t('الفئات', 'El Fe2at'),
  AppRoute.play => lang.t('العب', 'El3ab'),
  AppRoute.shop => lang.t('المتجر', 'El Matgar'),
  AppRoute.more => lang.t('المزيد', 'Aktar'),
  AppRoute.gift => lang.t('اهدي توكنز', 'Ehdy tokens'),
  AppRoute.account => lang.t('حسابي', '7esaby'),
  AppRoute.contact => lang.t('تواصل معنا', 'Kalemna'),
  AppRoute.business => lang.t('بيزنس ووظائف', 'Business w Wazayef'),
  AppRoute.experience => lang.t('شاركنا تجربتك', 'Sharekna tagrobtak'),
};

/// Guest profile pill. Accounts aren't in the backend yet, so it leads to
/// the sign-in placeholder.
class _PlayerBadge extends StatelessWidget {
  const _PlayerBadge();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      child: Pressable(
        onTap: () => ShellNav.of(context).go(AppRoute.account),
        child: Container(
          height: 44,
          padding: const EdgeInsetsDirectional.fromSTEB(5, 5, 14, 5),
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
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.ui,
                  border: Border.all(color: AppColors.gold, width: 1.5),
                ),
                child: const Icon(
                  LucideIcons.userRound,
                  size: 18,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lang.t('ضيف', 'Deif'),
                    style: AppText.sans(
                      13,
                      weight: FontWeight.w700,
                      height: 1.2,
                    ),
                  ),
                  Text(
                    lang.t('سجّل دخولك', 'Sagel dokhoolak'),
                    style: AppText.sans(10, color: AppColors.gold, height: 1.2),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
