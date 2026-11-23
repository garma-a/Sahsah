import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/audio/sound.dart';
import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart' show Logo;
import '../../core/ui/play_button.dart';
import '../../core/ui/surfaces.dart';
import '../../data/catalog.dart';
import 'game_controller.dart';
import 'setup_screen.dart';
import 'ui/game_ui.dart';
import '../../core/ui/motion.dart';
import '../../core/ui/cover_image.dart';

/// Final scores, locked on the server. Leaving closes the room.
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
    context.sound.play(Sfx.win);
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
          flex: 2,
          child: GlassButton(
            height: 56,
            icon: LucideIcons.house,
            label: lang.t('الرئيسية', 'El Re2eseya'),
            onTap: _home,
          ),
        ),
        // Only the host starts the next game.
        if (!context.game.isGuest) ...[
          const SizedBox(width: 10),
          Expanded(
            flex: 3,
            child: PlayButton(
              height: 56,
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
    // The breakdown is a printed card, like the website's result sheet.
    final breakdown = Paper(
      radius: 20,
      drop: 5,
      child: Column(
        children: [
          // Column labels: which team each points column belongs to.
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
            child: Row(
              children: [
                const Spacer(),
                for (var t = 0; t < 2; t++) ...[
                  const SizedBox(width: _CategoryRow.gap),
                  SizedBox(
                    width: _CategoryRow.slot,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: teamColors[t],
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.ink, width: 2),
                      ),
                      child: Text(
                        game.teamNames[t],
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.sans(
                          14,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          for (final (i, id) in game.categoryIds.indexed) ...[
            if (i > 0)
              Divider(height: 1, color: AppColors.ink.withValues(alpha: 0.12)),
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

    final screen = landscape
        ? GameScaffold(
            tv: true,
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
            tv: true,
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
          );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _home();
      },
      child: Stack(
        children: [
          Positioned.fill(child: screen),
          // A winner gets a burst of confetti; a tie doesn't.
          if (leader != null) const Positioned.fill(child: _Confetti()),
        ],
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
      duration: motionFor(context, const Duration(milliseconds: 600)),
      curve: Curves.elasticOut,
      builder: (context, v, child) => Transform.scale(scale: v, child: child),
      child: Column(
        children: [
          if (!compact) ...[const Logo(size: 56), const SizedBox(height: 14)],
          Container(
            width: compact ? 64 : 84,
            height: compact ? 64 : 84,
            // A sticker in the winner's colour (yellow on a tie).
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: leader == null ? AppColors.sun : color,
              border: Border.all(color: AppColors.ink, width: 3),
              boxShadow: [inkDrop(4)],
            ),
            child: Icon(
              leader == null ? LucideIcons.handshake : LucideIcons.trophy,
              size: compact ? 30 : 40,
              color: AppColors.ink,
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
              // A lone Arabic zero is a dot, so none is said in words.
              game.resolvedCount == 0
                  ? 'ولا سؤال من ${lang.toAr(game.totalQuestions)}'
                  : '${lang.toAr(game.resolvedCount)} سؤال من ${lang.toAr(game.totalQuestions)}',
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
    // The website's score card: cream, the name on a ribbon of the team's
    // colour, a big ink score. The winner's card is the night's poster:
    // printed in their colour, stuck on crooked, with a crown sticker.
    final card = Container(
      padding: const EdgeInsets.all(12),
      decoration: paperDecoration(
        radius: BorderRadius.circular(20),
        color: winner ? color : AppColors.paper,
        drop: winner ? 7 : 3,
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 1),
            decoration: BoxDecoration(
              // On their own colour, the winner's name goes on ink.
              color: winner ? AppColors.ink : color,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              game.teamNames[team],
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(
                18,
                height: 1.3,
                color: winner ? color : AppColors.ink,
              ),
            ),
          ),
          const SizedBox(height: 6),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: game.scores[team].toDouble()),
            duration: motionFor(context, const Duration(milliseconds: 1200)),
            curve: Curves.easeOutCubic,
            // An Arabic zero is a dot, so zero is written out, as on the
            // board.
            builder: (context, v, _) => Text(
              v.round() == 0 && lang.ar ? 'صفر' : lang.toAr(v.round()),
              textDirection: TextDirection.ltr,
              style: AppText.num(36, color: AppColors.ink, height: 1.1),
            ),
          ),
          Text(
            lang.t('نقطة', 'no2ta'),
            style: AppText.sans(
              12,
              weight: winner ? FontWeight.w700 : FontWeight.w400,
              color: winner ? AppColors.ink : AppColors.inkMuted,
            ),
          ),
        ],
      ),
    );
    if (!winner) return card;
    return Transform.rotate(
      angle: -2 * math.pi / 180,
      child: Stack(
        // The row's width passes straight to the card, as for the other.
        fit: StackFit.passthrough,
        clipBehavior: Clip.none,
        children: [
          card,
          PositionedDirectional(
            top: -14,
            start: -10,
            child: Pop(
              trigger: true,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.sun,
                  border: Border.all(color: AppColors.ink, width: 3),
                  boxShadow: [inkDrop(3)],
                ),
                child: const Icon(
                  LucideIcons600.crown,
                  size: 18,
                  color: AppColors.ink,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// One burst of paper confetti in the brand's colours, falling once when
/// the result comes in. Nothing with the system's animations off.
class _Confetti extends StatefulWidget {
  const _Confetti();

  @override
  State<_Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<_Confetti>
    with SingleTickerProviderStateMixin {
  late final _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2800),
  );
  final _pieces = List.generate(70, (i) => _Piece(math.Random(i * 7919)));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_c.isAnimating &&
        _c.value == 0 &&
        !MediaQuery.disableAnimationsOf(context)) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return const SizedBox();
    return IgnorePointer(
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: CustomPaint(
            size: Size.infinite,
            painter: _ConfettiPainter(_c, _pieces),
          ),
        ),
      ),
    );
  }
}

class _Piece {
  _Piece(math.Random r)
    : x = r.nextDouble(),
      delay = r.nextDouble() * 0.25,
      drift = (r.nextDouble() - 0.5) * 0.25,
      fall = 0.75 + r.nextDouble() * 0.5,
      spin = (r.nextDouble() - 0.5) * 18,
      size = 6 + r.nextDouble() * 6,
      color = const [
        AppColors.press,
        AppColors.cyan,
        AppColors.sun,
        AppColors.green,
        AppColors.pinkPress,
        AppColors.logoBlue,
      ][r.nextInt(6)];

  final double x, delay, drift, fall, spin, size;
  final Color color;
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.t, this.pieces) : super(repaint: t);

  final Animation<double> t;
  final List<_Piece> pieces;

  @override
  void paint(Canvas canvas, Size size) {
    if (t.value == 0 || t.value == 1) return;
    final paint = Paint();
    for (final p in pieces) {
      final local = ((t.value - p.delay) / (1 - p.delay)).clamp(0.0, 1.0);
      if (local == 0) continue;
      // Falls from above the top with a little sway, fading at the end.
      final y = -0.1 + local * local * p.fall * 1.3;
      final x = p.x + p.drift * local + math.sin(local * 9 + p.x * 6) * 0.02;
      paint.color = p.color.withValues(
        alpha: 1 - ((local - 0.8) / 0.2).clamp(0.0, 1.0),
      );
      canvas
        ..save()
        ..translate(x * size.width, y * size.height)
        ..rotate(p.spin * local)
        ..drawRect(
          Rect.fromCenter(
            center: Offset.zero,
            width: p.size,
            height: p.size * 0.6,
          ),
          paint,
        )
        ..restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => false;
}

/// One category's points per team. Each team's number sits in a slot of
/// its colour, under its name: solid for the team that took the category,
/// a tint for the other, a plain dash where a team scored nothing.
class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.game, required this.categoryId});

  static const slot = 68.0;
  static const gap = 8.0;

  final Game game;
  final String categoryId;

  @override
  Widget build(BuildContext context) {
    final totals = game.categoryPoints(categoryId);
    final cover = coverOf(context.catalog.byId(categoryId));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 40,
              height: 40,
              child: cover == null
                  ? const ColoredBox(color: AppColors.card)
                  : CoverPicture(
                      cover,
                      errorBuilder: (_, _, _) =>
                          const ColoredBox(color: AppColors.card),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              game.nameOf(categoryId),
              // Two lines before an ellipsis: the slots leave the name
              // less room than one line of "مين في الصورة؟".
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.sans(16, weight: FontWeight.w600, height: 1.25),
            ),
          ),
          for (var t = 0; t < 2; t++) ...[
            const SizedBox(width: gap),
            SizedBox(
              width: slot,
              child: _Slot(
                points: totals[t],
                color: teamColors[t],
                took: totals[t] > totals[1 - t],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({required this.points, required this.color, required this.took});

  final int points;
  final Color color;
  final bool took;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    // No points reads as a dash, not a lone dot or an empty box.
    if (points == 0) {
      return Text(
        '–',
        textAlign: TextAlign.center,
        style: AppText.num(22, color: AppColors.inkMuted),
      );
    }
    return Container(
      constraints: const BoxConstraints(minHeight: 40),
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: took ? color : color.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink, width: took ? 2.5 : 1.5),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          lang.toAr(points),
          textDirection: TextDirection.ltr,
          style: AppText.num(24, color: AppColors.ink),
        ),
      ),
    );
  }
}
