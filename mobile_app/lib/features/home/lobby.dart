part of 'home_page.dart';

/// The three "how to play" steps (portrait card and the lobby's help).
List<(String, String)> _howToSteps(LangController lang) => [
  (
    lang.t('اختاروا ٦ فئات', 'Ekhtaro 6 fe2at'),
    lang.t('من المكتبة الكبيرة', 'Men el maktaba el kebeera'),
  ),
  (
    lang.t('سمّوا الفريقين', 'Sammo el fare2een'),
    lang.t(
      'والشلة تدخل بالكود أو الـQR',
      'W el shella tedkhol bel code aw el QR',
    ),
  ),
  (
    lang.t('العبوا واكسبوا', 'El3abo w eksabo'),
    lang.t('٣٦ سؤال والأعلى نقط يكسب', '36 so2al wel a3la no2at yeksab'),
  ),
];

/// Landscape lobby, laid out like a mobile game's main screen: menu tiles at
/// the start, the stage with new challenges in the middle, and the big play
/// button at the end where the thumb rests.
class _Lobby extends StatelessWidget {
  const _Lobby({required this.tokens, required this.active});

  final int tokens;
  final Game? active;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _MenuColumn(),
        const SizedBox(width: 12),
        const Expanded(child: _Stage()),
        const SizedBox(width: 12),
        SizedBox(
          width: (width * 0.27).clamp(200.0, 280.0),
          child: _PlayColumn(tokens: tokens, active: active),
        ),
      ],
    );
  }
}

/// Square menu tiles: categories, shop, more. They are dark with a coloured
/// icon and edge, so the red play button stays the loudest thing on screen.
/// (Gifts are bought on the website, so there's no gift tile.)
class _MenuColumn extends StatelessWidget {
  const _MenuColumn();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final items = [
      (
        LucideIcons600.layoutGrid,
        lang.t('الفئات', 'Fe2at'),
        AppRoute.categories,
        AppColors.teal,
      ),
      (
        LucideIcons600.shoppingBag,
        lang.t('المتجر', 'El Matgar'),
        AppRoute.shop,
        AppColors.gold,
      ),
      (
        LucideIcons600.settings,
        lang.t('المزيد', 'Aktar'),
        AppRoute.more,
        AppColors.purple,
      ),
    ];
    const gap = 10.0;
    return LayoutBuilder(
      builder: (context, box) {
        final tile = math.min(
          84.0,
          (box.maxHeight - gap * (items.length - 1)) / items.length,
        );
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final (i, (icon, label, route, accent)) in items.indexed) ...[
              if (i > 0) const SizedBox(height: gap),
              GameButton(
                width: 84,
                height: tile,
                depth: 5,
                color: AppColors.ui,
                borderColor: accent,
                onTap: () => nav.go(route),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 24, color: accent),
                    const SizedBox(height: 4),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.fade,
                      softWrap: false,
                      style: AppText.sans(13, weight: FontWeight.w700),
                    ),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }
}

/// Centre stage: the game's art and name, and the newest challenges.
class _Stage extends StatelessWidget {
  const _Stage();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final radius = BorderRadius.circular(26);
    final featured = categorySections.first;

    return Container(
      // The website's shelf sheet: cream paper pinned to the wall with an
      // ink outline and a bright cyan offset shadow.
      decoration: sheetDecoration(radius: radius),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            // Small rainbow sweep in the top corner (decoration only).
            const PositionedDirectional(
              top: 0,
              end: 0,
              width: 84,
              height: 84,
              child: Rainbow(corner: RainbowCorner.topEnd, band: 7),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
              child: LayoutBuilder(
                builder: (context, box) {
                  // The title, chips and row label take about 160px; the
                  // records get what's left.
                  final rowHeight = (box.maxHeight - 160).clamp(72.0, 150.0);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // The website's hero labels: printed strips stuck on
                      // crooked, each with an ink offset shadow.
                      Rise(
                        delay: const Duration(milliseconds: 60),
                        turn: -3,
                        child: _Label(
                          text: lang.t('يلا نلعب؟', 'Yalla nel3ab?'),
                          size: 30,
                          fill: AppColors.press,
                          ink: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Rise(
                        delay: const Duration(milliseconds: 160),
                        turn: 1.5,
                        child: _Label(
                          text: lang.t('مستنيين مين؟', 'Mestanyeen meen?'),
                          size: 19,
                          fill: AppColors.cyan,
                          ink: AppColors.ink,
                        ),
                      ),
                      const SizedBox(height: 8),
                      _HelpChip(onTap: () => _showHowTo(context)),
                      const Spacer(),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons600.sparkles,
                            size: 15,
                            color: AppColors.pressDeep,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              lang.t(featured.name, featured.nameEn),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.sans(
                                14,
                                weight: FontWeight.w700,
                                color: AppColors.pressDeep,
                              ),
                            ),
                          ),
                          _SeeAll(
                            onTap: () =>
                                ShellNav.of(context).go(AppRoute.categories),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: rowHeight,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          // The shell already keeps clear of cutouts.
                          padding: EdgeInsets.zero,
                          itemCount: featured.categories.length,
                          separatorBuilder: (_, _) => const SizedBox(width: 12),
                          // Pasted up one by one, a little crooked, like the
                          // website's poster fan.
                          itemBuilder: (context, i) => Rise(
                            delay:
                                Rise.step(i, ms: 90) +
                                const Duration(milliseconds: 250),
                            turn: const [-2.0, 1.5, -1.0, 2.0][i % 4],
                            child: _MiniPack(
                              category: featured.categories[i],
                              tone: i,
                              height: rowHeight,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A category as a small pack card: its photo in a coloured frame, with
/// the name over the bottom.
class _MiniPack extends StatelessWidget {
  const _MiniPack({
    required this.category,
    required this.tone,
    required this.height,
  });

  final Category category;
  final int tone;
  final double height;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      child: Pressable(
        onTap: () => showCategorySheet(context, category),
        child: Container(
          width: height * 0.78,
          // A small poster: the website's lobby strip, name on a slab.
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: coverBorders[toneOf(tone)], width: 3),
            boxShadow: [inkDrop(4)],
          ),
          child: CategoryCover(
            image: BrandImages.category(category.id),
            name: lang.t(category.name, category.nameEn),
            tone: tone,
          ),
        ),
      ),
    );
  }
}

/// End column: the main button, then the smaller ones. With a game in
/// progress the main button continues it and "new game" steps down to a
/// small button; otherwise the main button starts a game.
class _PlayColumn extends StatelessWidget {
  const _PlayColumn({required this.tokens, required this.active});

  final int tokens;
  final Game? active;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final game = active;
    void resume() => Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const BoardScreen()));
    // A lone Arabic zero is a small dot, so say it.
    String score(int n) => n == 0 && lang.ar ? 'صفر' : lang.toAr(n);

    final sub = AppText.sans(
      13,
      weight: FontWeight.w600,
      color: Colors.white.withValues(alpha: 0.9),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 170),
              child: GameButton(
                key: const ValueKey('lobby-main'),
                color: AppColors.play,
                radius: 26,
                depth: 6,
                borderColor: AppColors.cyan,
                borderWidth: 4,
                edgeColor: AppColors.pressDeep,
                onTap: game == null ? () => nav.go(AppRoute.play) : resume,
                child: Padding(
                  padding: const EdgeInsets.all(8),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.play_arrow_rounded,
                          size: 46,
                          color: Colors.white,
                        ),
                        Text(
                          game == null
                              ? lang.t('ابدأ لعبة', 'Ebda2 le3ba')
                              : lang.t('كمّلوا لعبتكم', 'Kammelo le3betkom'),
                          style: AppText.display(
                            game == null ? 34 : 30,
                            height: 1.1,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        if (game == null)
                          Text(
                            lang.t(
                              '${lang.toAr(boardCategories)} فئات · ${lang.toAr(boardQuestions)} سؤال',
                              '$boardCategories fe2at · $boardQuestions so2al',
                            ),
                            style: sub,
                          )
                        else
                          // Where the game stands.
                          Text(
                            '${game.teamNames[0]} ${score(game.scores[0])}'
                            '  ·  '
                            '${game.teamNames[1]} ${score(game.scores[1])}',
                            style: sub,
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (game != null) ...[
          const SizedBox(height: 10),
          GameButton(
            key: const ValueKey('lobby-new'),
            height: 46,
            depth: 4,
            color: AppColors.ink,
            borderColor: AppColors.cyan.withValues(alpha: 0.7),
            onTap: () => nav.go(AppRoute.play),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  LucideIcons600.plus,
                  size: 17,
                  color: AppColors.ivory,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    lang.t('لعبة جديدة', 'Le3ba gedeeda'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(15, weight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 10),
        GameButton(
          height: 54,
          color: AppColors.gold,
          onTap: nav.openJoin,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons600.keyRound,
                size: 18,
                color: AppColors.deep,
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  lang.t('ادخل بكود', 'Bel code'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.sans(
                    16,
                    weight: FontWeight.w700,
                    color: AppColors.deep,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// "How to play" as a pop-up from the stage's help button.
Future<void> _showHowTo(BuildContext context) {
  final lang = context.lang;
  return showDialog<void>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (dialogContext) => Dialog(
      backgroundColor: AppColors.forest,
      insetPadding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: AppColors.gold.withValues(alpha: 0.3)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 460),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                lang.t('إزاي نلعب؟', 'Ezay nel3ab?'),
                style: AppText.display(26, height: 1.2),
              ),
              const SizedBox(height: 10),
              _Steps(steps: _howToSteps(lang)),
              const SizedBox(height: 14),
              GoldButton(
                label: lang.t('تمام', 'Tamam'),
                onTap: () => Navigator.of(dialogContext).pop(),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// "How to play" as a chip that reads as a button.
class _HelpChip extends StatelessWidget {
  const _HelpChip({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final label = lang.t('إزاي نلعب؟', 'Ezay nel3ab?');
    return Pressable(
      semanticLabel: label,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: AppColors.gold,
          border: Border.all(color: AppColors.ink, width: 2.5),
          boxShadow: [inkDrop(3)],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons600.circleHelp,
              size: 15,
              color: AppColors.deep,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: AppText.sans(
                13,
                weight: FontWeight.w700,
                color: AppColors.deep,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Small "see all" link with a chevron.
class _SeeAll extends StatelessWidget {
  const _SeeAll({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      child: Pressable(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                lang.t('الكل', 'El kol'),
                style: AppText.sans(
                  13,
                  weight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              Icon(
                lang.ar ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                size: 16,
                color: AppColors.ink,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A heading printed on a strip of colour, with an ink offset shadow, like
/// the website's hero labels.
class _Label extends StatelessWidget {
  const _Label({
    required this.text,
    required this.size,
    required this.fill,
    required this.ink,
  });

  final String text;
  final double size;
  final Color fill;
  final Color ink;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 1),
      decoration: BoxDecoration(
        color: fill,
        boxShadow: const [
          BoxShadow(color: AppColors.ink, offset: Offset(4, 4)),
        ],
      ),
      child: Text(
        text,
        maxLines: 1,
        style: AppText.display(size, height: 1.3, color: ink),
      ),
    );
  }
}
