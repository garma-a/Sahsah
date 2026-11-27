import 'package:flutter/widgets.dart';

/// Multi-line text at the largest size (between [min] and [max]) that fits
/// its box, like the prototype's `FitText`.
///
/// It measures the text exactly as it will be drawn: the inherited text
/// style (the theme's letter spacing included), the locale, the bold-text
/// setting and the text scale. If the text still doesn't fit at [min], it
/// is scaled down as a whole; it is never cut off.
class FitText extends StatelessWidget {
  const FitText(
    this.text, {
    super.key,
    required this.style,
    this.max = 40,
    this.min = 14,
    this.textAlign = TextAlign.start,
  });

  final String text;
  final TextStyle Function(double size) style;
  final double max;
  final double min;
  final TextAlign textAlign;

  @override
  Widget build(BuildContext context) {
    final inherited = DefaultTextStyle.of(context);
    final bold = MediaQuery.boldTextOf(context);
    final scaler = MediaQuery.textScalerOf(context);
    final locale = Localizations.maybeLocaleOf(context);
    final heightBehavior =
        inherited.textHeightBehavior ??
        DefaultTextHeightBehavior.maybeOf(context);

    // What Text draws: the inherited style under this one.
    TextStyle drawn(double size) {
      final s = inherited.style.merge(style(size));
      return bold ? s.merge(const TextStyle(fontWeight: FontWeight.bold)) : s;
    }

    return LayoutBuilder(
      builder: (context, box) {
        final direction = Directionality.of(context);
        bool fits(double size) {
          final painter = TextPainter(
            text: TextSpan(text: text, style: drawn(size)),
            textDirection: direction,
            textAlign: textAlign,
            textScaler: scaler,
            locale: locale,
            textWidthBasis: inherited.textWidthBasis,
            textHeightBehavior: heightBehavior,
          )..layout(maxWidth: box.maxWidth);
          final ok =
              painter.height <= box.maxHeight && painter.width <= box.maxWidth;
          painter.dispose();
          return ok;
        }

        var size = max;
        while (size > min && !fits(size)) {
          size -= 2;
        }
        if (size < min) size = min;

        final paragraph = Text(
          text,
          textAlign: textAlign,
          style: style(size),
          textHeightBehavior: heightBehavior,
        );
        if (!box.hasBoundedWidth) return paragraph;
        // The last guard: wrapped at the box's width, then shrunk as a whole
        // if it's still too tall, so no line is lost.
        return FittedBox(
          fit: BoxFit.scaleDown,
          child: SizedBox(width: box.maxWidth, child: paragraph),
        );
      },
    );
  }
}
