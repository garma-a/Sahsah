import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// CSS `box-shadow` → Flutter [BoxShadow]. CSS blur radius `b` is a Gaussian
/// with sigma `b / 2`; Flutter's blurRadius maps to sigma `r * 0.57735 + 0.5`.
BoxShadow cssShadow(
  Color color, {
  double x = 0,
  double y = 0,
  double blur = 0,
  double spread = 0,
}) {
  final sigma = blur / 2;
  final radius = sigma <= 0.5 ? 0.0 : (sigma - 0.5) / 0.57735;
  return BoxShadow(
    color: color,
    offset: Offset(x, y),
    blurRadius: radius,
    spreadRadius: spread,
  );
}

/// The website's hard offset shadow (`0 6px 0 var(--color-ink)`): no blur,
/// straight down, so cards look printed and stuck on.
BoxShadow inkDrop([double y = 5, Color color = AppColors.ink]) =>
    BoxShadow(color: color, offset: Offset(0, y));

/// The website's paper grain (`--grain`), tiled. See tool/make_grain.py.
const grainImage = DecorationImage(
  image: AssetImage('assets/img/grain.png'),
  repeat: ImageRepeat.repeat,
  fit: BoxFit.none,
  alignment: Alignment.topLeft,
);

/// A dark card on the page, after the website's TV cabinet (`.cabinet`):
/// a charcoal face with a soft top light, an ink outline and an ink drop.
/// The name is kept from the old frosted-glass panel so every caller moves
/// over. Text on it stays light.
BoxDecoration glassDecoration({
  BorderRadiusGeometry? radius,
  BoxShape shape = BoxShape.rectangle,
  Color? borderColor,
  bool shadow = true,
}) {
  return BoxDecoration(
    shape: shape,
    borderRadius: shape == BoxShape.circle ? null : radius,
    gradient: const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [Color(0xFF353D3A), AppColors.ui],
      stops: [0, 0.3],
    ),
    border: Border.all(color: borderColor ?? AppColors.ink, width: 3),
    boxShadow: shadow ? [inkDrop()] : null,
  );
}

/// The website's paper card (`.paper-card`): cream with grain, a chunky ink
/// outline and an ink drop. Text on it is ink; use [Paper] to get that by
/// default.
BoxDecoration paperDecoration({
  BorderRadiusGeometry? radius,
  BoxShape shape = BoxShape.rectangle,
  Color color = AppColors.paper,
  Color edge = AppColors.ink,
  double border = 3,
  double drop = 6,
}) {
  return BoxDecoration(
    shape: shape,
    borderRadius: shape == BoxShape.circle ? null : radius,
    color: color,
    image: grainImage,
    border: Border.all(color: edge, width: border),
    boxShadow: drop > 0 ? [inkDrop(drop)] : null,
  );
}

/// A dark card (see [glassDecoration]).
class Glass extends StatelessWidget {
  const Glass({
    super.key,
    required this.child,
    this.radius = 22,
    this.padding,
    this.circle = false,
    this.shadow = true,
    this.borderColor,
  });

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  final bool circle;
  final bool shadow;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final borderRadius = BorderRadius.circular(radius);
    return DecoratedBox(
      decoration: glassDecoration(
        radius: borderRadius,
        shape: circle ? BoxShape.circle : BoxShape.rectangle,
        shadow: shadow,
        borderColor: borderColor,
      ),
      child: Padding(padding: padding ?? EdgeInsets.zero, child: child),
    );
  }
}

/// A paper card (see [paperDecoration]). Text and icons inside default to
/// ink; styles that name their own colour keep it.
class Paper extends StatelessWidget {
  const Paper({
    super.key,
    required this.child,
    this.radius = 22,
    this.padding,
    this.color = AppColors.paper,
    this.drop = 6,
  });

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  final Color color;
  final double drop;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: paperDecoration(
        radius: BorderRadius.circular(radius),
        color: color,
        drop: drop,
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: AppColors.ink),
        child: IconTheme.merge(
          data: const IconThemeData(color: AppColors.ink),
          child: Padding(padding: padding ?? EdgeInsets.zero, child: child),
        ),
      ),
    );
  }
}
