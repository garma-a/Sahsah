import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/category_cover.dart';
import '../../core/ui/motion.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/catalog.dart';
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

  /// The side panel (landscape), where the award's confirmation sits so
  /// it doesn't cover the tiles. One pack screen is open at a time.
  static final coverKey = GlobalKey(debugLabel: 'pack-cover');

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
    final category = context.catalog.byId(categoryId);
    final slot = game.categoryIds.indexOf(categoryId);
    // The pack keeps its board card's frame colour.
    final frame = coverBorders[toneOf(slot)];

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
      tv: true,
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
                              key: coverKey,
                              width: box.maxWidth * 0.3,
                              child: _PackCover(
                                categoryId: categoryId,
                                category: category,
                                frame: frame,
                                tone: slot,
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
                                categoryId: categoryId,
                                category: category,
                                frame: frame,
                                tone: slot,
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
    required this.categoryId,
    required this.category,
    required this.frame,
    required this.tone,
    required this.game,
  });

  final String categoryId;

  /// The catalogue's entry, for the cover and the blurb.
  final Category? category;
  final Color frame;
  final int tone;
  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final left = [
      for (var r = 0; r < tilePoints.length; r++) '$categoryId-$r',
    ].where((id) => !game.results.containsKey(id)).length;
    final accent = coverAccents[toneOf(tone)];
    final name = game.nameOf(categoryId);
    final about = category?.description;

    // The website's cover, big: the film still in its tone's frame, the
    // name lettered in Rakkas, then what the pack is and how many
    // questions are left.
    return Container(
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: frame, width: 5),
        boxShadow: [inkDrop(6)],
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          CategoryCover(
            image: coverOf(category),
            name: name,
            tone: tone,
            showName: false,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [Color(0xF2120A06), Color(0x00120A06)],
                stops: [0.3, 0.8],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Transform.rotate(
                  angle: -0.035,
                  child: Text(
                    name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    style: AppText.poster(30, color: AppColors.filmCream)
                        .copyWith(
                          shadows: [
                            const Shadow(
                              color: AppColors.soot,
                              offset: Offset(0, 1.5),
                            ),
                            Shadow(
                              color: accent.withValues(alpha: 0.6),
                              offset: const Offset(3, 3.5),
                            ),
                          ],
                        ),
                  ),
                ),
                const SizedBox(height: 6),
                // Gives up lines first when the panel is short.
                if (about != null)
                  Flexible(
                    child: Text(
                      about,
                      maxLines: 3,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.sans(
                        12,
                        color: AppColors.ivory.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.paper,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: AppColors.ink, width: 2),
                  ),
                  child: Text(
                    lang.t(
                      'باقي ${lang.toAr(left)} من ${lang.toAr(tilePoints.length)}',
                      'Ba2y $left men ${tilePoints.length}',
                    ),
                    style: AppText.sans(
                      12,
                      weight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
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
                    child: Rise(
                      delay: Rise.step(level * 2 + k, ms: 50),
                      child: _QuestionTile(
                        id: '$categoryId-${level * 2 + k}',
                        number: level * 2 + k + 1,
                        fill:
                            AppColors.categoryColors[toneOf(
                              game.categoryIds.indexOf(categoryId),
                            )],
                        game: game,
                        onPlay: onPlay,
                      ),
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
    required this.fill,
    required this.game,
    required this.onPlay,
  });

  /// The category's tile colour.
  final Color fill;
  final String id;

  /// 1–6 inside the pack, so two tiles worth the same can be told apart
  /// ("open number 3").
  final int number;
  final Game game;
  final ValueChanged<String> onPlay;

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
                color: AppColors.paper,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.ink, width: 2),
              ),
              child: Text(
                context.lang.toAr(number),
                style: AppText.num(13, color: AppColors.ink, height: 1),
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
    // Opened before and left undecided: its time and hints are kept.
    final started = game.opened.contains(id);
    final points = lang.toAr(q.points);

    if (result != null) {
      final team = result.team;
      final color = team == null ? null : teamColors[team];
      final ink = color == null ? AppColors.ink : AppColors.inkOn(color);
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
          // Played: the winner's colour with an ink edge, as on the
          // website's board; nobody's tiles fade on grey.
          decoration: BoxDecoration(
            color: color ?? AppColors.unclaimed,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: color == null
                  ? AppColors.ink.withValues(alpha: 0.35)
                  : AppColors.ink,
              width: 3,
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

    // Unplayed tiles take the category's colour, as on the website's
    // board; one already opened is cream, waiting to be finished.
    final face = started ? AppColors.paper : fill;
    final ink = AppColors.inkOn(face);
    return GameButton(
      semanticLabel: lang.t(
        'سؤال ${lang.toAr(number)}، $points نقطة${started ? '، مفتوح' : ''}',
        'So2al $number, ${q.points} no2ta${started ? ', maftoo7' : ''}',
      ),
      key: ValueKey('question-$id'),
      radius: 18,
      depth: 6,
      color: face,
      onTap: () => onPlay(id),
      child: _numbered(
        context,
        ink,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 36),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(points, style: AppText.num(34, color: ink, height: 1)),
                if (started) ...[
                  const SizedBox(width: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.sun,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: AppColors.ink, width: 2),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          LucideIcons600.circlePlay,
                          size: 14,
                          color: AppColors.ink,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          lang.t('كمّل', 'Kammel'),
                          style: AppText.sans(
                            12,
                            weight: FontWeight.w700,
                            color: AppColors.ink,
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
    );
  }
}
