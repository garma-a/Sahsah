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

/// `.glass`: translucent ivory gradient with a warm hairline border.
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
      colors: [Color(0x1AFFFDF8), Color(0x0AFFFDF8)],
    ),
    border: Border.all(color: borderColor ?? const Color(0x29FFF0C8)),
    boxShadow: shadow
        ? [cssShadow(const Color(0x40000000), y: 20, blur: 50)]
        : null,
  );
}

/// `.paper`: light card used for the mission/vision quotes.
BoxDecoration paperDecoration({BorderRadiusGeometry? radius}) {
  return BoxDecoration(
    borderRadius: radius,
    gradient: const LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [AppColors.ivory, Color(0xFFEADFC4)],
    ),
    border: Border.all(color: AppColors.stroke),
    boxShadow: [cssShadow(const Color(0x47000000), y: 16, blur: 40)],
  );
}

/// Glass with the inner top highlight (`inset 0 1px 0 rgba(255,255,255,.08)`).
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
