import { DEMO_MODE } from './runtime.ts'
import { currentLang } from './lang.ts'

export const NEW_GAME_IDS = ['person', 'color', 'riddle', 'voice', 'memory']
export const DEMO_CATEGORY_IDS = [...NEW_GAME_IDS, 'general']

export type Category = {
  id: string
  name: string
  /** Franco-Arabic (Latin script) title used by the English format. */
  nameEn: string
  help: string
  helpEn: string
  example: string
  exampleEn: string
  /** Shows the "new" badge on the poster. */
  fresh?: boolean
}

export const CATEGORIES: Category[] = [
  ...(DEMO_MODE
    ? [
        {
          id: 'person',
          name: 'مين في الصورة؟',
          nameEn: 'Meen fel Soora?',
          help: 'جزء من صورة مشهور. اتفقوا على الاسم، وبعدها المضيف يكشف صورة الإجابة ويحسب النقط.',
          helpEn:
            'Goz2 men soret wa7ed mashhoor. Etfa2o 3al esm, w ba3deen el host ye2shef soret el egaba w ye7seb el no2at.',
          example: 'تقدر تعرف مين صاحب العينين دول؟',
          exampleEn: 'Te2dar te3raf meen sa7b el 3eneen dol?',
          fresh: true,
        },
        {
          id: 'color',
          name: 'اللون الأصلي إيه؟',
          nameEn: 'El Loon El Asly Eh?',
          help: 'الصورة من غير ألوان. خمنوا لون الحاجة المطلوبة، وشوفوا اللون الأصلي مع الإجابة.',
          helpEn:
            'El soora men gheir alwan. Khamenoo loon el 7aga el matlooba, w shoofo el loon el asly ma3 el egaba.',
          example: 'القميص ده كان لونه إيه؟',
          exampleEn: 'El 2amees da kan loono eh?',
          fresh: true,
        },
        {
          id: 'riddle',
          name: 'الصورة بتقول إيه؟',
          nameEn: 'El Soora Bet2ool Eh?',
          help: 'اربطوا تفاصيل الرسمة ببعض عشان توصلوا للمثل المصري. المضيف يكشف المثل ويختار الفريق اللي جاوب صح.',
          helpEn:
            'Erbotoo tafaseel el rasma beba3d 3ashan tewsalo lel masal el masry. El host ye2shef el masal w ye5tar el fare2 elly gaweb sa7.',
          example: 'باب، هوا، وحد بيقفل الباب… إيه المثل؟',
          exampleEn: 'Bab, hawa, w 7ad bey2fel el bab… eh el masal?',
          fresh: true,
        },
        {
          id: 'voice',
          name: 'مين صاحب الصوت؟',
          nameEn: 'Meen Sa7b El Soot?',
          help: 'اسمعوا المقطع وخمنوا الشخصية. شغّلوا الصوت عدد المرات اللي محتاجينها.',
          helpEn: 'Esma3o el ma2ta3 w khamenoo el shakhseya. Shaghalo el soot ad ma te7tago.',
          example: 'المذيع، الكابتن، ولا الحكّاء؟',
          exampleEn: 'El mozee3, el captain, wala el 7akkaa2?',
          fresh: true,
        },
        {
          id: 'memory',
          name: 'ركز معايا',
          nameEn: 'Rakez M3aya',
          help: 'الصورة بتظهر الأول. لما تحفظوها، المضيف يخفيها ويظهر السؤال. تقدروا ترجعوا للصورة في أي وقت.',
          helpEn:
            'El soora btezhar el awel. Lama te7fazooha, el host ye5abeeha w yezhar el so2al. Te2daro terga3o lel soora fe ay wa2t.',
          example: 'كان فيه كام بلية على الترابيزة؟',
          exampleEn: 'Kan feeh kam bilya 3al tarabeeza?',
          fresh: true,
        },
      ]
    : []),
  {
    id: 'cinema',
    name: 'سينما مصرية',
    nameEn: 'Cinema Masreya',
    help: 'أفلام وممثلين ومشاهد عمرها ما تتنسي.',
    helpEn: 'Aflam w momasseleen w mashahed 3omraha ma tetnesy.',
    example: 'مين قال "الدنيا مش هتخلص يا حسن"؟',
    exampleEn: 'Meen 2al "El donya mesh hatekhlas ya 7asan"?',
  },
  {
    id: 'music',
    name: 'طرب وكاسيت',
    nameEn: 'Tarab w Cassette',
    help: 'أغاني وفنانين من أيام الشريط والكاسيت.',
    helpEn: 'Aghany w fananeen men ayam el shereet wel cassette.',
    example: 'مين غنّى "ع الربابة بغني"؟',
    exampleEn: 'Meen ghanna "3al rababa baghanny"?',
  },
  {
    id: 'football',
    name: 'كورة وجمهور',
    nameEn: 'Kora w Gomhoor',
    help: 'الأهلي والزمالك والمنتخب وأهداف الزمن الجميل.',
    helpEn: 'El Ahly wel Zamalek wel Montakhab w ahdaf el zaman el gameel.',
    example: 'مين هداف كأس الأمم الأفريقية 2010؟',
    exampleEn: 'Meen haddaf Kas El Omam El Afree2eya 2010?',
  },
  {
    id: 'general',
    name: 'ثقافة عامة',
    nameEn: 'Sa2afa 3ama',
    help: 'معلومات من كل حتة عن مصر والعالم.',
    helpEn: 'Ma3lomat men kol 7etta 3an Masr wel 3alam.',
    example: 'إيه عاصمة مصر قبل القاهرة؟',
    exampleEn: 'Eh 3asemet Masr 2abl El Qahera?',
  },
  {
    id: 'ramadan',
    name: 'رمضانيات',
    nameEn: 'Ramadaneyat',
    help: 'مسلسلات وفوازير ومدفع الإفطار.',
    helpEn: 'Mosalsalat w fawazeer w madfa3 el eftar.',
    example: 'مين كانت بطلة فوازير "ألف ليلة وليلة"؟',
    exampleEn: 'Meen kanet batalet fawazeer "Alf Leila w Leila"?',
  },
  {
    id: 'comedy',
    name: 'قفشات وضحك',
    nameEn: '2afshat w Da7k',
    help: 'إفيهات ومشاهد كوميدي بتفكّرك بأيام حلوة.',
    helpEn: 'Efeehat w mashahed comedy betfakarak b ayam 7elwa.',
    example: 'كمّل: "أنا مش خرونج..."',
    exampleEn: 'Kammel: "Ana mesh khoronj..."',
  },
  {
    id: 'ancient',
    name: 'مصر القديمة',
    nameEn: 'Masr El 2adeema',
    help: 'فراعنة وأهرامات ومعابد وأسرار الحضارة.',
    helpEn: 'Fara3na w ahramat w ma3abed w asrar el 7adara.',
    example: 'مين بنى الهرم الأكبر؟',
    exampleEn: 'Meen bana el haram el akbar?',
  },
  {
    id: 'street',
    name: 'أكل الشارع',
    nameEn: 'Akl El Share3',
    help: 'كشري وفلافل وعصير قصب وكل اللي بنحبه.',
    helpEn: 'Koshary w ta3meya w 3aseer 2asab w kol elly bn7ebboh.',
    example: 'إيه مكونات الكشري؟',
    exampleEn: 'Eh mokawenat el koshary?',
  },
  {
    id: 'travel',
    name: 'رحلة في مصر',
    nameEn: 'Re7la fe Masr',
    help: 'أماكن وآثار ومدن من أسوان للإسكندرية.',
    helpEn: 'Amaken w asar w modon men Aswan lel Eskendereya.',
    example: 'إيه المدينة اللي فيها معبد أبو سمبل؟',
    exampleEn: 'Eh el madeena elly feeha ma3bad Abu Simbel?',
  },
  {
    id: 'childhood',
    name: 'ألعاب الطفولة',
    nameEn: 'Al3ab El Tofoola',
    help: 'بلي وطيارة ورق وكل لعب أيام زمان.',
    helpEn: 'Bely w tayara wara2 w kol le3ab ayam zaman.',
    example: 'إيه اللعبة اللي بنلف فيها خيط على البلبل؟',
    exampleEn: 'Eh el le3ba elly benlef feeha kheit 3al bolbol?',
  },
  {
    id: 'alex',
    name: 'صيف إسكندرية',
    nameEn: 'Seif Eskendereya',
    help: 'بحر وقلعة وذرة مشوية وذكريات الكورنيش.',
    helpEn: 'Ba7r w 2al3a w dora mashweya w zekrayat el corniche.',
    example: 'إيه اسم القلعة الشهيرة على بحر إسكندرية؟',
    exampleEn: 'Eh esm el 2al3a el shaheera 3ala ba7r Eskendereya?',
  },
  {
    id: 'crafts',
    name: 'الحرف والسوق',
    nameEn: 'El 7eraf wel Soo2',
    help: 'خان الخليلي وفوانيس ونحاس وخيامية.',
    helpEn: 'Khan El Khalili w fawanees w na7as w khayameya.',
    example: 'إيه اسم السوق الشهير في الحسين؟',
    exampleEn: 'Eh esm el soo2 el shaheer fel 7ussein?',
  },
]

export const SECTIONS: { id: string; name: string; nameEn: string; ids: string[] }[] = [
  ...(DEMO_MODE
    ? [{ id: 'new-games', name: 'تحديات جديدة للشلة', nameEn: 'Ta7adyat Gdeeda', ids: NEW_GAME_IDS }]
    : []),
  {
    id: 'popular',
    name: 'الألعاب الأكثر شعبية',
    nameEn: 'El Akthar Sha3beya',
    ids: ['cinema', 'music', 'football', 'ramadan', 'comedy'],
  },
  {
    id: 'egypt',
    name: 'مصر وتراثها',
    nameEn: 'Masr w Toraasha',
    ids: ['ancient', 'travel', 'alex', 'crafts'],
  },
  { id: 'fun', name: 'لمّة وذكريات', nameEn: 'Lamma w Zekrayat', ids: ['street', 'childhood', 'general'] },
]

export const POINTS = [200, 200, 400, 400, 600, 600] as const

export type { Question } from './game-types.ts'

/** Existing palette: team A gold, team B green. */
export const TEAM_COLORS = ['#e7a72b', '#6fd3a0'] as const

export const TOKEN_PRICE = 10
export const TOKEN_PRESETS = [1, 2, 5] as const
export const PROMOS: Record<string, number> = { SAH20: 0.2 }
/** Gifted tokens are always discounted. */
export const GIFT_DISCOUNT = 0.1

/** Arabic-Indic digits in the Arabic format, Western digits in Franco. */
export const toAr = (n: number | string) =>
  currentLang() === 'ar' ? String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]) : String(n)
