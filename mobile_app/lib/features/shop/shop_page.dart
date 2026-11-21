import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import '../../data/shop.dart';
import '../game/setup_screen.dart';
import '../shared/form_widgets.dart';

/// Token shop with a "for you" and a "gift" tab (prototype `TokensPage`).
/// Payments aren't in the backend yet, so buying explains that games are
/// free for now instead of charging.
class ShopPage extends StatefulWidget {
  const ShopPage({super.key, this.gift = false});

  /// Open on the gift tab.
  final bool gift;

  @override
  State<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends State<ShopPage> {
  late bool _gift = widget.gift;
  final _phone = TextEditingController();
  final _note = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _note.dispose();
    super.dispose();
  }

  void _buy(int count) {
    final lang = context.lang;
    if (_gift && !isEgyptianMobile(_phone.text)) {
      setState(
        () => _error = lang.t(
          'اكتب رقم موبايل مصري صح للمستلم، زي ٠١٠ ٠٠٠ ٠٠٠٠.',
          'Ekteb raqam mobile masry sa7 lel mostalem, zay 010 000 0000.',
        ),
      );
      return;
    }
    setState(() => _error = null);
    showNoticeSheet(
      context,
      icon: _gift ? LucideIcons600.gift : LucideIcons600.coins,
      title: lang.t('الشراء جاي قريب', 'El shera2 gay 2orayeb'),
      message: _gift
          ? lang.t(
              'إهداء التوكنز هيشتغل مع الدفع بفوري والمحافظ في المرحلة الجاية. لحد كده، اللعب مجاني ليك ولصحابك.',
              'Ehda2 el tokens hayeshtaghal ma3 el daf3 b Fawry wel ma7afez fel mar7ala el gaya. Le7ad keda, el le3b magany leek w le s7abak.',
            )
          : lang.t(
              'الدفع بفوري والمحافظ الإلكترونية جاي في المرحلة الجاية. لحد ما المتجر يفتح، اللعب مجاني.',
              'El daf3 b Fawry wel ma7afez el electroneya gay fel mar7ala el gaya. Le7ad ma el matgar yefta7, el le3b magany.',
            ),
      actionLabel: lang.t('العب دلوقتي', 'El3ab delwa2ty'),
      onAction: () {
        if (mounted) openSetup(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final discount = lang.toAr((giftDiscount * 100).round());

    final tabs = Row(
      children: [
        Expanded(
          child: ChoicePills<bool>(
            options: [
              (false, lang.t('لنفسك', 'Lenafsak'), LucideIcons.coins),
              (
                true,
                lang.t('هدية · خصم $discount٪', 'Hedeya · $discount% off'),
                LucideIcons.gift,
              ),
            ],
            selected: _gift,
            onSelect: (v) => setState(() {
              _gift = v;
              _error = null;
            }),
          ),
        ),
        const SizedBox(width: 10),
        const _FreeBadge(),
      ],
    );

    final packs = Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        for (final (i, count) in tokenPacks.indexed) ...[
          if (i > 0) const SizedBox(width: 12),
          Expanded(
            child: _PackCard(
              count: count,
              gift: _gift,
              onBuy: () => _buy(count),
            ),
          ),
        ],
      ],
    );

    final recipient = PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            lang.t('اهدي صاحبك لعبة', 'Ehdy sa7bak le3ba'),
            style: AppText.display(24, height: 1.2),
          ),
          Text(
            lang.t(
              'التوكنز بتوصل للمستلم على رقم موبايله.',
              'El tokens btewsal lel mostalem 3ala raqam mobailo.',
            ),
            style: AppText.sans(13, color: context.mutedText),
          ),
          const SizedBox(height: 12),
          SahsahField(
            fieldKey: const ValueKey('gift-phone'),
            label: lang.t('رقم المستلم', 'Raqam el mostalem'),
            controller: _phone,
            hint: '010 000 0000',
            ltr: true,
            keyboardType: TextInputType.phone,
            maxLength: 16,
            onChanged: (_) {
              if (_error != null) setState(() => _error = null);
            },
          ),
          const SizedBox(height: 10),
          SahsahField(
            label: lang.t('رسالة', 'Resala'),
            optional: true,
            controller: _note,
            maxLength: 80,
          ),
          FormError(_error),
        ],
      ),
    );

    final footnote = Row(
      children: [
        Icon(LucideIcons.info, size: 15, color: context.accentText),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            lang.t(
              'توكن واحد = لعبة واحدة بـ٣٦ سؤال. الدفع بفوري أو المحافظ الإلكترونية.',
              'Token wa7ed = le3ba wa7da b 36 so2al. El daf3 b Fawry aw el ma7afez el electroneya.',
            ),
            style: AppText.sans(12, color: context.mutedText),
          ),
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth > 700;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            tabs,
            const SizedBox(height: 18),
            if (_gift && wide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 280, child: recipient),
                  const SizedBox(width: 16),
                  Expanded(child: packs),
                ],
              )
            else ...[
              if (_gift) ...[recipient, const SizedBox(height: 16)],
              packs,
            ],
            const SizedBox(height: 16),
            footnote,
          ],
        );
      },
    );
  }
}

/// "Games are free right now" while the shop is closed.
class _FreeBadge extends StatelessWidget {
  const _FreeBadge();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.green,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.ink, width: 2.5),
        boxShadow: [inkDrop(3)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            LucideIcons600.partyPopper,
            size: 15,
            color: AppColors.ink,
          ),
          const SizedBox(width: 6),
          Text(
            lang.t('اللعب مجاني دلوقتي', 'El le3b magany delwa2ty'),
            style: AppText.sans(
              12,
              weight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

/// One pack: how many games, the price, and a buy (or gift) button. The
/// most popular pack is printed in yellow, with a red ribbon.
class _PackCard extends StatelessWidget {
  const _PackCard({
    required this.count,
    required this.gift,
    required this.onBuy,
  });

  final int count;
  final bool gift;
  final VoidCallback onBuy;

  String _money(LangController lang, double value) {
    final whole = value == value.roundToDouble();
    return lang.toAr(whole ? value.round() : value.toStringAsFixed(2));
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final featured = count == featuredPack;
    // Printed cards on the paper, as on the website: cream, or yellow for
    // the featured pack, both with ink text.
    const ink = AppColors.ink;
    const muted = AppColors.inkMuted;
    final price = packPrice(count, gift: gift);
    final list = packListPrice(count);

    final card = Container(
      padding: const EdgeInsets.fromLTRB(12, 18, 12, 12),
      decoration: paperDecoration(
        radius: BorderRadius.circular(22),
        color: featured ? AppColors.sun : AppColors.paper,
        drop: featured ? 8 : 5,
      ),
      child: Column(
        children: [
          Icon(
            LucideIcons600.coins,
            size: 22,
            color: featured ? AppColors.ink : AppColors.press,
          ),
          const SizedBox(height: 4),
          Text(
            lang.toAr(count),
            style: AppText.num(44, color: ink, height: 1.1),
          ),
          Text(
            count == 1 ? lang.t('لعبة', 'Le3ba') : lang.t('ألعاب', 'Al3ab'),
            style: AppText.sans(13, weight: FontWeight.w600, color: muted),
          ),
          const SizedBox(height: 8),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  _money(lang, price),
                  style: AppText.num(26, color: ink, height: 1),
                ),
                const SizedBox(width: 4),
                Text(
                  lang.t('ج.م', 'EGP'),
                  style: AppText.sans(12, weight: FontWeight.w600, color: ink),
                ),
                if (price < list) ...[
                  const SizedBox(width: 6),
                  Text(
                    lang.toAr(list),
                    style: AppText.num(14, color: muted, height: 1).copyWith(
                      decoration: TextDecoration.lineThrough,
                      decorationColor: muted,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          GameButton(
            height: 48,
            radius: 14,
            depth: 5,
            color: AppColors.play,
            onTap: onBuy,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  gift ? LucideIcons600.gift : LucideIcons600.shoppingCart,
                  size: 18,
                  color: Colors.white,
                ),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    gift ? lang.t('اهدي', 'Ehdy') : lang.t('اشتري', 'Eshtery'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      17,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (!featured) return card;
    // Ribbon above the most popular pack.
    return Stack(
      clipBehavior: Clip.none,
      alignment: Alignment.topCenter,
      children: [
        card,
        Positioned(
          top: -11,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.press,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.ink, width: 2.5),
            ),
            child: Text(
              lang.t('الأكثر طلبًا', 'El aktar talaban'),
              style: AppText.sans(
                12,
                weight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
