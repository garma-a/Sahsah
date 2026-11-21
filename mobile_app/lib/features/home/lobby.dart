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

/// Square menu tiles: categories, shop, gift, more.
class _MenuColumn extends StatelessWidget {
  const _MenuColumn();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    // Each tile a bold retro colour, dark ink on the light ones.
    final items = [
      (
        LucideIcons600.layoutGrid,
        lang.t('الفئات', 'Fe2at'),
        AppRoute.categories,
        AppColors.teal,
        AppColors.deep,
      ),
      (
        LucideIcons600.shoppingBag,
        lang.t('المتجر', 'El Matgar'),
        AppRoute.shop,
        AppColors.gold,
        AppColors.deep,
      ),
      (
        LucideIcons600.gift,
        lang.t('هدية', 'Hedeya'),
        AppRoute.gift,
        AppColors.pink,
        Colors.white,
      ),
      (
        LucideIcons600.settings,
        lang.t('المزيد', 'Aktar'),
        AppRoute.more,
        AppColors.purple,
        Colors.white,
      ),
    ];
    const gap = 8.0;
    return LayoutBuilder(
      builder: (context, box) {
        final tile = math.min(
          74.0,
          (box.maxHeight - gap * (items.length - 1)) / items.length,
        );
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (final (i, (icon, label, route, face, ink))
                in items.indexed) ...[
              if (i > 0) const SizedBox(height: gap),
              GameButton(
                width: 84,
                height: tile,
                depth: 5,
                color: face,
                borderColor: AppColors.deep,
                onTap: () => nav.go(route),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 22, color: ink),
                    const SizedBox(height: 3),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.fade,
                      softWrap: false,
                      style: AppText.sans(
                        12,
                        weight: FontWeight.w700,
                        color: ink,
                      ),
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
      decoration: BoxDecoration(
        borderRadius: radius,
        color: AppColors.card,
        border: Border.all(color: AppColors.ivory.withValues(alpha: 0.14)),
        boxShadow: [cssShadow(const Color(0x73000000), y: 18, blur: 40)],
      ),
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
                      Text(
                        lang.t('يلا نلعب؟', 'Yalla nel3ab?'),
                        style: AppText.display(36, height: 1.1),
                      ),
                      Text(
                        lang.t('مستنيين مين؟', 'Mestanyeen meen?'),
                        style: AppText.display(
                          20,
                          height: 1.2,
                          color: AppColors.gold,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          _Chip(
                            icon: LucideIcons.users,
                            label: lang.t('فريقين', 'Fare2een'),
                          ),
                          _HelpChip(onTap: () => _showHowTo(context)),
                        ],
                      ),
                      const Spacer(),
                      Row(
                        children: [
                          const Icon(
                            LucideIcons600.sparkles,
                            size: 15,
                            color: AppColors.gold,
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
                                color: AppColors.gold,
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
                          itemBuilder: (context, i) => _MiniRecord(
                            category: featured.categories[i],
                            color:
                                AppColors.categoryColors[i %
                                    AppColors.categoryColors.length],
                            height: rowHeight,
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

/// A category as a vinyl record: its artwork on the label, name below.
class _MiniRecord extends StatelessWidget {
  const _MiniRecord({
    required this.category,
    required this.color,
    required this.height,
  });

  final Category category;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final disc = height - 22;
    return Semantics(
      button: true,
      child: Pressable(
        onTap: () => showCategorySheet(context, category),
        child: SizedBox(
          width: disc,
          child: Column(
            children: [
              VinylDisc(
                size: disc,
                labelColor: color,
                image: BrandImages.category(category.id),
                labelFraction: 0.56,
              ),
              const SizedBox(height: 4),
              Text(
                lang.t(category.name, category.nameEn),
                maxLines: 1,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: AppText.sans(11, weight: FontWeight.w700, height: 1.3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// End column: resume, the big play button, join with a code.
class _PlayColumn extends StatelessWidget {
  const _PlayColumn({required this.tokens, required this.active});

  final int tokens;
  final Game? active;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = ShellNav.of(context);
    final game = active;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (game != null) ...[
          _ResumeTile(game: game),
          const SizedBox(height: 10),
        ],
        Expanded(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 160),
              child: GameButton(
                color: AppColors.play,
                radius: 26,
                depth: 8,
                borderColor: AppColors.deep,
                onTap: () => nav.go(AppRoute.play),
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
                          lang.t('ابدأ لعبة', 'Ebda2 le3ba'),
                          style: AppText.display(
                            34,
                            height: 1.1,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          lang.t(
                            '${lang.toAr(boardCategories)} فئات · ${lang.toAr(boardQuestions)} سؤال',
                            '$boardCategories fe2at · $boardQuestions so2al',
                          ),
                          style: AppText.sans(
                            12,
                            weight: FontWeight.w600,
                            color: Colors.white.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        GameButton(
          height: 54,
          color: AppColors.gold,
          borderColor: AppColors.deep,
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

/// Unfinished game: a compact tile above the play button.
class _ResumeTile extends StatelessWidget {
  const _ResumeTile({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return GameButton(
      height: 60,
      depth: 5,
      // The brand red mixed into the card green, like the portrait card.
      color: Color.lerp(AppColors.card, AppColors.play, 0.3)!,
      edgeColor: Color.lerp(AppColors.deep, AppColors.play, 0.2)!,
      borderColor: AppColors.play.withValues(alpha: 0.8),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => const BoardScreen())),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(
                color: AppColors.play,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.play_arrow_rounded,
                size: 22,
                color: Colors.white,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lang.t('كمّلوا لعبتكم', 'Kammelo le3betkom'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(17, height: 1.2),
                  ),
                  Text.rich(
                    TextSpan(
                      children: [
                        for (var t = 0; t < 2; t++) ...[
                          if (t > 0) const TextSpan(text: '  ·  '),
                          TextSpan(
                            text: '${game.teamNames[t]} ',
                            style: AppText.sans(11, weight: FontWeight.w600),
                          ),
                          TextSpan(
                            text: lang.toAr(game.scores[t]),
                            style: AppText.num(13, color: teamColors[t]),
                          ),
                        ],
                      ],
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            color: AppColors.gold,
            border: Border.all(color: AppColors.deep, width: 1.5),
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
                  color: AppColors.ivory.withValues(alpha: 0.8),
                ),
              ),
              Icon(
                lang.ar ? LucideIcons.chevronLeft : LucideIcons.chevronRight,
                size: 16,
                color: AppColors.ivory.withValues(alpha: 0.8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
