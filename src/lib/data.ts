import { DEMO_MODE } from './runtime.ts'

export const NEW_GAME_IDS = ['person', 'color', 'riddle', 'voice', 'memory']
export const DEMO_CATEGORY_IDS = [...NEW_GAME_IDS, 'general']

export type Category = {
  id: string
  name: string
  help: string
  example: string
  from: string
  to: string
  accent: string
  instruction?: string
}

export const CATEGORIES: Category[] = [
  ...(DEMO_MODE
    ? [
        {
          id: 'person',
          name: 'مين في الصورة؟',
          help: 'جزء صغير من صورة مشهور. اتفقوا على الاسم، وبعدها المضيف يكشف الصورة كاملة ويحسب النقط.',
          example: 'تقدر تعرف مين صاحب العينين دول؟',
          instruction: 'خمن المشهور من جزء من صورته',
          from: '#765331',
          to: '#102d21',
          accent: '#f3c878',
        },
        {
          id: 'color',
          name: 'اللون الأصلي إيه؟',
          help: 'الصورة من غير ألوان. خمنوا لون الحاجة المطلوبة، وشوفوا اللون الأصلي مع الإجابة.',
          example: 'القميص ده كان لونه إيه؟',
          instruction: 'صورة من غير ألوان… افتكر أصلها',
          from: '#664b8e',
          to: '#152c25',
          accent: '#ceb0f9',
        },
        {
          id: 'riddle',
          name: 'الصورة بتقول إيه؟',
          help: 'اربطوا تفاصيل الرسمة ببعض عشان توصلوا للمثل المصري. المضيف يكشف المثل ويختار الفريق اللي جاوب صح.',
          example: 'باب، هوا، وحد بيقفل الباب… إيه المثل؟',
          instruction: 'فك الرسمة ووصل للمثل',
          from: '#a14e2b',
          to: '#232b20',
          accent: '#ffbb96',
        },
        {
          id: 'voice',
          name: 'مين صاحب الصوت؟',
          help: 'اسمعوا المقطع وخمنوا الشخصية. عندكم ٣ مرات تشغيل. في العرض ده بنستخدم أصوات تمثيلية لشخصيات صح صح.',
          example: 'المذيع، الكابتن، ولا الحكّاء؟',
          instruction: 'اسمع المقطع واعرف مين بيتكلم',
          from: '#417569',
          to: '#0d3025',
          accent: '#8de2cc',
        },
        {
          id: 'memory',
          name: 'ركز معايا',
          help: 'الصورة هتظهر لثواني وبعدين تختفي. بعدها يظهر سؤال عن تفصيلة فيها. ركزوا قبل ما الوقت يخلص!',
          example: 'كان فيه كام بلية على الترابيزة؟',
          instruction: 'احفظ التفاصيل قبل الصورة ما تختفي',
          from: '#745a17',
          to: '#203324',
          accent: '#f5d875',
        },
      ]
    : []),
  {
    id: 'cinema',
    name: 'سينما مصرية',
    help: 'أفلام وممثلين ومشاهد عمرها ما تتنسي.',
    example: 'مين قال "الدنيا مش هتخلص يا حسن"؟',
    from: '#7a1f3d',
    to: '#2a0f1f',
    accent: '#ff8fb1',
  },
  {
    id: 'music',
    name: 'طرب وكاسيت',
    help: 'أغاني وفنانين من أيام الشريط والكاسيت.',
    example: 'مين غنّى "ع الربابة بغني"؟',
    from: '#8a4b0f',
    to: '#2b1706',
    accent: '#ffc25a',
  },
  {
    id: 'football',
    name: 'كورة وجمهور',
    help: 'الأهلي والزمالك والمنتخب وأهداف الزمن الجميل.',
    example: 'مين هداف كأس الأمم الأفريقية 2010؟',
    from: '#0f6b3d',
    to: '#032114',
    accent: '#7dffb0',
  },
  {
    id: 'general',
    name: 'ثقافة عامة',
    help: 'معلومات من كل حتة عن مصر والعالم.',
    example: 'إيه عاصمة مصر قبل القاهرة؟',
    from: '#1d5c7a',
    to: '#07202c',
    accent: '#8fe0ff',
  },
  {
    id: 'ramadan',
    name: 'رمضانيات',
    help: 'مسلسلات وفوازير ومدفع الإفطار.',
    example: 'مين كانت بطلة فوازير "ألف ليلة وليلة"؟',
    from: '#5b3a8c',
    to: '#160c2b',
    accent: '#d2b0ff',
  },
  {
    id: 'comedy',
    name: 'قفشات وضحك',
    help: 'إفيهات ومشاهد كوميدي بتفكّرك بأيام حلوة.',
    example: 'كمّل: "أنا مش خرونج..."',
    from: '#a8431a',
    to: '#2c1106',
    accent: '#ffb48a',
  },
  {
    id: 'ancient',
    name: 'مصر القديمة',
    help: 'فراعنة وأهرامات ومعابد وأسرار الحضارة.',
    example: 'مين بنى الهرم الأكبر؟',
    from: '#8a6a12',
    to: '#241a04',
    accent: '#ffd45a',
  },
  {
    id: 'street',
    name: 'أكل الشارع',
    help: 'كشري وفلافل وعصير قصب وكل اللي بنحبه.',
    example: 'إيه مكونات الكشري؟',
    from: '#a8431a',
    to: '#2c1106',
    accent: '#ffb48a',
  },
  {
    id: 'travel',
    name: 'رحلة في مصر',
    help: 'أماكن وآثار ومدن من أسوان للإسكندرية.',
    example: 'إيه المدينة اللي فيها معبد أبو سمبل؟',
    from: '#0f6b6b',
    to: '#032121',
    accent: '#7dffe8',
  },
  {
    id: 'childhood',
    name: 'ألعاب الطفولة',
    help: 'بلي وطيارة ورق وكل لعب أيام زمان.',
    example: 'إيه اللعبة اللي بنلف فيها خيط على البلبل؟',
    from: '#7a1f3d',
    to: '#2a0f1f',
    accent: '#ff8fb1',
  },
  {
    id: 'alex',
    name: 'صيف إسكندرية',
    help: 'بحر وقلعة وذرة مشوية وذكريات الكورنيش.',
    example: 'إيه اسم القلعة الشهيرة على بحر إسكندرية؟',
    from: '#1d5c7a',
    to: '#07202c',
    accent: '#8fe0ff',
  },
  {
    id: 'crafts',
    name: 'الحرف والسوق',
    help: 'خان الخليلي وفوانيس ونحاس وخيامية.',
    example: 'إيه اسم السوق الشهير في الحسين؟',
    from: '#5b3a8c',
    to: '#160c2b',
    accent: '#d2b0ff',
  },
]

export const SECTIONS: { id: string; name: string; ids: string[] }[] = [
  ...(DEMO_MODE ? [{ id: 'new-games', name: 'تحديات جديدة للشلة', ids: NEW_GAME_IDS }] : []),
  {
    id: 'popular',
    name: 'الألعاب الأكثر شعبية',
    ids: ['cinema', 'music', 'football', 'ramadan', 'comedy'],
  },
  { id: 'egypt', name: 'مصر وتراثها', ids: ['ancient', 'travel', 'alex', 'crafts'] },
  { id: 'fun', name: 'لمّة وذكريات', ids: ['street', 'childhood', 'general'] },
]

export const POINTS = [200, 200, 400, 400, 600, 600] as const

export type { Question } from './game-types.ts'

export const TOKEN_PRICE = 10
export const TOKEN_PRESETS = [1, 2, 5] as const
export const PROMOS: Record<string, number> = { SAH20: 0.2 }

export const toAr = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
