import 'package:flutter/painting.dart';

import '../features/game/model/question.dart';
import 'standard_bank.dart';

/// Presentation content from the prototype (`standard-bank.ts` and
/// `party-modes.ts`). The backend will serve real question packs later.

/// Categories that can't be played on this device yet.
const unavailableCategories = {'voice'};

String _art(String name) => switch (name) {
  'person' || 'color' || 'memory' || 'riddle' => 'assets/img/$name.webp',
  _ => 'assets/game/$name.webp',
};

/// CSS `object-position: 50% 38%` → [Alignment].
Alignment _pos(double x, double y) => Alignment(x / 50 - 1, y / 50 - 1);

// Football question photos, by row, with the prototype's focal points.
final _footballPhotos = [
  ('fq1', _pos(50, 38)),
  ('fq2', _pos(50, 30)),
  ('fq3', _pos(50, 62)),
  ('fq4', _pos(50, 55)),
  ('fq5', _pos(60, 40)),
  ('fq6', _pos(50, 45)),
];

Question _person(
  int row,
  String name,
  String nameEn,
  String image, [
  PersonCrop crop = PersonCrop.eyes,
]) => Question(
  categoryId: 'person',
  row: row,
  kind: QuestionKind.person,
  prompt: 'مين المشهور اللي في الصورة؟',
  promptEn: 'Meen el mashhoor elly fel soora?',
  answer: name,
  answerEn: nameEn,
  image: _art(image),
  crop: crop,
);

Question _riddle(int row, String answer, String answerEn, String image) =>
    Question(
      categoryId: 'riddle',
      row: row,
      kind: QuestionKind.riddle,
      prompt: 'الرسمة دي بتقول إيه؟ خمن المثل المصري.',
      promptEn: 'El rasma di bet2ool eh? Khamen el masal el masry.',
      answer: answer,
      answerEn: answerEn,
      image: _art(image),
    );

Question _color(
  int row,
  String prompt,
  String promptEn,
  String answer,
  String answerEn,
  String image,
  int color,
) => Question(
  categoryId: 'color',
  row: row,
  kind: QuestionKind.color,
  prompt: prompt,
  promptEn: promptEn,
  answer: answer,
  answerEn: answerEn,
  image: _art(image),
  color: Color(color),
);

Question _memory(
  int row,
  String prompt,
  String promptEn,
  String answer,
  String answerEn,
) => Question(
  categoryId: 'memory',
  row: row,
  kind: QuestionKind.memory,
  prompt: prompt,
  promptEn: promptEn,
  answer: answer,
  answerEn: answerEn,
  image: _art('memory'),
);

final _party = <String, List<Question>>{
  'person': [
    _person(0, 'محمد صلاح', 'Mohamed Salah', 'person'),
    _person(1, 'أم كلثوم', 'Om Kalthoum', 'umm'),
    _person(
      2,
      'مستر بين — روان أتكينسون',
      'Mr. Bean — Rowan Atkinson',
      'bean',
      PersonCrop.center,
    ),
    _person(3, 'عادل إمام', 'Adel Emam', 'adel', PersonCrop.center),
    _person(4, 'تشارلي تشابلن', 'Charlie Chaplin', 'chaplin', PersonCrop.lower),
    _person(
      5,
      'ألبرت أينشتاين',
      'Albert Einstein',
      'einstein',
      PersonCrop.lower,
    ),
  ],
  'color': [
    _color(
      0,
      'القميص في الرسمة كان لونه إيه؟',
      'El 2amees fel rasma kan loono eh?',
      'أحمر',
      'A7mar',
      'color',
      0xFFDC302B,
    ),
    _color(
      1,
      'ياقة القميص كان لونها إيه؟',
      'Ya2et el 2amees kan loonha eh?',
      'أسود',
      'Eswed',
      'color',
      0xFF171A18,
    ),
    _color(
      2,
      'أطراف أكمام القميص كان لونها إيه؟',
      'Atraf akmam el 2amees kan loonha eh?',
      'أبيض',
      'Abyad',
      'color',
      0xFFFFFDF8,
    ),
    _color(
      3,
      'القلم على الترابيزة كان لونه إيه؟',
      'El 2alam 3al tarabeeza kan loono eh?',
      'أصفر',
      'Asfar',
      'memory',
      0xFFE9B42B,
    ),
    _color(
      4,
      'البلي على الترابيزة كان لونه إيه؟',
      'El bely 3al tarabeeza kan loono eh?',
      'أزرق',
      'Azra2',
      'memory',
      0xFF347DD2,
    ),
    _color(
      5,
      'الكوباية على الترابيزة كان لونها إيه؟',
      'El kobbaya 3al tarabeeza kan loonha eh?',
      'أحمر',
      'A7mar',
      'memory',
      0xFFDC302B,
    ),
  ],
  'riddle': [
    _riddle(
      0,
      'الباب اللي يجيلك منه الريح سده واستريح',
      'El bab elly ygeelak meno el ree7 seddo w estree7',
      'riddle',
    ),
    _riddle(1, 'إيد واحدة متسقفش', 'Eed wa7da mat2sa2afsh', 'riddle-hand'),
    _riddle(
      2,
      'القرد في عين أمه غزال',
      'El 2erd fe 3een omo ghazal',
      'riddle-monkey',
    ),
    _riddle(
      3,
      'عصفور في اليد ولا عشرة على الشجرة',
      '3asfoor fel eed wala 3ashara 3al shagara',
      'riddle-bird',
    ),
    _riddle(
      4,
      'اللي بيته من إزاز ميحدفش الناس بالطوب',
      'Elly beito men ezaz may7defsh el nas bel toob',
      'riddle-glass',
    ),
    _riddle(
      5,
      'على قد لحافك مد رجليك',
      '3ala 2ad le7afak med reglek',
      'riddle-blanket',
    ),
  ],
  'memory': [
    _memory(
      0,
      'كان فيه كام بلية على الترابيزة؟',
      'Kan feeh kam bilya 3al tarabeeza?',
      '٣ بليات',
      '3 bilyat',
    ),
    _memory(
      1,
      'الكوباية كانت لونها إيه؟',
      'El kobbaya kanet loonha eh?',
      'أحمر',
      'A7mar',
    ),
    _memory(
      2,
      'إيه اللي كان على يمين الكراسة؟',
      'Eh elly kan 3ala yemeen el korrasa?',
      'قلم أصفر',
      '2alam asfar',
    ),
    _memory(
      3,
      'النبتة اللي كانت في الصورة اسمها إيه؟',
      'El nabta elly kanet fel soora esmaha eh?',
      'صبار',
      'Sabbar',
    ),
    _memory(
      4,
      'المفتاح كان في أنهي ركن؟',
      'El moftah kan fe anhy rokn?',
      'الركن اللي تحت على اليمين',
      'El rokn elly ta7t 3al yemeen',
    ),
    _memory(
      5,
      'الكراسة كانت مفتوحة ولا مقفولة؟',
      'El korrasa kanet maftoo7a wala ma2foola?',
      'مفتوحة',
      'Maftoo7a',
    ),
  ],
};

/// The question in [categoryId]'s board slot [row].
Question questionFor(String categoryId, int row) {
  final party = _party[categoryId];
  if (party != null) return party[row];
  final rows = standardBank[categoryId];
  if (rows == null) {
    throw ArgumentError.value(categoryId, 'categoryId', 'No questions');
  }
  final (prompt, answer, promptEn, answerEn) = rows[row];
  final photo = categoryId == 'football' ? _footballPhotos[row] : null;
  return Question(
    categoryId: categoryId,
    row: row,
    kind: QuestionKind.standard,
    prompt: prompt,
    promptEn: promptEn,
    answer: answer,
    answerEn: answerEn,
    image: photo == null ? null : 'assets/game/${photo.$1}.webp',
    imageAlignment: photo?.$2 ?? Alignment.center,
  );
}

bool isPlayable(String categoryId) =>
    !unavailableCategories.contains(categoryId) &&
    (_party.containsKey(categoryId) || standardBank.containsKey(categoryId));
