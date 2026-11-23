/// The built-in offline categories (names and one-line descriptions from
/// `sahsah_prototype/src/lib/data.ts`), which the offline game still plays
/// until games run through the server. The shelf shows the server's
/// catalogue ([CatalogController] in `catalog.dart`).
class LocalCategory {
  const LocalCategory(
    this.id,
    this.name,
    this.nameEn,
    this.help,
    this.helpEn, {
    this.isNew = false,
  });

  final String id;
  final String name;

  /// Franco-Arabic (Latin script) title used by the English format.
  final String nameEn;
  final String help;
  final String helpEn;

  /// One of the new challenge formats (shows the "جديد" badge).
  final bool isNew;
}

class LocalSection {
  const LocalSection(this.id, this.name, this.nameEn, this.categories);

  final String id;
  final String name;
  final String nameEn;
  final List<LocalCategory> categories;
}

const _person = LocalCategory(
  'person',
  'مين في الصورة؟',
  'Meen fel Soora?',
  'جزء من صورة مشهور. اتفقوا على الاسم، وبعدها المضيف يكشف الإجابة.',
  'Goz2 men soret wa7ed mashhoor. Etfa2o 3al esm, w el host ye2shef el egaba.',
  isNew: true,
);
const _color = LocalCategory(
  'color',
  'اللون الأصلي إيه؟',
  'El Loon El Asly Eh?',
  'الصورة من غير ألوان. خمنوا لون الحاجة المطلوبة.',
  'El soora men gheir alwan. Khamenoo loon el 7aga el matlooba.',
  isNew: true,
);
const _riddle = LocalCategory(
  'riddle',
  'الصورة بتقول إيه؟',
  'El Soora Bet2ool Eh?',
  'اربطوا تفاصيل الرسمة عشان توصلوا للمثل المصري.',
  'Erbotoo tafaseel el rasma 3ashan tewsalo lel masal el masry.',
  isNew: true,
);
const _voice = LocalCategory(
  'voice',
  'مين صاحب الصوت؟',
  'Meen Sa7b El Soot?',
  'اسمعوا المقطع وخمنوا الشخصية.',
  'Esma3o el ma2ta3 w khamenoo el shakhseya.',
  isNew: true,
);
const _memory = LocalCategory(
  'memory',
  'ركز معايا',
  'Rakez M3aya',
  'احفظوا الصورة، وبعد ما تختفي جاوبوا على السؤال.',
  'E7fazo el soora, w ba3d ma tekhtefy gawbo 3al so2al.',
  isNew: true,
);
const _acting = LocalCategory(
  'acting',
  'مثّلها',
  'Massel-ha',
  'واحد من الفريق يمثّل من غير ولا كلمة، والباقي يخمّن قبل ما الوقت يخلص.',
  'Wa7ed men el fare2 yemassel men gher wala kelma, wel ba2y ykhammen 2abl ma el wa2t yekhlas.',
  isNew: true,
);
const _cinema = LocalCategory(
  'cinema',
  'سينما مصرية',
  'Cinema Masreya',
  'أفلام وممثلين ومشاهد عمرها ما تتنسي.',
  'Aflam w momasseleen w mashahed 3omraha ma tetnesy.',
);
const _music = LocalCategory(
  'music',
  'طرب وكاسيت',
  'Tarab w Cassette',
  'أغاني وفنانين من أيام الشريط والكاسيت.',
  'Aghany w fananeen men ayam el shereet wel cassette.',
);
const _football = LocalCategory(
  'football',
  'كورة وجمهور',
  'Kora w Gomhoor',
  'الأهلي والزمالك والمنتخب وأهداف الزمن الجميل.',
  'El Ahly wel Zamalek wel Montakhab w ahdaf el zaman el gameel.',
);
const _general = LocalCategory(
  'general',
  'ثقافة عامة',
  'Sa2afa 3ama',
  'معلومات من كل حتة عن مصر والعالم.',
  'Ma3lomat men kol 7etta 3an Masr wel 3alam.',
);
const _ramadan = LocalCategory(
  'ramadan',
  'رمضانيات',
  'Ramadaneyat',
  'مسلسلات وفوازير ومدفع الإفطار.',
  'Mosalsalat w fawazeer w madfa3 el eftar.',
);
const _comedy = LocalCategory(
  'comedy',
  'قفشات وضحك',
  '2afshat w Da7k',
  'إفيهات ومشاهد كوميدي بتفكّرك بأيام حلوة.',
  'Efeehat w mashahed comedy betfakarak b ayam 7elwa.',
);
const _ancient = LocalCategory(
  'ancient',
  'مصر القديمة',
  'Masr El 2adeema',
  'فراعنة وأهرامات ومعابد وأسرار الحضارة.',
  'Fara3na w ahramat w ma3abed w asrar el 7adara.',
);
const _street = LocalCategory(
  'street',
  'أكل الشارع',
  'Akl El Share3',
  'كشري وفلافل وعصير قصب وكل اللي بنحبه.',
  'Koshary w ta3meya w 3aseer 2asab w kol elly bn7ebboh.',
);
const _travel = LocalCategory(
  'travel',
  'رحلة في مصر',
  'Re7la fe Masr',
  'أماكن وآثار ومدن من أسوان للإسكندرية.',
  'Amaken w asar w modon men Aswan lel Eskendereya.',
);
const _childhood = LocalCategory(
  'childhood',
  'ألعاب الطفولة',
  'Al3ab El Tofoola',
  'بلي وطيارة ورق وكل لعب أيام زمان.',
  'Bely w tayara wara2 w kol le3ab ayam zaman.',
);
const _alex = LocalCategory(
  'alex',
  'صيف إسكندرية',
  'Seif Eskendereya',
  'بحر وقلعة وذرة مشوية وذكريات الكورنيش.',
  'Ba7r w 2al3a w dora mashweya w zekrayat el corniche.',
);
const _crafts = LocalCategory(
  'crafts',
  'الحرف والسوق',
  'El 7eraf wel Soo2',
  'خان الخليلي وفوانيس ونحاس وخيامية.',
  'Khan El Khalili w fawanees w na7as w khayameya.',
);

/// The web's `SECTIONS`, in the same order.
const categorySections = [
  LocalSection('new-games', 'تحديات جديدة للشلة', 'Ta7adyat Gdeeda', [
    _person,
    _color,
    _riddle,
    _voice,
    _memory,
    _acting,
  ]),
  LocalSection('popular', 'الأكثر شعبية', 'El Akthar Sha3beya', [
    _cinema,
    _music,
    _football,
    _ramadan,
    _comedy,
  ]),
  LocalSection('egypt', 'مصر وتراثها', 'Masr w Toraasha', [
    _ancient,
    _travel,
    _alex,
    _crafts,
  ]),
  LocalSection('fun', 'لمّة وذكريات', 'Lamma w Zekrayat', [
    _street,
    _childhood,
    _general,
  ]),
];

final allCategories = [for (final s in categorySections) ...s.categories];

/// Gifts are this much off: 20%, as the website's promo ticker says. The
/// backend makes it an admin setting (`shop_settings.gift_discount_bps`);
/// once the app reads the shop settings, it comes from there.
const giftDiscount = 0.2;

/// Games a board holds: six categories × six tiles.
const boardCategories = 6;
const boardQuestions = 36;
