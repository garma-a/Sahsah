import 'package:flutter/material.dart';

/// "Retro night" palette from the brand deck (Canva, slides 23–25 and
/// 37–40): a navy base for focus, bold retro colours on top. The old names
/// are kept so every screen picks the palette up.
abstract final class AppColors {
  /// Raised surfaces: dialogs, sheets, bars.
  static const forest = Color(0xFF161C48);

  /// Page background (deep navy).
  static const deep = Color(0xFF0B0F2E);

  /// Tile and button faces.
  static const ui = Color(0xFF212A66);

  /// Primary accent (retro yellow).
  static const gold = Color(0xFFFFC72C);
  static const goldBright = Color(0xFFFFD95A);

  /// Text on dark (warm cream white).
  static const ivory = Color(0xFFFFF6E5);

  /// Paper (cards, polaroid frames, torn-paper strips).
  static const cream = Color(0xFFF3E9D2);
  static const stroke = Color(0xFFE8DCC0);

  /// The red of the play button and the first team.
  static const play = Color(0xFFE63B2E);
  static const playHover = Color(0xFFC92F24);

  /// Behind artwork.
  static const card = Color(0xFF101540);

  /// Poster title strip.
  static const poster = Color(0xFF0D1238);

  // Bold retro accents.
  static const teal = Color(0xFF2EC4D6);
  static const orange = Color(0xFFF28C28);
  static const green = Color(0xFF3DAA5C);
  static const purple = Color(0xFF7B4FD6);
  static const blue = Color(0xFF2D6BE0);
  static const pink = Color(0xFFFF2E93);
  static const maroon = Color(0xFF8E1B3A);

  /// The rainbow stripe, outside in.
  static const rainbow = [play, orange, gold, green, teal, blue];

  /// One bold colour per board slot, for vinyl labels and sleeves.
  static const categoryColors = [blue, play, gold, green, purple, teal];

  /// Text colour that reads on [background]: navy on light, white on dark.
  static Color inkOn(Color background) =>
      background.computeLuminance() > 0.4 ? deep : const Color(0xFFFFFFFF);
}

/// The three font stacks: `font-display`, `font-sans` and `.num`.
abstract final class AppFonts {
  static const display = 'Lalezar';
  static const sans = 'ReadexPro';
  static const num = 'ReemKufi';
}

/// Text style helpers. Heights follow Tailwind v4's default line heights so
/// spacing matches the web build.
abstract final class AppText {
  /// Line height Tailwind pairs with each named size.
  static double? _tailwindHeight(double size) => switch (size) {
    12 => 16 / 12,
    14 => 20 / 14,
    16 => 1.5,
    18 => 28 / 18,
    20 => 28 / 20,
    24 => 32 / 24,
    30 => 36 / 30,
    _ => 1.5, // Arbitrary sizes inherit the body's 1.5.
  };

  static TextStyle sans(
    double size, {
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.ivory,
    double? height,
  }) => TextStyle(
    fontFamily: AppFonts.sans,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height ?? _tailwindHeight(size),
    leadingDistribution: TextLeadingDistribution.even,
  );

  static TextStyle display(
    double size, {
    Color color = AppColors.ivory,
    double? height,
  }) => TextStyle(
    fontFamily: AppFonts.display,
    fontSize: size,
    fontWeight: FontWeight.w400,
    color: color,
    height: height ?? _tailwindHeight(size),
    leadingDistribution: TextLeadingDistribution.even,
  );

  static TextStyle num(
    double size, {
    FontWeight weight = FontWeight.w700,
    Color color = AppColors.gold,
    double? height,
  }) => TextStyle(
    fontFamily: AppFonts.num,
    fontSize: size,
    fontWeight: weight,
    color: color,
    height: height ?? _tailwindHeight(size),
    leadingDistribution: TextLeadingDistribution.even,
    fontFeatures: const [FontFeature.tabularFigures()],
  );
}

abstract final class AppTheme {
  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: AppFonts.sans,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.gold,
        onPrimary: AppColors.forest,
        secondary: AppColors.play,
        onSecondary: Colors.white,
        surface: AppColors.deep,
        onSurface: AppColors.ivory,
        error: AppColors.play,
      ),
      scaffoldBackgroundColor: AppColors.deep,
      splashFactory: NoSplash.splashFactory,
      highlightColor: Colors.transparent,
      textSelectionTheme: const TextSelectionThemeData(
        selectionColor: AppColors.gold,
        cursorColor: AppColors.gold,
      ),
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(
        fontFamily: AppFonts.sans,
        bodyColor: AppColors.ivory,
        displayColor: AppColors.ivory,
      ),
    );
  }
}
