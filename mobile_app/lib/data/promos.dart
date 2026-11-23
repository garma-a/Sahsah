import 'package:flutter/painting.dart';

import '../core/i18n/lang.dart';
import '../core/ui/brand_art.dart';
import 'catalog.dart';
import 'game_rules.dart';

/// What a promo's button does.
enum PromoAction {
  /// Open the categories, where the new section comes first.
  newPack,

  /// Open the shop's gift tab.
  gifts,

  /// Start setting up a game.
  play,

  /// Show the three "how to play" steps.
  howTo,
}

/// A banner on the lobby's stage, and possibly the one that pops up when
/// the app opens. Only what is true in the app today: the backend has no
/// announcements yet, so they live here until it does. The gift discount
/// is the website ticker's "خصم ٢٠٪ على كل الهدايا", from [giftDiscount].
class Promo {
  const Promo({
    required this.id,
    required this.title,
    required this.body,
    required this.cta,
    required this.action,
    this.image,
    this.imageAlignment = Alignment.center,
    this.textAtStart = true,
    this.posters = const [],
    this.stamp,
    this.popup = false,
  });

  final String id;
  final String title;
  final String body;

  /// The button's words.
  final String cta;
  final PromoAction action;

  /// A full-bleed picture behind the words, or none for a poster fan.
  final String? image;
  final Alignment imageAlignment;

  /// The words sit at the reading start (right in Arabic); false puts them
  /// at the end, when the picture's subject is at the start.
  final bool textAtStart;

  /// Categories fanned out as posters on the art side.
  final List<Category> posters;

  /// A big figure printed on a ticket on the art side (a discount).
  final String? stamp;

  /// The one shown in a pop-up when the app opens.
  final bool popup;
}

/// The lobby's banners, in order. The first marked [Promo.popup] opens the
/// app. The catalogue's banner shows once the server's categories are in.
List<Promo> homePromos(LangController lang, CatalogController catalog) {
  final shelf = catalog.shelves.firstOrNull;
  final playable = [
    for (final c in shelf?.categories ?? const <Category>[])
      if (c.playable) c,
  ];
  final off = (giftDiscount * 100).round();
  return [
    if (shelf != null && playable.length >= 2)
      Promo(
        id: 'new-pack',
        title: shelf.title(lang),
        body: lang.t(
          '${categoryCount(lang, playable.length)} تلعبوها دلوقتي، زي '
              '«${playable[0].name}» و«${playable[1].name}»',
          '${categoryCount(lang, playable.length)} tel3aboha delwa2ty, zay '
              '"${playable[0].name}" w "${playable[1].name}"',
        ),
        cta: lang.t('شوفوها', 'Shoofoha'),
        action: PromoAction.newPack,
        posters: playable.take(3).toList(),
        popup: true,
      ),
    Promo(
      id: 'gift-discount',
      title: lang.t(
        'خصم ${lang.toAr(off)}٪ على كل الهدايا',
        '$off% off kol el hadaya',
      ),
      body: lang.t(
        'اهدوا ألعاب لصحابكم، والهدية عليها خصم ${lang.toAr(off)}٪.',
        'Ehdo al3ab le so7abkom, wel hedeya 3aleiha khasm $off%.',
      ),
      cta: lang.t('شوفوا الهدايا', 'Shoofo el hadaya'),
      action: PromoAction.gifts,
      stamp: lang.t('${lang.toAr(off)}٪', '$off%'),
    ),
    Promo(
      id: 'free-play',
      title: lang.t('العبوا ببلاش', 'El3abo bebalash'),
      body: lang.t(
        'لحد ما المتجر يفتح، كل الألعاب مجانية ليكم ولصحابكم.',
        'Le7ad ma el matgar yeftah, kol el al3ab magganeya.',
      ),
      cta: lang.t('ابدأ لعبة', 'Ebda2 le3ba'),
      action: PromoAction.play,
      image: BrandImages.coins,
      // The coins sit at the picture's right, so the words go left.
      imageAlignment: Alignment.centerRight,
      textAtStart: !lang.ar,
    ),
    Promo(
      id: 'how-to',
      title: lang.t('أول مرة تلعبوا؟', 'Awel marra tel3abo?'),
      body: lang.t(
        'اختاروا ٦ فئات، سمّوا الفريقين، والأعلى نقط يكسب.',
        'Ekhtaro 6 fe2at, sammo el fare2een, wel a3la no2at yeksab.',
      ),
      cta: lang.t('إزاي نلعب؟', 'Ezay nel3ab?'),
      action: PromoAction.howTo,
      image: BrandImages.herowide,
      // The TV is at the picture's left, so the words go right.
      imageAlignment: Alignment.centerLeft,
      textAtStart: lang.ar,
    ),
  ];
}
