import 'package:flutter/painting.dart';

import '../core/i18n/lang.dart';
import '../core/ui/brand_art.dart';
import 'categories.dart';
import 'question_bank.dart';

/// What a promo's button does.
enum PromoAction {
  /// Open the categories, where the new section comes first.
  newPack,

  /// Start setting up a game.
  play,

  /// Show the three "how to play" steps.
  howTo,
}

/// A banner on the lobby's stage, and possibly the one that pops up when
/// the app opens. Only what is true in the app today: the backend has no
/// announcements yet, so they live here until it does. A discount goes in
/// once its figure is settled (the website's ticker says 20% off gifts,
/// the shop's gift tab 10%).
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

  /// The one shown in a pop-up when the app opens.
  final bool popup;
}

/// The lobby's banners, in order. The first marked [Promo.popup] opens the
/// app.
List<Promo> homePromos(LangController lang) {
  final fresh = categorySections.first;
  final playable = [
    for (final c in fresh.categories)
      if (isPlayable(c.id)) c,
  ];
  String name(Category c) => lang.t(c.name, c.nameEn);
  return [
    Promo(
      id: 'new-pack',
      title: lang.t(fresh.name, fresh.nameEn),
      body: lang.t(
        '${lang.toAr(playable.length)} فئات جديدة تلعبوها دلوقتي، زي '
            '«${name(playable[0])}» و«${name(playable[1])}»',
        '${playable.length} fe2at gdeeda tel3aboha delwa2ty, zay '
            '"${name(playable[0])}" w "${name(playable[1])}"',
      ),
      cta: lang.t('شوفوها', 'Shoofoha'),
      action: PromoAction.newPack,
      posters: playable.take(3).toList(),
      popup: true,
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
