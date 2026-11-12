import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../shell/app_route.dart';
import '../shell/link_opener.dart';

/// Account, settings, help and "about" — the app's home for what the
/// website keeps in its footer.
class MorePage extends StatelessWidget {
  const MorePage({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final muted = AppColors.ivory.withValues(alpha: 0.6);

    final title = Text(
      lang.t('المزيد', 'Aktar'),
      style: AppText.display(34, height: 1.1),
    );
    final settings = <Widget>[
      _Group(
        children: [
          _Row(
            icon: LucideIcons.userRound,
            title: lang.t('سجّل دخولك', 'Sagel dokhoolak'),
            subtitle: lang.t(
              'برقم الواتساب عشان توكنزك وتقدمك يتحفظوا',
              'B raqam el WhatsApp 3ashan tokenzak w ta2adomak yet7efzo',
            ),
            onTap: () => nav.go(AppRoute.account),
          ),
        ],
      ),
      _GroupTitle(lang.t('الإعدادات', 'El E3dadat')),
      _Group(
        children: [
          Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                const _RowIcon(LucideIcons.languages),
                const SizedBox(width: 14),
                Expanded(
                  child: Text(
                    lang.t('اللغة', 'El Logha'),
                    style: AppText.sans(16, weight: FontWeight.w600),
                  ),
                ),
                const _LanguageSwitch(),
              ],
            ),
          ),
        ],
      ),
      _GroupTitle(lang.t('مساعدة', 'Mosa3da')),
      _Group(
        children: [
          _Row(
            icon: LucideIcons.headset,
            title: lang.t('تواصل معنا', 'Kalemna'),
            onTap: () => nav.go(AppRoute.contact),
          ),
          _Row(
            icon: LucideIcons.messageCircleHeart,
            title: lang.t('شاركنا تجربتك', 'Sharekna tagrobtak'),
            onTap: () => nav.go(AppRoute.experience),
          ),
          _Row(
            icon: LucideIcons.handshake,
            title: lang.t('بيزنس ووظائف', 'Business w Wazayef'),
            subtitle: lang.t(
              'شراكات، فعاليات، ووظائف',
              'Sharakat, fa3alyat, w wazayef',
            ),
            onTap: () => nav.go(AppRoute.business),
          ),
        ],
      ),
    ];
    final about = <Widget>[
      _GroupTitle(lang.t('عن صح صح', '3an Sa7Sa7')),
      _Quote(
        label: lang.t('الرسالة', 'El Resala'),
        text: lang.t(
          'بنجمع الثقافة اللي بتخلينا مصريين، ونحولها للعب بيرجّع الأجيال والخلفيات والعقول لبعض… ويثبت إننا مع بعض نعرف كل حاجة.',
          'Bengama3 el sa2afa elly btekhaleena masreyeen, w n7awelha le la3b beyraga3 el agyal wel khalfeyat wel 3o2ool le ba3d… w yesbet enena ma3 ba3d ne3raf kol 7aga.',
        ),
      ),
      const SizedBox(height: 12),
      _Quote(
        label: lang.t('الرؤية', 'El Ro2ya'),
        text: lang.t(
          'نكون الأرشيف الحي للثقافة المصرية: المكان اللي معرفة كل جيل بتفضل فيه عايشة ومتشاركة ومتحتفل بيها… سؤال ورا سؤال.',
          'Nekoon el arsheef el 7ay lel sa2afa el masreya: el makan elly ma3refet kol geel btefdal feeh 3aysha w metsharka w met7tefel beeha… so2al wara so2al.',
        ),
      ),
      const SizedBox(height: 28),
      Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (final social in Social.values) ...[
            if (social != Social.values.first) const SizedBox(width: 10),
            Semantics(
              link: true,
              label: social.label,
              child: Pressable(
                onTap: () => openExternal(social.url),
                child: Container(
                  width: 48,
                  height: 48,
                  decoration: glassDecoration(
                    shape: BoxShape.circle,
                    shadow: false,
                  ),
                  alignment: Alignment.center,
                  child: SocialIcon(social, size: 20),
                ),
              ),
            ),
          ],
        ],
      ),
      const SizedBox(height: 14),
      Text(
        '© ${lang.toAr(DateTime.now().year)} ${lang.t('صح صح', 'Sa7Sa7')}',
        textAlign: TextAlign.center,
        style: AppText.sans(12, color: muted),
      ),
    ];

    return Padding(
      // Landscape: the shell already pads the sides.
      padding: EdgeInsets.fromLTRB(_side(context), 8, _side(context), 0),
      child: LayoutBuilder(
        builder: (context, box) {
          Widget column(List<Widget> children) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          );
          // Wide (landscape): settings and help beside "about".
          // The landscape top bar already names the screen.
          if (box.maxWidth > 700) {
            return column([
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: column([const SizedBox(height: 8), ...settings]),
                  ),
                  const SizedBox(width: 20),
                  Expanded(child: column(about)),
                ],
              ),
            ]);
          }
          return column([
            title,
            const SizedBox(height: 16),
            ...settings,
            ...about,
          ]);
        },
      ),
    );
  }
}

class _GroupTitle extends StatelessWidget {
  const _GroupTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(4, 24, 4, 8),
      child: Text(
        text,
        style: AppText.sans(13, weight: FontWeight.w700, color: AppColors.gold),
      ),
    );
  }
}

/// Settings-style glass group with dividers between rows.
class _Group extends StatelessWidget {
  const _Group({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Glass(
      radius: 20,
      shadow: false,
      child: Column(
        children: [
          for (final (i, child) in children.indexed) ...[
            if (i > 0)
              Divider(
                height: 1,
                indent: 64,
                endIndent: 14,
                color: Colors.white.withValues(alpha: 0.08),
              ),
            child,
          ],
        ],
      ),
    );
  }
}

class _RowIcon extends StatelessWidget {
  const _RowIcon(this.icon);

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: AppColors.gold.withValues(alpha: 0.15),
      ),
      child: Icon(icon, size: 19, color: AppColors.gold),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Semantics(
      button: true,
      child: Pressable(
        scale: 0.98,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              _RowIcon(icon),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppText.sans(16, weight: FontWeight.w600),
                    ),
                    if (subtitle != null)
                      Text(
                        subtitle!,
                        style: AppText.sans(
                          12,
                          color: AppColors.ivory.withValues(alpha: 0.55),
                        ),
                      ),
                  ],
                ),
              ),
              Icon(
                rtl ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                size: 20,
                color: AppColors.ivory.withValues(alpha: 0.45),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// عربي | Franco segmented switch.
class _LanguageSwitch extends StatelessWidget {
  const _LanguageSwitch();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    Widget option(Lang value, String label) {
      final selected = lang.lang == value;
      return Semantics(
        button: true,
        selected: selected,
        child: Pressable(
          onTap: () => lang.setLang(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: selected ? AppColors.gold : Colors.transparent,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              label,
              style: AppText.sans(
                14,
                weight: FontWeight.w700,
                color: selected ? AppColors.forest : AppColors.ivory,
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.black.withValues(alpha: 0.25),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [option(Lang.ar, 'عربي'), option(Lang.en, 'Franco')],
      ),
    );
  }
}

class _Quote extends StatelessWidget {
  const _Quote({required this.label, required this.text});

  final String label;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: paperDecoration(radius: BorderRadius.circular(20)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.quote, size: 20, color: AppColors.gold),
              const SizedBox(width: 8),
              Text(
                label,
                style: AppText.sans(
                  12,
                  weight: FontWeight.w700,
                  color: AppColors.forest.withValues(alpha: 0.55),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: AppText.display(19, height: 1.45, color: AppColors.forest),
          ),
        ],
      ),
    );
  }
}

double _side(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return size.width > size.height ? 0 : 16;
}
