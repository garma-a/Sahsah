import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/surfaces.dart';
import '../shell/app_route.dart';

/// Stand-in for pages not ported yet (play, tokens, account, contact…).
class ComingSoonPage extends StatelessWidget {
  const ComingSoonPage({super.key, required this.route});

  final AppRoute route;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final (title, icon) = switch (route) {
      AppRoute.play => (lang.t('العب', 'El3ab'), LucideIcons.play),
      AppRoute.shop => (lang.t('المتجر', 'El Matgar'), LucideIcons.shoppingBag),
      AppRoute.gift => (lang.t('اهدي توكنز', 'Ehdy tokens'), LucideIcons.gift),
      AppRoute.account => (lang.t('حسابي', '7esaby'), LucideIcons.userRound),
      AppRoute.contact || AppRoute.business || AppRoute.experience => (
        lang.t('تواصل معنا', 'Kalemna'),
        LucideIcons.headset,
      ),
      AppRoute.home => (lang.t('الرئيسية', 'El Re2eseya'), LucideIcons.house),
      AppRoute.categories => (
        lang.t('الفئات', 'El Fe2at'),
        LucideIcons.layoutGrid,
      ),
      AppRoute.more => (lang.t('المزيد', 'Aktar'), LucideIcons.ellipsis),
    };

    return Padding(
      // Landscape: the shell already pads the sides.
      padding: EdgeInsets.fromLTRB(_side(context), 8, _side(context), 0),
      child: Glass(
        radius: 22,
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 30, color: AppColors.gold),
            const SizedBox(height: 12),
            Text(title, style: AppText.display(32, height: 1)),
            const SizedBox(height: 8),
            Text(
              lang.t(
                'الصفحة دي جاية في المرحلة الجاية.',
                'El saf7a di gaya fel mar7ala el gaya.',
              ),
              style: AppText.sans(
                14,
                color: AppColors.ivory.withValues(alpha: 0.6),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

double _side(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return size.width > size.height ? 0 : 16;
}
