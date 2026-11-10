/// Category names and one-line descriptions from
/// `sahsah_prototype/src/lib/data.ts`. Content will come from the backend
/// once it exposes a catalogue endpoint.
class Category {
  const Category(
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

class CategorySection {
  const CategorySection(this.id, this.name, this.nameEn, this.categories);

  final String id;
  final String name;
  final String nameEn;
  final List<Category> categories;
}

const _person = Category(
  'person',
  'مين في الصورة؟',
  'Meen fel Soora?',
  'جزء من صورة مشهور. اتفقوا على الاسم، وبعدها المضيف يكشف الإجابة.',
  'Goz2 men soret wa7ed mashhoor. Etfa2o 3al esm, w el host ye2shef el egaba.',
  isNew: true,
);
const _color = Category(
  'color',
  'اللون الأصلي إيه؟',
  'El Loon El Asly Eh?',
  'الصورة من غير ألوان. خمنوا لون الحاجة المطلوبة.',
  'El soora men gheir alwan. Khamenoo loon el 7aga el matlooba.',
  isNew: true,
);
const _riddle = Category(
  'riddle',
  'الصورة بتقول إيه؟',
  'El Soora Bet2ool Eh?',
  'اربطوا تفاصيل الرسمة عشان توصلوا للمثل المصري.',
  'Erbotoo tafaseel el rasma 3ashan tewsalo lel masal el masry.',
  isNew: true,
);
const _voice = Category(
  'voice',
  'مين صاحب الصوت؟',
  'Meen Sa7b El Soot?',
  'اسمعوا المقطع وخمنوا الشخصية.',
  'Esma3o el ma2ta3 w khamenoo el shakhseya.',
  isNew: true,
);
const _memory = Category(
  'memory',
  'ركز معايا',
  'Rakez M3aya',
  'احفظوا الصورة، وبعد ما تختفي جاوبوا على السؤال.',
  'E7fazo el soora, w ba3d ma tekhtefy gawbo 3al so2al.',
  isNew: true,
);
const _cinema = Category(
  'cinema',
  'سينما مصرية',
  'Cinema Masreya',
  'أفلام وممثلين ومشاهد عمرها ما تتنسي.',
  'Aflam w momasseleen w mashahed 3omraha ma tetnesy.',
);
const _music = Category(
  'music',
  'طرب وكاسيت',
  'Tarab w Cassette',
  'أغاني وفنانين من أيام الشريط والكاسيت.',
  'Aghany w fananeen men ayam el shereet wel cassette.',
);
const _football = Category(
  'football',
  'كورة وجمهور',
  'Kora w Gomhoor',
  'الأهلي والزمالك والمنتخب وأهداف الزمن الجميل.',
  'El Ahly wel Zamalek wel Montakhab w ahdaf el zaman el gameel.',
);
const _general = Category(
  'general',
  'ثقافة عامة',
  'Sa2afa 3ama',
  'معلومات من كل حتة عن مصر والعالم.',
  'Ma3lomat men kol 7etta 3an Masr wel 3alam.',
);
const _ramadan = Category(
  'ramadan',
  'رمضانيات',
  'Ramadaneyat',
  'مسلسلات وفوازير ومدفع الإفطار.',
  'Mosalsalat w fawazeer w madfa3 el eftar.',
);
const _comedy = Category(
  'comedy',
  'قفشات وضحك',
  '2afshat w Da7k',
  'إفيهات ومشاهد كوميدي بتفكّرك بأيام حلوة.',
  'Efeehat w mashahed comedy betfakarak b ayam 7elwa.',
);
const _ancient = Category(
  'ancient',
  'مصر القديمة',
  'Masr El 2adeema',
  'فراعنة وأهرامات ومعابد وأسرار الحضارة.',
  'Fara3na w ahramat w ma3abed w asrar el 7adara.',
);
const _street = Category(
  'street',
  'أكل الشارع',
  'Akl El Share3',
  'كشري وفلافل وعصير قصب وكل اللي بنحبه.',
  'Koshary w ta3meya w 3aseer 2asab w kol elly bn7ebboh.',
);
const _travel = Category(
  'travel',
  'رحلة في مصر',
  'Re7la fe Masr',
  'أماكن وآثار ومدن من أسوان للإسكندرية.',
  'Amaken w asar w modon men Aswan lel Eskendereya.',
);
const _childhood = Category(
  'childhood',
  'ألعاب الطفولة',
  'Al3ab El Tofoola',
  'بلي وطيارة ورق وكل لعب أيام زمان.',
  'Bely w tayara wara2 w kol le3ab ayam zaman.',
);
const _alex = Category(
  'alex',
  'صيف إسكندرية',
  'Seif Eskendereya',
  'بحر وقلعة وذرة مشوية وذكريات الكورنيش.',
  'Ba7r w 2al3a w dora mashweya w zekrayat el corniche.',
);
const _crafts = Category(
  'crafts',
  'الحرف والسوق',
  'El 7eraf wel Soo2',
  'خان الخليلي وفوانيس ونحاس وخيامية.',
  'Khan El Khalili w fawanees w na7as w khayameya.',
);

/// The web's `SECTIONS`, in the same order.
const categorySections = [
  CategorySection('new-games', 'تحديات جديدة للشلة', 'Ta7adyat Gdeeda', [
    _person,
    _color,
    _riddle,
    _voice,
    _memory,
  ]),
  CategorySection('popular', 'الأكثر شعبية', 'El Akthar Sha3beya', [
    _cinema,
    _music,
    _football,
    _ramadan,
    _comedy,
  ]),
  CategorySection('egypt', 'مصر وتراثها', 'Masr w Toraasha', [
    _ancient,
    _travel,
    _alex,
    _crafts,
  ]),
  CategorySection('fun', 'لمّة وذكريات', 'Lamma w Zekrayat', [
    _street,
    _childhood,
    _general,
  ]),
];

final allCategories = [for (final s in categorySections) ...s.categories];

/// `GIFT_DISCOUNT` on the web.
const giftDiscount = 0.1;

/// Games a board holds: six categories × six tiles.
const boardCategories = 6;
const boardQuestions = 36;
