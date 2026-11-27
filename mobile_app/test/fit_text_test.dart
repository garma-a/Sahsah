import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/theme/app_theme.dart';
import 'package:sahsah_mobile/features/game/ui/fit_text.dart';

/// A long question, like the countdown round's: "using the numbers you saw,
/// reach 154 or the nearest number…".
const long =
    'باستخدام الأرقام اللي شفتها، وصّلوا لـ 154 أو أقرب رقم ليه. جمع وطرح '
    'وضرب وقسمة، وكل رقم مرة واحدة بس.';

Future<Rect> pumpFit(
  WidgetTester tester,
  String text,
  Size box, {
  double scale = 1,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark(),
      home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(scale)),
        child: Directionality(
          textDirection: TextDirection.rtl,
          // A Scaffold's Material gives the theme's body style (with its
          // letter spacing) to the text below, as on the question card.
          child: Scaffold(
            body: Center(
              child: SizedBox.fromSize(
                key: const ValueKey('box'),
                size: box,
                child: Center(
                  child: FitText(
                    text,
                    max: 38,
                    min: 16,
                    textAlign: TextAlign.center,
                    style: (size) => AppText.display(size, height: 1.35),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  return tester.getRect(find.byKey(const ValueKey('box')));
}

void main() {
  testWidgets('a long question is never cut off its card', (tester) async {
    // Question areas from a landscape phone to a portrait one, and every
    // length of the question up to the whole of it.
    const boxes = [Size(520, 230), Size(470, 260), Size(330, 180)];
    for (final box in boxes) {
      for (var end = 20; end <= long.length; end += 7) {
        final text = long.substring(0, end);
        for (final scale in [1.0, 1.3]) {
          final area = await pumpFit(tester, text, box, scale: scale);
          final drawn = tester.getRect(find.text(text));
          // The text's own height at its width: more than it got means
          // its last lines are cut.
          final paragraph = tester.renderObject<RenderParagraph>(
            find.text(text),
          );
          expect(
            paragraph.getMinIntrinsicHeight(paragraph.size.width),
            lessThanOrEqualTo(paragraph.size.height + 0.5),
            reason: '$box at ×$scale: "$text" is cut',
          );
          expect(
            area.inflate(0.5).contains(drawn.topLeft) &&
                area.inflate(0.5).contains(drawn.bottomRight),
            isTrue,
            reason: '$box at ×$scale: "$text" drawn at $drawn, box $area',
          );
        }
      }
    }
  });

  testWidgets('a short question keeps its big size', (tester) async {
    await pumpFit(tester, 'مين ده؟', const Size(520, 230));
    final style = tester.widget<Text>(find.text('مين ده؟')).style!;
    expect(style.fontSize, 38);
  });
}
