import 'package:flutter/widgets.dart';

/// Multi-line text at the largest size (between [min] and [max]) that fits
/// its box, like the prototype's `FitText`.
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
    return LayoutBuilder(
      builder: (context, box) {
        final direction = Directionality.of(context);
        final scaler = MediaQuery.textScalerOf(context);
        var size = max;
        while (size > min) {
          final painter = TextPainter(
            text: TextSpan(text: text, style: style(size)),
            textDirection: direction,
            textAlign: textAlign,
            textScaler: scaler,
          )..layout(maxWidth: box.maxWidth);
          final fits = painter.height <= box.maxHeight;
          painter.dispose();
          if (fits) break;
          size -= 2;
        }
        return Text(
          text,
          textAlign: textAlign,
          style: style(size < min ? min : size),
          overflow: TextOverflow.fade,
        );
      },
    );
  }
}
