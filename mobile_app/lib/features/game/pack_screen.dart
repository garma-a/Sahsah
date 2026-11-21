import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'board_screen.dart' show TeamScore;
import 'game_controller.dart';
import 'model/question.dart';
import 'question_screen.dart';
import 'ui/game_ui.dart';

/// One pack's six questions — 200, 400 and 600, two of each — opened from
/// the board. Picking one opens its question; when the pack is done the
/// host goes back to the board.
class PackScreen extends StatelessWidget {
  const PackScreen({super.key, required this.categoryId});

  final String categoryId;

  Future<void> _play(BuildContext context, String id) async {
    await playQuestion(context, id);
    if (!context.mounted) return;
    final game = context.game.game;
    final packDone = [
      for (var r = 0; r < tilePoints.length; r++) '$categoryId-$r',
    ].every((q) => game?.results.containsKey(q) ?? true);
    // Back to the board when the pack (or the whole game) is finished.
    if (game == null || game.finished || packDone) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final controller = context.game;
    final game = controller.game;
    if (game == null) return const GameScaffold(child: SizedBox());
    final category = allCategories.firstWhere((c) => c.id == categoryId);
    final slot = game.categoryIds.indexOf(categoryId);
    final frame =
        AppColors.categoryColors[slot % AppColors.categoryColors.length];

    final header = Row(
      children: [
        RoundIconButton(
          key: const ValueKey('pack-back'),
          icon: lang.ar ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
          label: lang.t('رجوع للوحة', 'Rogoo3 lel lo7a'),
          onTap: () => Navigator.of(context).pop(),
        ),
        const SizedBox(width: 10),
        // Whose pick it is, then what to do.
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: teamColors[game.turn],
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      lang.t(
                        'الدور على ${game.teamNames[game.turn]}',
                        'El door 3ala ${game.teamNames[game.turn]}',
                      ),
                      key: const ValueKey('pack-turn'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.sans(
                        13,
                        weight: FontWeight.w700,
                        color: AppColors.ivory.withValues(alpha: 0.85),
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
              Text(
                lang.t('اختاروا سؤال', 'Ekhtaro so2al'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(22, height: 1.2),
              ),
            ],
          ),
        ),
        SizedBox(
          width: 200,
          child: TeamScore(game: game, team: 0, compact: true),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 200,
          child: TeamScore(game: game, team: 1, compact: true),
        ),
      ],
    );

    final grid = _QuestionGrid(
      categoryId: categoryId,
      game: game,
      onPlay: (id) => _play(context, id),
    );

    return GameScaffold(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: LayoutBuilder(
          builder: (context, box) {
            final landscape = box.maxWidth > box.maxHeight * 1.1;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                header,
                const SizedBox(height: 12),
                Expanded(
                  child: landscape
                      ? Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(
                              width: box.maxWidth * 0.3,
                              child: _PackCover(
                                category: category,
                                frame: frame,
                                game: game,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(child: grid),
                          ],
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(
                              height: 150,
                              child: _PackCover(
                                category: category,
                                frame: frame,
                                game: game,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Expanded(child: grid),
                          ],
                        ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// The pack's photo with its name, what it's about and how many are left.
class _PackCover extends StatelessWidget {
  const _PackCover({
    required this.category,
    required this.frame,
    required this.game,
  });

  final Category category;
  final Color frame;
  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final left = [
      for (var r = 0; r < tilePoints.length; r++) '${category.id}-$r',
    ].where((id) => !game.results.containsKey(id)).length;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: frame, width: 4),
        boxShadow: [cssShadow(const Color(0x66000000), y: 12, blur: 28)],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              BrandImages.category(category.id),
              fit: BoxFit.cover,
              alignment: const Alignment(0, -0.3),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Color(0xF52B3230), Color(0x002B3230)],
                  stops: [0.3, 0.8],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lang.t(category.name, category.nameEn),
                    style: AppText.display(26, height: 1.2),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    lang.t(category.help, category.helpEn),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      12,
                      color: AppColors.ivory.withValues(alpha: 0.75),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: frame,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      lang.t(
                        'باقي ${lang.toAr(left)} من ${lang.toAr(tilePoints.length)}',
                        'Ba2y $left men ${tilePoints.length}',
                      ),
                      style: AppText.sans(
                        12,
                        weight: FontWeight.w700,
                        color: AppColors.inkOn(frame),
                      ),
                    ),
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

/// Three rows — 200, 400, 600 — with two questions each.
class _QuestionGrid extends StatelessWidget {
  const _QuestionGrid({
    required this.categoryId,
    required this.game,
    required this.onPlay,
  });

  final String categoryId;
  final Game game;
  final ValueChanged<String> onPlay;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var level = 0; level < 3; level++) ...[
          if (level > 0) const SizedBox(height: 12),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var k = 0; k < 2; k++) ...[
                  if (k > 0) const SizedBox(width: 12),
                  Expanded(
                    child: _QuestionTile(
                      id: '$categoryId-${level * 2 + k}',
                      number: level * 2 + k + 1,
                      game: game,
                      onPlay: onPlay,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _QuestionTile extends StatelessWidget {
  const _QuestionTile({
    required this.id,
    required this.number,
    required this.game,
    required this.onPlay,
  });

  final String id;

  /// 1–6 inside the pack, so two tiles worth the same can be told apart
  /// ("open number 3").
  final int number;
  final Game game;
  final ValueChanged<String> onPlay;

  /// What kind of question is behind the tile (no spoilers).
  static (IconData, String, String) _format(QuestionKind kind) =>
      switch (kind) {
        QuestionKind.acting => (LucideIcons.drama, 'مثّلها', 'Massel-ha'),
        QuestionKind.staged => (
          LucideIcons.zoomIn,
          'وضّح الصورة',
          'Wada7 el soora',
        ),
        QuestionKind.memory => (LucideIcons.brain, 'ركز معايا', 'Rakez m3aya'),
        QuestionKind.person ||
        QuestionKind.color ||
        QuestionKind.riddle => (LucideIcons.image, 'صورة', 'Soora'),
        QuestionKind.standard => (
          LucideIcons.messageCircleQuestionMark,
          'سؤال',
          'So2al',
        ),
      };

  /// The tile's number in a corner.
  Widget _numbered(BuildContext context, Color ink, Widget child) {
    return SizedBox.expand(
      child: Stack(
        children: [
          Positioned.fill(child: Center(child: child)),
          PositionedDirectional(
            top: 6,
            start: 10,
            child: Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: ink.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Text(
                context.lang.toAr(number),
                style: AppText.num(13, color: ink, height: 1),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final controller = context.game;
    final q = controller.question(id);
    final result = game.results[id];
    final started = game.progress[id] != null;
    final points = lang.toAr(q.points);

    if (result != null) {
      final team = result.team;
      final color = team == null ? null : teamColors[team];
      final ink = color == null ? AppColors.ivory : AppColors.inkOn(color);
      return Semantics(
        label: team == null
            ? lang.t('$points — محدش كسبه', '${q.points} — ma7adsh kasabo')
            : lang.t(
                '$points — كسبه ${game.teamNames[team]}',
                '${q.points} — kasabo ${game.teamNames[team]}',
              ),
        excludeSemantics: true,
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: color ?? Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: color == null
                  ? Colors.white.withValues(alpha: 0.1)
                  : AppColors.deep,
              width: 2,
            ),
          ),
          child: _numbered(
            context,
            ink.withValues(alpha: team == null ? 0.5 : 1),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  team == null ? LucideIcons.x : LucideIcons600.check,
                  size: 20,
                  color: ink.withValues(alpha: team == null ? 0.5 : 1),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    team == null
                        ? lang.t('محدش', 'Ma7adsh')
                        : game.teamNames[team],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(
                      16,
                      weight: FontWeight.w700,
                      color: ink.withValues(alpha: team == null ? 0.5 : 1),
                    ),
                  ),
                ),
                if (team != null) ...[
                  const SizedBox(width: 8),
                  Text(
                    '+${lang.toAr(result.points)}',
                    textDirection: TextDirection.ltr,
                    style: AppText.num(16, color: ink, height: 1),
                  ),
                ],
              ],
            ),
          ),
        ),
      );
    }

    final format = _format(q.kind);
    final face = started ? AppColors.gold : AppColors.cream;
    return Semantics(
      label: lang.t(
        'سؤال ${lang.toAr(number)}، $points نقطة، ${format.$2}${started ? '، مفتوح' : ''}',
        'So2al $number, ${q.points} no2ta, ${format.$3}${started ? ', maftoo7' : ''}',
      ),
      excludeSemantics: true,
      child: GameButton(
        key: ValueKey('question-$id'),
        radius: 18,
        depth: 6,
        color: face,
        onTap: () => onPlay(id),
        child: _numbered(
          context,
          AppColors.deep,
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 36),
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    points,
                    style: AppText.num(34, color: AppColors.deep, height: 1),
                  ),
                  ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.deep.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            started ? LucideIcons600.circlePlay : format.$1,
                            size: 14,
                            color: AppColors.deep,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            started
                                ? lang.t('كمّل', 'Kammel')
                                : lang.t(format.$2, format.$3),
                            style: AppText.sans(
                              12,
                              weight: FontWeight.w700,
                              color: AppColors.deep,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
