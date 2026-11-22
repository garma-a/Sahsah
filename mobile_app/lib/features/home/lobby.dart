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
    // The stage's cyan shadow juts 7px to the right, so that side gets the
    // shadow's width on top of the gap: both sides then read as 14px.
    final rtl = Directionality.of(context) == TextDirection.rtl;
    const gap = 14.0, shadow = 8.0;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _MenuColumn(),
        SizedBox(width: gap + (rtl ? shadow : 0)),
        const Expanded(child: _Stage()),
        SizedBox(width: gap + (rtl ? 0 : shadow)),
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

/// Centre stage: the banner space. The promos (new challenges, free play,
/// how to play) turn on the website's paper sheet; a button on each acts on
/// it.
class _Stage extends StatelessWidget {
  const _Stage();

  @override
  Widget build(BuildContext context) {
    return Rise(
      delay: const Duration(milliseconds: 60),
      child: Container(
        // The website's shelf sheet: an ink outline and a cyan offset
        // shadow, here framing the banners.
        decoration: sheetDecoration(radius: BorderRadius.circular(26)),
        child: ClipRRect(
          // Inside the sheet's 4px outline.
          borderRadius: BorderRadius.circular(22),
          child: PromoCarousel(
            promos: homePromos(context.lang),
            onAction: (promo) => runPromo(context, promo),
          ),
        ),
      ),
    );
  }
}

/// Does what [promo]'s button says, from a context under the shell.
void runPromo(BuildContext context, Promo promo) {
  final nav = ShellNav.of(context);
  switch (promo.action) {
    case PromoAction.newPack:
      nav.go(AppRoute.categories);
    case PromoAction.play:
      nav.go(AppRoute.play);
    case PromoAction.howTo:
      _showHowTo(context);
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
