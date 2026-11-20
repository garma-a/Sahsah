import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/retro.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'game_controller.dart';
import 'model/question.dart';
import 'question_screen.dart';
import 'results_screen.dart';
import 'ui/game_ui.dart';

/// The 6 × 6 board the host plays from.
class BoardScreen extends StatefulWidget {
  const BoardScreen({super.key});

  @override
  State<BoardScreen> createState() => _BoardScreenState();
}

class _BoardScreenState extends State<BoardScreen> {
  bool _leaving = false;

  @override
  void initState() {
    super.initState();
    // The host's phone shouldn't sleep in the middle of a round.
    WakelockPlus.enable().ignore();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Restored mid-question (app was closed): reopen it.
      final active = context.game.game?.activeId;
      if (active != null) _openQuestion(active);
    });
  }

  @override
  void dispose() {
    WakelockPlus.disable().ignore();
    super.dispose();
  }

  Future<void> _openQuestion(String id) async {
    final game = context.game;
    game.open(id);
    await Navigator.of(context).push(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 260),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => QuestionScreen(questionId: id),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween(begin: 0.96, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            ),
            child: child,
          ),
        ),
      ),
    );
    if (!mounted) return;
    if (game.game?.activeId == id) game.leave();
    if (game.game?.finished ?? false) _showResults();
  }

  void _showResults() {
    if (_leaving) return;
    _leaving = true;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const ResultsScreen()));
  }

  Future<void> _exit() async {
    final lang = context.lang;
    final ok = await confirmDialog(
      context,
      title: lang.t('نخرج من اللعبة؟', 'Nokhrog men el le3ba?'),
      message: lang.t(
        'اللعبة هتفضل محفوظة، وتقدروا تكملوها من الرئيسية خلال ٢٤ ساعة.',
        'El le3ba hatfdal ma7fooza, w te2daro tkammelooha mel re2eseya khelal 24 sa3a.',
      ),
      confirm: lang.t('اخرج', 'Okhrog'),
    );
    if (ok && mounted) Navigator.of(context).pop();
  }

  Future<void> _endGame() async {
    final lang = context.lang;
    final ok = await confirmDialog(
      context,
      title: lang.t('ننهي اللعبة؟', 'Nenhy el le3ba?'),
      message: lang.t(
        'النتيجة هتتقفل على كده، ومش هتقدروا تكملوا الأسئلة الباقية.',
        'El nateega hat2fel 3ala keda, w mesh hate2daro tkammelo el as2ela el ba2ya.',
      ),
      confirm: lang.t('أنهي اللعبة', 'Anhy el le3ba'),
      destructive: true,
    );
    if (!ok || !mounted) return;
    context.game.end();
    _showResults();
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.game;
    final game = controller.game;
    if (game == null) return const GameScaffold(child: SizedBox());

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _exit();
      },
      child: GameScaffold(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: _TopBar(game: game, onExit: _exit, onEnd: _endGame),
            ),
            Expanded(
              child: _Board(game: game, onOpen: _openQuestion),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.game,
    required this.onExit,
    required this.onEnd,
  });

  final Game game;
  final VoidCallback onExit;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Row(
      children: [
        RoundIconButton(
          icon: LucideIcons.x,
          label: lang.t('خروج', 'Khoroog'),
          onTap: onExit,
        ),
        const SizedBox(width: 8),
        Expanded(child: TeamScore(game: game, team: 0)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                lang.toAr('${game.resolvedCount}/${game.totalQuestions}'),
                textDirection: TextDirection.ltr,
                style: AppText.num(18, color: AppColors.ivory, height: 1.1),
              ),
              Text(
                lang.t('سؤال', 'so2al'),
                style: AppText.sans(
                  11,
                  color: AppColors.ivory.withValues(alpha: 0.6),
                  height: 1.2,
                ),
              ),
            ],
          ),
        ),
        Expanded(child: TeamScore(game: game, team: 1)),
        const SizedBox(width: 8),
        RoundIconButton(
          icon: LucideIcons.flag,
          label: lang.t('أنهي اللعبة', 'Anhy el le3ba'),
          onTap: onEnd,
        ),
      ],
    );
  }
}

/// A team's name and score; tap to correct the total.
class TeamScore extends StatelessWidget {
  const TeamScore({
    super.key,
    required this.game,
    required this.team,
    this.compact = false,
  });

  final Game game;
  final int team;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final color = teamColors[team];
    final ink = AppColors.inkOn(color);
    final leading = game.leader == team;
    return Semantics(
      button: !game.finished,
      label: lang.t(
        '${game.teamNames[team]}: ${game.scores[team]} نقطة، عدّل النقط',
        '${game.teamNames[team]}: ${game.scores[team]} no2ta, 3addel el no2at',
      ),
      excludeSemantics: true,
      child: Pressable(
        onTap: game.finished ? null : () => _editScore(context, game, team),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          height: compact ? 44 : 52,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          // Solid team colour like the deck's score pills; the leader gets
          // a yellow ring.
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: color,
            border: Border.all(
              color: leading ? AppColors.gold : AppColors.deep,
              width: leading ? 3 : 2,
            ),
            boxShadow: [cssShadow(const Color(0x66000000), y: 6, blur: 14)],
          ),
          child: Row(
            children: [
              if (leading) ...[
                Icon(LucideIcons600.crown, size: 16, color: ink),
                const SizedBox(width: 6),
              ],
              // Name at the start, a big score at the end: readable from
              // across the room.
              Expanded(
                child: Text(
                  game.teamNames[team],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.display(
                    compact ? 16 : 20,
                    height: 1.2,
                    color: ink,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              TweenAnimationBuilder<double>(
                tween: Tween(end: game.scores[team].toDouble()),
                duration: const Duration(milliseconds: 600),
                curve: Curves.easeOutCubic,
                builder: (context, v, _) => Text(
                  lang.toAr(v.round()),
                  textDirection: TextDirection.ltr,
                  style: AppText.num(compact ? 22 : 30, color: ink, height: 1),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Host enters a new nonnegative total (Q55).
Future<void> _editScore(BuildContext context, Game game, int team) async {
  final lang = context.lang;
  final controller = context.game;
  var value = game.scores[team];
  final field = TextEditingController(text: '$value');
  final color = teamColors[team];

  final saved = await showModalBottomSheet<int>(
    context: context,
    isScrollControlled: true,
    constraints: const BoxConstraints(maxWidth: 560),
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      return StatefulBuilder(
        builder: (sheetContext, setSheet) {
          void set(int v) {
            value = v < 0 ? 0 : v;
            field.text = '$value';
            setSheet(() {});
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.forest,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(28),
                ),
                border: Border(
                  top: BorderSide(color: color.withValues(alpha: 0.5)),
                ),
              ),
              padding: EdgeInsets.fromLTRB(
                20,
                18,
                20,
                20 + MediaQuery.paddingOf(sheetContext).bottom,
              ),
              // Scrolls when the keyboard leaves little room (landscape).
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      lang.t('تعديل نقط الفريق', 'Ta3deel no2at el fare2'),
                      style: AppText.display(26, height: 1.2),
                    ),
                    Text(
                      game.teamNames[team],
                      style: AppText.sans(
                        15,
                        weight: FontWeight.w700,
                        color: color,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Row(
                        children: [
                          _Step(label: '−100', onTap: () => set(value - 100)),
                          const SizedBox(width: 10),
                          Expanded(
                            child: TextField(
                              key: const ValueKey('score-field'),
                              controller: field,
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              inputFormatters: [
                                FilteringTextInputFormatter.digitsOnly,
                                LengthLimitingTextInputFormatter(6),
                              ],
                              onChanged: (t) => value = int.tryParse(t) ?? 0,
                              style: AppText.num(34, color: AppColors.ivory),
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: Colors.white.withValues(alpha: 0.06),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(16),
                                  borderSide: BorderSide.none,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          _Step(label: '+100', onTap: () => set(value + 100)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    GoldButton(
                      label: lang.t('احفظ', 'E7faz'),
                      icon: LucideIcons600.check,
                      onTap: () => Navigator.of(sheetContext).pop(value),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  );
  field.dispose();
  if (saved != null) controller.setScore(team, saved);
}

class _Step extends StatelessWidget {
  const _Step({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          width: 72,
          height: 56,
          alignment: Alignment.center,
          decoration: glassDecoration(
            radius: BorderRadius.circular(16),
            shadow: false,
          ),
          child: Text(label, style: AppText.num(16, color: AppColors.ivory)),
        ),
      ),
    );
  }
}

class _Board extends StatelessWidget {
  const _Board({required this.game, required this.onOpen});

  final Game game;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final landscape = box.maxWidth > box.maxHeight;
        final columns = landscape ? 3 : 2;
        final rows = (game.categoryIds.length / columns).ceil();
        const gap = 10.0;
        const pad = 12.0;
        final cardWidth =
            (box.maxWidth - pad * 2 - gap * (columns - 1)) / columns;
        // Fill the screen when there's room; otherwise scroll.
        final fitHeight = (box.maxHeight - pad - gap * (rows - 1)) / rows;
        final scrolls = fitHeight < _CategoryCard.minHeight;
        final cardHeight = scrolls ? _CategoryCard.minHeight : fitHeight;

        return SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(pad, 0, pad, pad),
          physics: scrolls
              ? const BouncingScrollPhysics()
              : const NeverScrollableScrollPhysics(),
          child: Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (final id in game.categoryIds)
                SizedBox(
                  width: cardWidth,
                  height: cardHeight,
                  child: _CategoryCard(
                    categoryId: id,
                    game: game,
                    onOpen: onOpen,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.categoryId,
    required this.game,
    required this.onOpen,
  });

  final String categoryId;
  final Game game;
  final ValueChanged<String> onOpen;

  /// Small enough for two rows on a landscape phone.
  static const minHeight = 140.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) => _build(context, box));
  }

  Widget _build(BuildContext context, BoxConstraints box) {
    final lang = context.lang;
    final category = allCategories.firstWhere((c) => c.id == categoryId);
    final slot = game.categoryIds.indexOf(categoryId);
    final sleeve =
        AppColors.categoryColors[slot % AppColors.categoryColors.length];
    final ink = AppColors.inkOn(sleeve);
    final name = lang.t(category.name, category.nameEn);
    final done = [
      for (var r = 0; r < tilePoints.length; r++)
        game.results.containsKey('$categoryId-$r'),
    ].every((d) => d);

    const pad = 8.0;
    const titleHeight = 24.0;
    final bodyHeight = box.maxHeight - pad * 2 - titleHeight - 4;
    final disc = bodyHeight.clamp(0.0, box.maxWidth * 0.44);

    // 200/200, 400/400, 600/600 in rows beside the record.
    Widget tiles() => Column(
      children: [
        for (final (i, row) in const [
          [0, 1],
          [2, 3],
          [4, 5],
        ].indexed) ...[
          if (i > 0) const SizedBox(height: 5),
          Expanded(
            child: Row(
              children: [
                for (final (j, r) in row.indexed) ...[
                  if (j > 0) const SizedBox(width: 5),
                  Expanded(
                    child: _Tile(
                      id: '$categoryId-$r',
                      points: tilePoints[r],
                      result: game.results['$categoryId-$r'],
                      inProgress: game.progress.containsKey('$categoryId-$r'),
                      categoryName: name,
                      teamNames: game.teamNames,
                      onTap: () => onOpen('$categoryId-$r'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );

    return Container(
      padding: const EdgeInsets.all(pad),
      decoration: BoxDecoration(
        color: sleeve,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.deep, width: 2.5),
        boxShadow: [cssShadow(const Color(0x66000000), y: 10, blur: 24)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: titleHeight,
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(18, height: 1.3, color: ink),
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: Row(
              children: [
                Expanded(child: tiles()),
                const SizedBox(width: 8),
                Opacity(
                  opacity: done ? 0.4 : 1,
                  child: VinylDisc(
                    size: disc,
                    labelColor: AppColors.cream,
                    image: BrandImages.category(categoryId),
                    labelFraction: 0.58,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({
    required this.id,
    required this.points,
    required this.result,
    required this.inProgress,
    required this.categoryName,
    required this.teamNames,
    required this.onTap,
  });

  final String id;
  final int points;
  final TileResult? result;
  final bool inProgress;
  final String categoryName;
  final List<String> teamNames;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final r = result;
    final won = r?.team;
    final label = r == null
        ? '$categoryName — $points'
        : won != null
        ? lang.t(
            '$categoryName — $points — كسبه ${teamNames[won]}',
            '$categoryName — $points — kasabo ${teamNames[won]}',
          )
        : lang.t(
            '$categoryName — $points — محدش كسبه',
            '$categoryName — $points — ma7adsh kasabo',
          );

    final Widget face;
    if (r == null) {
      face = Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.ivory, AppColors.cream],
          ),
          border: Border.all(
            color: AppColors.deep,
            width: inProgress ? 3 : 1.5,
          ),
          boxShadow: [cssShadow(const Color(0x40000000), y: 3, blur: 6)],
        ),
        alignment: Alignment.center,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            lang.toAr(points),
            style: AppText.num(18, color: AppColors.deep, height: 1),
          ),
        ),
      );
    } else if (won != null) {
      face = Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: teamColors[won],
          border: Border.all(color: AppColors.deep, width: 1.5),
        ),
        child: Icon(
          LucideIcons600.check,
          size: 18,
          color: AppColors.inkOn(teamColors[won]),
        ),
      );
    } else {
      face = Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: AppColors.deep.withValues(alpha: 0.35),
        ),
        child: Icon(
          LucideIcons.x,
          size: 16,
          color: AppColors.ivory.withValues(alpha: 0.5),
        ),
      );
    }

    return Semantics(
      button: r == null,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        scale: 0.92,
        onTap: r == null ? onTap : null,
        child: face,
      ),
    );
  }
}
