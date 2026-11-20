import 'package:flutter/material.dart';

/// The website's palette (`web_app/frontend/src/app/globals.css`), taken
/// from the client's brand sheet: charcoal and cream paper, bold retro
/// colours on top, and a dark ink for outlines. The old names are kept so
/// every screen picks the palette up.
abstract final class AppColors {
  // Brand sheet.
  static const charcoal = Color(0xFF2B3230);
  static const cyan = Color(0xFF33C3D6);
  static const orangeRed = Color(0xFFEE4B2B);
  static const sun = Color(0xFFFFD233);
  static const red = Color(0xFFFF3B3B);
  static const amber = Color(0xFFFFC21A);
  static const logoBlue = Color(0xFF22529E);

  /// The chunky button face (white on it passes AA, 4.6:1) and its lip.
  static const press = Color(0xFFD63A19);
  static const pressDeep = Color(0xFFA52A10);

  /// Pink for tiles and ribbons (white on it passes AA, 5.3:1).
  static const pinkPress = Color(0xFFD1066C);

  /// Outlines, offset shadows and text on paper.
  static const ink = Color(0xFF1D2321);
  static const night = Color(0xFF0E1412);

  /// Paper: the page cream, the card cream and its shade.
  static const paper = Color(0xFFFFF8EA);
  static const paperShade = Color(0xFFECDCB8);

  /// Muted text on paper (AA on [paper]).
  static const inkMuted = Color(0xFF5B625F);

  /// Raised surfaces: dialogs, sheets, bars. Also dark text on light fills.
  static const forest = ink;

  /// Page background. Charcoal rather than ink, so ink outlines and offset
  /// shadows show against it.
  static const deep = charcoal;

  /// Dark tile and button faces (the TV cabinet).
  static const ui = Color(0xFF262E2C);

  /// Primary accent.
  static const gold = sun;
  static const goldBright = Color(0xFFFFE066);

  /// Text on dark.
  static const ivory = Color(0xFFFFF3DC);

  /// Paper (cards, picture frames, torn-paper strips).
  static const cream = paper;
  static const stroke = Color(0xFFD9C7A0);

  /// The main button and alarms. Teams are [cyan] and [sun], so red is
  /// never a team colour.
  static const play = press;
  static const playHover = pressDeep;

  /// Behind artwork.
  static const card = Color(0xFF22160E);

  /// Poster title strip.
  static const poster = ink;

  // Bold retro accents.
  static const teal = cyan;
  static const orange = Color(0xFFF39223);
  static const green = Color(0xFF3FBF6B);
  static const purple = pinkPress;
  static const blue = logoBlue;
  static const pink = Color(0xFFFF0A84);
  static const maroon = Color(0xFF8B0029);

  /// The rainbow stripe, outside in.
  static const rainbow = [press, orange, sun, green, cyan, logoBlue];

  /// One colour family per board slot, in the website's order
  /// (`components/brand/tones.ts`). Each clears AA with [inkOn].
  static const categoryColors = [press, cyan, green, pinkPress, logoBlue, sun];

  /// Text colour that reads on [background]: ink on light, white on dark.
  static Color inkOn(Color background) =>
      background.computeLuminance() > 0.3 ? ink : const Color(0xFFFFFFFF);
}

/// The website's three faces: headings and numbers, body, poster titles.
abstract final class AppFonts {
  static const display = 'Lalezar';
  static const sans = 'Alexandria';
  static const num = 'Lalezar';
  static const poster = 'Rakkas';
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

  /// Numbers in the heading face, as on the website's scores. Lalezar has
  /// one weight, so [weight] only matters to fallback fonts.
  static TextStyle num(
    double size, {
    FontWeight weight = FontWeight.w400,
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

  /// Poster titles, hand-lettered in Rakkas.
  static TextStyle poster(
    double size, {
    Color color = AppColors.ivory,
    double? height,
  }) => TextStyle(
    fontFamily: AppFonts.poster,
    fontSize: size,
    fontWeight: FontWeight.w400,
    color: color,
    height: height ?? 1.05,
    leadingDistribution: TextLeadingDistribution.even,
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
        onPrimary: AppColors.ink,
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
