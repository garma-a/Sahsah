import 'package:flutter/painting.dart';

import '../../../core/api/game_wire.dart';

/// How a question is presented, from its server format.
enum QuestionKind {
  /// `STANDARD`: text, optionally with a photo.
  standard,

  /// `IMAGE_PERSON`: a strip of a portrait until the reveal.
  person,

  /// `IMAGE_COLOR`: grayscale until the reveal, then the original colour.
  color,

  /// `IMAGE_RIDDLE`: an illustrated Egyptian proverb.
  riddle,

  /// `IMAGE_MEMORY`: show the picture, hide it, then ask.
  memory,

  /// `CHARADES`: one player acts out a card only they see.
  acting,

  /// `IMAGE_BLUR`, `IMAGE_ZOOM`, `IMAGE_CLUES`: a picture that gets clearer
  /// in stages; each stage lowers the points the answer is worth.
  staged,

  /// `AUDIO_GUESS`, `AUDIO_REVERSE`, `AUDIO_VOICE`: a clip the host plays.
  audio;

  static QuestionKind of(String format) => switch (format) {
    'IMAGE_PERSON' => person,
    'IMAGE_COLOR' => color,
    'IMAGE_RIDDLE' => riddle,
    'IMAGE_MEMORY' => memory,
    'CHARADES' => acting,
    'IMAGE_BLUR' || 'IMAGE_ZOOM' || 'IMAGE_CLUES' => staged,
    'AUDIO_GUESS' || 'AUDIO_REVERSE' || 'AUDIO_VOICE' => audio,
    _ => standard,
  };
}

/// Tile values per row: 200, 200, 400, 400, 600, 600.
const tilePoints = [200, 200, 400, 400, 600, 600];

/// The open question, from the server's view of it. Pictures and clips are
/// [MediaRef]s; the game controller turns them into short-lived links.
class Question {
  const Question({
    required this.categoryId,
    required this.row,
    required this.kind,
    this.format = 'STANDARD',
    this.prompt = '',
    this.answer = '',
    this.image,
    this.clue,
    this.audio,
    this.answerImage,
    this.forwardAudio,
    this.color,
    this.hint,
    this.cardUrl,
    this.durationMs,
    int? points,
    this.pointStages = const [],
  }) : _points = points;

  final String categoryId;

  /// 0–5 within the category.
  final int row;
  final QuestionKind kind;

  /// The server's format name (`AUDIO_REVERSE`, `IMAGE_CLUES`, …).
  final String format;

  /// What's asked, in the app's language (memory: the instruction until
  /// the picture is hidden).
  final String prompt;

  /// Empty until the answer is revealed.
  final String answer;
  final MediaRef? image;

  /// The current clue card (`IMAGE_CLUES`).
  final MediaRef? clue;

  /// The host's clip (audio questions).
  final MediaRef? audio;

  /// The picture shown with the answer.
  final MediaRef? answerImage;

  /// The clip played forwards, with a reversed clip's answer.
  final MediaRef? forwardAudio;

  /// Original colour, shown with the answer of colour questions.
  final Color? color;

  /// A spoken clue (`AUDIO_VOICE`).
  final String? hint;

  /// The page the actor opens to see the card (`CHARADES`).
  final String? cardUrl;
  final int? durationMs;
  final int? _points;

  /// Points available at each stage of a staged question; one stage
  /// otherwise.
  final List<int> pointStages;

  String get id => '$categoryId-$row';
  int get points => _points ?? tilePoints[row];

  /// Picture rounds show the artwork whole (letterboxed) rather than cropped.
  bool get isPictureRound => kind != QuestionKind.standard;
}
