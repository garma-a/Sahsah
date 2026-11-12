import 'package:flutter/painting.dart';

/// How a question is presented (see `CONTEXT.md`: Question format).
enum QuestionKind {
  /// Text, optionally with a photo.
  standard,

  /// "مين في الصورة؟": only a strip of the portrait until the reveal.
  person,

  /// "اللون الأصلي إيه؟": grayscale until the reveal, then a colour swatch.
  color,

  /// "الصورة بتقول إيه؟": an illustrated Egyptian proverb.
  riddle,

  /// "ركز معايا": show the picture, hide it, then ask.
  memory,
}

/// Which strip of a portrait stays visible before the reveal.
enum PersonCrop { eyes, center, lower }

/// Tile values per row: 200, 200, 400, 400, 600, 600.
const tilePoints = [200, 200, 400, 400, 600, 600];

class Question {
  const Question({
    required this.categoryId,
    required this.row,
    required this.kind,
    required this.prompt,
    required this.promptEn,
    required this.answer,
    required this.answerEn,
    this.image,
    this.imageAlignment = Alignment.center,
    this.crop,
    this.color,
  });

  final String categoryId;

  /// 0–5 within the category.
  final int row;
  final QuestionKind kind;
  final String prompt;
  final String promptEn;
  final String answer;
  final String answerEn;

  /// Asset path of the question picture, if any.
  final String? image;

  /// Focal point when the photo is cropped to fill its box.
  final Alignment imageAlignment;
  final PersonCrop? crop;

  /// Original colour, shown with the answer of colour questions.
  final Color? color;

  String get id => '$categoryId-$row';
  int get points => tilePoints[row];

  /// Picture rounds show the artwork whole (letterboxed) rather than cropped.
  bool get isPictureRound => kind != QuestionKind.standard;
}
