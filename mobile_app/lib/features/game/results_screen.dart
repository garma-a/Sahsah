import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'game_controller.dart';
import 'model/question.dart';
import 'setup_screen.dart';
import 'ui/game_ui.dart';

/// Final scores. Scores are locked; the saved game is cleared on leaving.
class ResultsScreen extends StatefulWidget {
  const ResultsScreen({super.key});

  @override
  State<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends State<ResultsScreen> {
  Game? _game;

  @override
  void initState() {
    super.initState();
    HapticFeedback.heavyImpact();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Keep our own copy: the controller forgets the game when we leave.
    _game ??= context.game.game;
  }

  void _home() {
    context.game.discard();
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  void _replay() {
    final game = _game!;
    context.game.discard();
    final navigator = Navigator.of(context);
    navigator.popUntil((route) => route.isFirst);
    // Back to setup with the same teams and categories (Q74).
    openSetup(
      navigator.context,
      categoryIds: game.categoryIds,
      teams: game.teamNames,
    );
  }

  @override
  Widget build(BuildContext context) {
    final game = _game;
    if (game == null) return const GameScaffold(child: SizedBox());
    final lang = context.lang;
    final leader = game.leader;

    final actions = Row(
      children: [
        Expanded(
          child: GlassButton(
            height: 56,
            icon: LucideIcons.house,
            label: lang.t('الرئيسية', 'El Re2eseya'),
            onTap: _home,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 2,
          child: PlayButton(
            height: 56,
            sheen: true,
            onPressed: _replay,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons600.rotateCcw, size: 20),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    lang.t('العبوا مرة تانية', 'El3abo marra tanya'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      18,
                      weight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
    final scores = Row(
      children: [
        for (var t = 0; t < 2; t++) ...[
          if (t > 0) const SizedBox(width: 10),
          Expanded(
            child: _ScoreCard(game: game, team: t),
          ),
        ],
      ],
    );
    final breakdown = Glass(
      radius: 20,
      shadow: false,
      child: Column(
        children: [
          // Column labels: which team each points column belongs to.
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
            child: Row(
              children: [
                const Spacer(),
                for (var t = 0; t < 2; t++) ...[
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 64,
                    child: Text(
                      game.teamNames[t],
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.sans(
                        12,
                        weight: FontWeight.w700,
                        color: teamColors[t],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          for (final (i, id) in game.categoryIds.indexed) ...[
            if (i > 0)
              Divider(height: 1, color: Colors.white.withValues(alpha: 0.08)),
            _CategoryRow(game: game, categoryId: id),
          ],
        ],
      ),
    );
    final breakdownTitle = Text(
      lang.t('النقط في كل فئة', 'El no2at fe kol fe2a'),
      style: AppText.display(22, height: 1.2),
    );

    // Game screens are landscape: result on one side, details on the other.
    final landscape =
        MediaQuery.orientationOf(context) == Orientation.landscape;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _home();
      },
      child: landscape
          ? GameScaffold(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      flex: 5,
                      child: Column(
                        children: [
                          Expanded(
                            child: Center(
                              child: SingleChildScrollView(
                                child: _Banner(
                                  game: game,
                                  leader: leader,
                                  compact: true,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          scores,
                          const SizedBox(height: 12),
                          actions,
                        ],
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      flex: 5,
                      child: ListView(
                        children: [
                          breakdownTitle,
                          const SizedBox(height: 10),
                          breakdown,
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
          : GameScaffold(
              bottom: actions,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                children: [
                  _Banner(game: game, leader: leader),
                  const SizedBox(height: 18),
                  scores,
                  const SizedBox(height: 22),
                  breakdownTitle,
                  const SizedBox(height: 10),
                  breakdown,
                ],
              ),
            ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({
    required this.game,
    required this.leader,
    this.compact = false,
  });

  final Game game;
  final int? leader;

  /// Landscape: no logo and a smaller trophy.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final color = leader == null ? AppColors.ivory : teamColors[leader!];
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.85, end: 1),
      duration: const Duration(milliseconds: 600),
      curve: Curves.elasticOut,
      builder: (context, v, child) => Transform.scale(scale: v, child: child),
      child: Column(
        children: [
          if (!compact) ...[const Logo(size: 56), const SizedBox(height: 14)],
          Container(
            width: compact ? 64 : 84,
            height: compact ? 64 : 84,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color.withValues(alpha: 0.15),
              border: Border.all(color: color, width: 2),
            ),
            child: Icon(
              leader == null ? LucideIcons.handshake : LucideIcons.trophy,
              size: compact ? 30 : 40,
              color: color,
            ),
          ),
          SizedBox(height: compact ? 8 : 12),
          Text(
            leader == null
                ? lang.t('تعادل!', 'Ta3adol!')
                : lang.t(
                    '${game.teamNames[leader!]} كسبوا!',
                    '${game.teamNames[leader!]} kesbo!',
                  ),
            textAlign: TextAlign.center,
            style: AppText.display(
              compact ? 32 : 38,
              height: 1.15,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            lang.t(
              '${lang.toAr(game.resolvedCount)} سؤال من ${lang.toAr(game.totalQuestions)}',
              '${game.resolvedCount} so2al men ${game.totalQuestions}',
            ),
            style: AppText.sans(
              14,
              color: AppColors.ivory.withValues(alpha: 0.6),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({required this.game, required this.team});

  final Game game;
  final int team;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final color = teamColors[team];
    final winner = game.leader == team;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        color: color.withValues(alpha: winner ? 0.2 : 0.08),
        border: Border.all(
          color: color.withValues(alpha: winner ? 0.9 : 0.35),
          width: winner ? 2 : 1,
        ),
      ),
      child: Column(
        children: [
          Text(
            game.teamNames[team],
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.sans(15, weight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: game.scores[team].toDouble()),
            duration: const Duration(milliseconds: 1200),
            curve: Curves.easeOutCubic,
            builder: (context, v, _) => Text(
              lang.toAr(v.round()),
              textDirection: TextDirection.ltr,
              style: AppText.num(36, color: color, height: 1.1),
            ),
          ),
          Text(
            lang.t('نقطة', 'no2ta'),
            style: AppText.sans(
              12,
              color: AppColors.ivory.withValues(alpha: 0.55),
            ),
          ),
        ],
      ),
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.game, required this.categoryId});

  final Game game;
  final String categoryId;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final category = allCategories.firstWhere((c) => c.id == categoryId);
    final totals = [0, 0];
    for (var r = 0; r < tilePoints.length; r++) {
      final result = game.results['$categoryId-$r'];
      if (result?.team != null) totals[result!.team!] += result.points;
    }
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.asset(
              BrandImages.category(categoryId),
              width: 40,
              height: 40,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              lang.t(category.name, category.nameEn),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.sans(15, weight: FontWeight.w600),
            ),
          ),
          for (var t = 0; t < 2; t++) ...[
            const SizedBox(width: 12),
            SizedBox(
              width: 64,
              child: Text(
                lang.toAr(totals[t]),
                textAlign: TextAlign.center,
                textDirection: TextDirection.ltr,
                style: AppText.num(16, color: teamColors[t]),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
