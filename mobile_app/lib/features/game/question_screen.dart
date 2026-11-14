import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'board_screen.dart' show TeamScore;
import 'game_controller.dart';
import 'model/question.dart';
import 'ui/fit_text.dart';
import 'ui/game_ui.dart';
import 'ui/photo_viewer.dart';

/// Arabic "for [team]": ل + ال joins as لل (للفراعنة), otherwise لـ.
String _forTeam(String name) =>
    name.startsWith('ال') ? 'لل${name.substring(2)}' : 'لـ$name';

/// Opens question [id] and waits until the host leaves it. Leaving without
/// a decision keeps its time, stage and reveal for later (Q54).
Future<void> playQuestion(BuildContext context, String id) async {
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
  if (game.game?.activeId == id) game.leave();
}

/// One question, laid out like the user-journey templates:
/// 6A normal question with a timer, 6B acting (QR), 6C points question
/// (a picture that gets clearer), then 7A answer and award.
class QuestionScreen extends StatefulWidget {
  const QuestionScreen({super.key, required this.questionId});

  final String questionId;

  @override
  State<QuestionScreen> createState() => _QuestionScreenState();
}

class _QuestionScreenState extends State<QuestionScreen> {
  Timer? _tick;
  int _lastSecond = -1;

  /// After the reveal, the host can look at the question again (7A).
  bool _showQuestion = false;

  @override
  void initState() {
    super.initState();
    // Repaint the countdown; the controller holds the real deadline.
    _tick = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!mounted) return;
      final game = context.game;
      final p = game.progressOf(widget.questionId);
      final secs = (game.remainingMs(p) / 1000).ceil();
      if (secs != _lastSecond) {
        if (game.timerStatus(p) == TimerStatus.running &&
            (secs == 10 || secs == 0)) {
          HapticFeedback.heavyImpact();
        }
        _lastSecond = secs;
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  /// Back (button or gesture): the question can't be left open, so the
  /// host decides who took the points — or keeps playing.
  Future<void> _leave() async {
    final game = context.game;
    final id = widget.questionId;
    final choice = await showDialog<int>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.6),
      builder: (_) => _LeaveDialog(
        question: game.question(id),
        teamNames: game.game!.teamNames,
        points: game.availablePoints(id),
      ),
    );
    if (!mounted || choice == null) return;
    _award(choice == _LeaveDialog.nobody ? null : choice);
  }

  void _award(int? team) {
    final game = context.game;
    final lang = context.lang;
    final points = game.availablePoints(widget.questionId);
    HapticFeedback.mediumImpact();
    game.award(widget.questionId, team);
    final names = game.game!.teamNames;
    final message = team == null
        ? lang.t('محدش كسب السؤال ده', 'Ma7adsh kesb el so2al da')
        : lang.t(
            '✓ ${lang.toAr(points)} نقطة محسومة ${_forTeam(names[team])}',
            '✓ $points no2ta ma7sooma le ${names[team]}',
          );
    final messenger = ScaffoldMessenger.of(context);
    Navigator.of(context).pop();
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
          backgroundColor: team == null ? AppColors.ui : teamColors[team],
          content: Text(
            message,
            style: AppText.sans(
              15,
              weight: FontWeight.w700,
              color: team == null
                  ? AppColors.ivory
                  : AppColors.inkOn(teamColors[team]),
            ),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.game;
    final game = controller.game;
    if (game == null || game.results.containsKey(widget.questionId)) {
      return const GameScaffold(child: SizedBox());
    }
    final lang = context.lang;
    final id = widget.questionId;
    final q = controller.question(id);
    final p = controller.progressOf(id);
    final category = allCategories.firstWhere((c) => c.id == q.categoryId);
    final points = controller.availablePoints(id);

    final Widget content = p.revealed && !_showQuestion
        ? _AnswerView(
            question: q,
            progress: p,
            game: game,
            points: points,
            onAward: _award,
            onBackToQuestion: () => setState(() => _showQuestion = true),
          )
        : _QuestionView(
            question: q,
            progress: p,
            questionId: id,
            onBackToAnswer: p.revealed
                ? () => setState(() => _showQuestion = false)
                : null,
            onBack: _leave,
          );

    final card = _QuestionCard(
      badge: lang.t(
        '${category.name} · ${lang.toAr(points)} نقطة',
        '${category.nameEn} · $points no2ta',
      ),
      child: content,
    );

    // The back gesture can't leave an open question; it explains why.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: GameScaffold(
        child: Stack(
          children: [
            Positioned.fill(
              child: LayoutBuilder(
                builder: (context, box) {
                  final landscape = box.maxWidth > box.maxHeight * 1.1;
                  if (landscape) {
                    return Padding(
                      padding: const EdgeInsets.fromLTRB(12, 18, 12, 12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(width: 190, child: _TeamsColumn(game: game)),
                          const SizedBox(width: 14),
                          Expanded(child: card),
                        ],
                      ),
                    );
                  }
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TeamScore(
                                game: game,
                                team: 0,
                                compact: true,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TeamScore(
                                game: game,
                                team: 1,
                                compact: true,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),
                        Expanded(child: card),
                      ],
                    ),
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

/// Team names and scores down the side (tap one to correct it).
class _TeamsColumn extends StatelessWidget {
  const _TeamsColumn({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TeamScore(game: game, team: 0),
        const SizedBox(height: 10),
        TeamScore(game: game, team: 1),
        const Spacer(),
        Text(
          lang.t(
            '${lang.toAr(game.resolvedCount)} من ${lang.toAr(game.totalQuestions)} سؤال',
            '${game.resolvedCount} men ${game.totalQuestions} so2al',
          ),
          textAlign: TextAlign.center,
          style: AppText.sans(
            12,
            color: AppColors.ivory.withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }
}

/// The main card with the "category · points" badge on its top edge.
class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.badge, required this.child});

  final String badge;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 14),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.45),
                width: 2,
              ),
            ),
            child: child,
          ),
        ),
        Positioned(
          top: -14,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.play,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.deep, width: 2),
              ),
              child: Text(
                badge,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.sans(
                  15,
                  weight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---- Question (6A / 6B / 6C) -----------------------------------------------

class _QuestionView extends StatelessWidget {
  const _QuestionView({
    required this.question,
    required this.progress,
    required this.questionId,
    this.onBackToAnswer,
    required this.onBack,
  });

  final Question question;
  final QuestionProgress progress;
  final String questionId;

  /// Set when the answer is already revealed (7A "back to the question").
  final VoidCallback? onBackToAnswer;

  /// Leave the question: asks who took the points first.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final q = question;
    final p = progress;
    final status = game.timerStatus(p);
    final memoryWaiting = q.kind == QuestionKind.memory && !p.memoryAsked;
    // 6B: before Ready the screen shows the rules; the timer waits.
    final actingRules =
        q.kind == QuestionKind.acting &&
        status == TimerStatus.ready &&
        !p.revealed;
    final canClarify =
        q.kind == QuestionKind.staged &&
        !p.revealed &&
        p.stage < q.pointStages.length - 1;

    final prompt = FitText(
      memoryWaiting
          ? lang.t(
              'ركّزوا في الصورة… السؤال جاي بعد ما تختفي',
              'Rakkezo fel soora… el so2al gay ba3d ma tekhtefy',
            )
          : lang.t(q.prompt, q.promptEn),
      max: 38,
      min: 16,
      textAlign: TextAlign.center,
      style: (size) => AppText.display(
        size,
        height: 1.35,
        color: AppColors.ivory.withValues(alpha: memoryWaiting ? 0.6 : 1),
      ),
    );

    final Widget body = switch (q.kind) {
      QuestionKind.acting =>
        actingRules ? const _ActingRules() : _ActingLive(prompt: prompt),
      QuestionKind.staged => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 150,
            child: _StageLadder(stages: q.pointStages, stage: p.stage),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: 60, child: Center(child: prompt)),
                const SizedBox(height: 8),
                Expanded(
                  child: _Photo(
                    question: q,
                    asset: q.stages[math.min(p.stage, q.stages.length - 1)],
                    revealed: false,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      QuestionKind.memory => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: Center(child: prompt)),
          const SizedBox(width: 14),
          Expanded(
            child: _MemoryMedia(
              question: q,
              progress: p,
              questionId: questionId,
            ),
          ),
        ],
      ),
      _ when q.image != null => Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: Center(child: prompt)),
          const SizedBox(width: 14),
          Expanded(
            child: _Photo(question: q, asset: q.image!, revealed: p.revealed),
          ),
        ],
      ),
      _ => Center(child: prompt),
    };

    final disabled = memoryWaiting || actingRules;
    final back = SizedBox(
      width: 150,
      child: GlassButton(
        height: 50,
        icon: lang.ar ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
        label: lang.t('رجوع', 'Rogoo3'),
        onTap: onBack,
      ),
    );

    final Widget primary;
    if (onBackToAnswer != null) {
      primary = _GreenButton(
        icon: LucideIcons600.eye,
        label: lang.t('رجوع للإجابة', 'Rogoo3 lel egaba'),
        onTap: onBackToAnswer!,
      );
    } else if (actingRules) {
      primary = _GreenButton(
        icon: LucideIcons600.play,
        label: lang.t('جاهز', 'Gahez'),
        onTap: () => game.toggleTimer(questionId),
      );
    } else {
      primary = _GreenButton(
        icon: LucideIcons600.eye,
        label: lang.t('إظهار الإجابة', 'Ezhar el egaba'),
        onTap: memoryWaiting ? null : () => game.reveal(questionId),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: _TimerBar(
            questionId: questionId,
            disabled: disabled || p.revealed,
          ),
        ),
        const SizedBox(height: 10),
        Expanded(child: body),
        const SizedBox(height: 12),
        Row(
          children: [
            back,
            const Spacer(),
            if (canClarify) ...[
              SizedBox(
                width: 200,
                child: GoldButton(
                  height: 50,
                  icon: LucideIcons600.zoomIn,
                  label: lang.t('وضّح الصورة', 'Wada7 el soora'),
                  onTap: () => game.advanceStage(questionId),
                ),
              ),
              const SizedBox(width: 12),
            ],
            SizedBox(width: 240, child: primary),
          ],
        ),
      ],
    );
  }
}

class _GreenButton extends StatelessWidget {
  const _GreenButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GameButton(
      height: 50,
      radius: 16,
      depth: 5,
      color: AppColors.green,
      borderColor: AppColors.deep,
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 19, color: Colors.white),
          const SizedBox(width: 8),
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                label,
                maxLines: 1,
                style: AppText.sans(
                  17,
                  weight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Dark pill: pause/continue, the time left, reset (template 6A).
class _TimerBar extends StatelessWidget {
  const _TimerBar({required this.questionId, required this.disabled});

  final String questionId;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final p = game.progressOf(questionId);
    final status = game.timerStatus(p);
    final running = status == TimerStatus.running;
    final ms = game.remainingMs(p);
    final secs = (ms / 1000).ceil();
    final low = running && secs <= 10;
    final elapsed = status == TimerStatus.elapsed;
    final time =
        '${(secs ~/ 60).toString().padLeft(2, '0')}:${(secs % 60).toString().padLeft(2, '0')}';

    Widget round(IconData icon, String label, VoidCallback onTap) => Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: disabled ? null : onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: const BoxDecoration(
            color: AppColors.ivory,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 17, color: AppColors.deep),
        ),
      ),
    );

    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: low || elapsed ? AppColors.play : AppColors.deep,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.ivory.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            round(
              running ? LucideIcons600.pause : LucideIcons600.play,
              running ? lang.t('وقّف', 'Wa22af') : lang.t('كمّل', 'Kammel'),
              () => game.toggleTimer(questionId),
            ),
            const SizedBox(width: 12),
            Semantics(
              label: elapsed
                  ? lang.t('خلص الوقت', 'El wa2t kheles')
                  : lang.t('$secs ثانية', '$secs sanya'),
              excludeSemantics: true,
              child: SizedBox(
                width: 84,
                child: elapsed
                    ? Text(
                        lang.t('خلص الوقت', 'Kheles'),
                        textAlign: TextAlign.center,
                        style: AppText.sans(
                          15,
                          weight: FontWeight.w700,
                          color: Colors.white,
                          height: 1,
                        ),
                      )
                    : Text(
                        lang.toAr(time),
                        textDirection: TextDirection.ltr,
                        textAlign: TextAlign.center,
                        style: AppText.num(24, color: Colors.white, height: 1),
                      ),
              ),
            ),
            const SizedBox(width: 12),
            round(
              LucideIcons.rotateCcw,
              lang.t('إعادة الوقت', 'E3adet el wa2t'),
              () => game.resetTimer(questionId),
            ),
          ],
        ),
      ),
    );
  }
}

// ---- 6B acting -------------------------------------------------------------

/// Before Ready: the rules and a QR code per team (template 6B). Scanning
/// needs game rooms in the backend, so the codes are placeholders for now.
class _ActingRules extends StatelessWidget {
  const _ActingRules();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final rules = [
      lang.t(
        'الممثل يمسح الكود من موبايله',
        'El momasel yemsa7 el code men mobailo',
      ),
      lang.t(
        'الكلمة بتظهر على موبايله هو بس',
        'El kelma btezhar 3ala mobailo howa bas',
      ),
      lang.t('اضغطوا جاهز والوقت يبدأ', 'Edghato gahez wel wa2t yebda2'),
    ];
    return Column(
      children: [
        Text(
          lang.t(
            'اقروا القوانين صح… وبعدها اضغطوا جاهز',
            'E2ro el 2awaneen sa7… w ba3daha edghato gahez',
          ),
          textAlign: TextAlign.center,
          style: AppText.display(24, height: 1.3),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _QrBox(team: 0),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final (i, rule) in rules.indexed) ...[
                      if (i > 0) const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 26,
                              height: 26,
                              alignment: Alignment.center,
                              decoration: const BoxDecoration(
                                color: AppColors.orange,
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                lang.toAr(i + 1),
                                style: AppText.num(
                                  13,
                                  color: Colors.white,
                                  height: 1,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                rule,
                                style: AppText.sans(
                                  14,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 14),
              const _QrBox(team: 1),
            ],
          ),
        ),
      ],
    );
  }
}

class _QrBox extends StatelessWidget {
  const _QrBox({required this.team});

  final int team;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final name = context.game.game!.teamNames[team];
    return Semantics(
      label: lang.t(
        'كود $name، المسح جاي مع غرف اللعب',
        'Code $name, el mas7 gay ma3 ghoraf el le3b',
      ),
      excludeSemantics: true,
      child: Container(
        width: 150,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          children: [
            Expanded(
              child: AspectRatio(
                aspectRatio: 1,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Opacity(
                        opacity: 0.35,
                        child: CustomPaint(painter: _QrPainter(seed: team)),
                      ),
                    ),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.deep,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          lang.t('قريبًا', 'Orayeb'),
                          style: AppText.sans(
                            12,
                            weight: FontWeight.w700,
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
              decoration: BoxDecoration(
                color: teamColors[team],
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.sans(
                  12,
                  weight: FontWeight.w700,
                  color: AppColors.inkOn(teamColors[team]),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A QR-like pattern used as a placeholder (it encodes nothing).
class _QrPainter extends CustomPainter {
  const _QrPainter({required this.seed});

  final int seed;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;
    const n = 21;
    final cell = size.shortestSide / n;
    final paint = Paint()..color = AppColors.deep;
    final random = math.Random(seed + 11);
    bool finder(int x, int y) =>
        (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (finder(x, y)) continue;
        if (random.nextBool()) {
          canvas.drawRect(Rect.fromLTWH(x * cell, y * cell, cell, cell), paint);
        }
      }
    }
    for (final (fx, fy) in [(0, 0), (n - 7, 0), (0, n - 7)]) {
      final outer = Rect.fromLTWH(fx * cell, fy * cell, cell * 7, cell * 7);
      canvas.drawRect(outer, paint);
      canvas.drawRect(outer.deflate(cell), Paint()..color = Colors.white);
      canvas.drawRect(outer.deflate(cell * 2), paint);
    }
  }

  @override
  bool shouldRepaint(_QrPainter old) => old.seed != seed;
}

/// After Ready: what kind of thing is being acted, not the answer.
class _ActingLive extends StatelessWidget {
  const _ActingLive({required this.prompt});

  final Widget prompt;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const Icon(LucideIcons.drama, size: 54, color: AppColors.gold),
        const SizedBox(height: 10),
        Flexible(child: prompt),
        const SizedBox(height: 10),
        Text(
          lang.t(
            'من غير ولا كلمة… والباقي يخمّن',
            'Men gher wala kelma… wel ba2y ykhammen',
          ),
          style: AppText.sans(
            15,
            color: AppColors.ivory.withValues(alpha: 0.7),
          ),
        ),
      ],
    );
  }
}

// ---- 6C staged -------------------------------------------------------------

/// Points ladder: done stages fade, the current one glows, later ones are
/// locked (template 6C).
class _StageLadder extends StatelessWidget {
  const _StageLadder({required this.stages, required this.stage});

  final List<int> stages;
  final int stage;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (final (i, points) in stages.indexed) ...[
          if (i > 0) const SizedBox(height: 8),
          Semantics(
            label: lang.t(
              'الصورة ${i + 1}: $points نقطة',
              'El soora ${i + 1}: $points no2ta',
            ),
            selected: i == stage,
            excludeSemantics: true,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: i == stage
                    ? AppColors.gold
                    : Colors.white.withValues(alpha: i < stage ? 0.04 : 0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: i == stage ? AppColors.deep : Colors.transparent,
                  width: 2,
                ),
              ),
              child: Row(
                children: [
                  Text(
                    lang.toAr(points),
                    style:
                        AppText.num(
                          22,
                          height: 1,
                          color: i == stage
                              ? AppColors.deep
                              : AppColors.ivory.withValues(
                                  alpha: i < stage ? 0.35 : 0.8,
                                ),
                        ).copyWith(
                          decoration: i < stage
                              ? TextDecoration.lineThrough
                              : null,
                        ),
                  ),
                  const Spacer(),
                  Icon(
                    i < stage
                        ? LucideIcons.check
                        : i == stage
                        ? LucideIcons600.eye
                        : LucideIcons.lock,
                    size: 17,
                    color: i == stage
                        ? AppColors.deep
                        : AppColors.ivory.withValues(alpha: 0.5),
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}

// ---- 7A answer ---------------------------------------------------------------

class _AnswerView extends StatelessWidget {
  const _AnswerView({
    required this.question,
    required this.progress,
    required this.game,
    required this.points,
    required this.onAward,
    required this.onBackToQuestion,
  });

  final Question question;
  final QuestionProgress progress;
  final Game game;
  final int points;
  final ValueChanged<int?> onAward;
  final VoidCallback onBackToQuestion;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final q = question;
    final asset = q.kind == QuestionKind.staged ? q.answerImage : q.image;

    final answer = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          lang.t('الإجابة الصحيحة', 'El egaba el sa7ee7a'),
          textAlign: TextAlign.center,
          style: AppText.sans(
            14,
            weight: FontWeight.w700,
            color: AppColors.gold,
          ),
        ),
        const SizedBox(height: 4),
        Flexible(
          child: FitText(
            lang.t(q.answer, q.answerEn),
            max: 40,
            min: 18,
            textAlign: TextAlign.center,
            style: (size) => AppText.display(size, height: 1.25),
          ),
        ),
        if (q.color != null) ...[
          const SizedBox(height: 8),
          Center(
            child: Semantics(
              label: lang.t('اللون الأصلي', 'El loon el asly'),
              child: Container(
                width: 64,
                height: 36,
                decoration: BoxDecoration(
                  color: q.color,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.ivory, width: 2),
                ),
              ),
            ),
          ),
        ],
      ],
    );

    Widget teamButton(int team) => GameButton(
      height: 52,
      radius: 16,
      depth: 5,
      color: teamColors[team],
      borderColor: AppColors.deep,
      onTap: () => onAward(team),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10),
        child: Row(
          children: [
            Expanded(
              child: Text(
                game.teamNames[team],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.sans(
                  16,
                  weight: FontWeight.w700,
                  color: AppColors.inkOn(teamColors[team]),
                ),
              ),
            ),
            Text(
              '+${lang.toAr(points)}',
              textDirection: TextDirection.ltr,
              style: AppText.num(17, color: AppColors.inkOn(teamColors[team])),
            ),
          ],
        ),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: asset == null
              ? answer
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: answer),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _Photo(question: q, asset: asset, revealed: true),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 10),
        Text(
          lang.t('مين جاوب صح؟', 'Meen gaweb sa7?'),
          textAlign: TextAlign.center,
          style: AppText.display(22, height: 1.2),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: teamButton(0)),
            const SizedBox(width: 10),
            Expanded(child: teamButton(1)),
            const SizedBox(width: 10),
            SizedBox(
              width: 120,
              child: GlassButton(
                height: 52,
                icon: LucideIcons.x,
                label: lang.t('ولا حد', 'Wala 7ad'),
                onTap: () => onAward(null),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Center(
          child: TextButton.icon(
            onPressed: onBackToQuestion,
            icon: const Icon(
              LucideIcons.undo2,
              size: 16,
              color: AppColors.gold,
            ),
            label: Text(
              lang.t('ارجع للسؤال', 'Erga3 lel so2al'),
              style: AppText.sans(
                14,
                weight: FontWeight.w700,
                color: AppColors.gold,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---- Pictures --------------------------------------------------------------

/// The question picture in a polaroid frame. Tap to open it full screen
/// and zoom; the crop and grayscale stay on until the reveal.
class _Photo extends StatelessWidget {
  const _Photo({
    required this.question,
    required this.asset,
    required this.revealed,
  });

  final Question question;
  final String asset;
  final bool revealed;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    Widget picture({required bool full}) => _Picture(
      question: question,
      asset: asset,
      revealed: revealed,
      fit: full ? BoxFit.contain : null,
    );
    return Semantics(
      button: true,
      label: lang.t('كبّر الصورة', 'Kabbar el soora'),
      child: GestureDetector(
        onTap: () => showPhotoViewer(context, (_) => picture(full: true)),
        child: _Polaroid(
          child: Stack(
            fit: StackFit.expand,
            children: [
              picture(full: false),
              PositionedDirectional(
                bottom: 8,
                end: 8,
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    LucideIcons.maximize2,
                    size: 17,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Polaroid extends StatelessWidget {
  const _Polaroid({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    // Cream frame with a deeper bottom edge, turned a little.
    return Transform.rotate(
      angle: -0.015,
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(6),
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.ivory, AppColors.cream],
          ),
          boxShadow: [cssShadow(const Color(0x80000000), y: 12, blur: 26)],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(3),
          child: ColoredBox(color: AppColors.deep, child: child),
        ),
      ),
    );
  }
}

/// The picture with person crop / grayscale applied until the reveal.
class _Picture extends StatelessWidget {
  const _Picture({
    required this.question,
    required this.asset,
    required this.revealed,
    this.fit,
  });

  final Question question;
  final String asset;
  final bool revealed;

  /// Full screen shows the whole picture; the frame fills its box.
  final BoxFit? fit;

  // Visible strip per crop, as (top, right, bottom, left) insets — the
  // prototype's `clip-path: inset(...)`.
  static const _insets = {
    PersonCrop.eyes: (0.27, 0.12, 0.48, 0.12),
    PersonCrop.center: (0.27, 0.18, 0.38, 0.18),
    PersonCrop.lower: (0.42, 0.15, 0.27, 0.15),
  };

  @override
  Widget build(BuildContext context) {
    final q = question;
    if (q.kind == QuestionKind.standard || q.kind == QuestionKind.staged) {
      return Image.asset(
        asset,
        fit:
            fit ??
            (q.kind == QuestionKind.staged ? BoxFit.contain : BoxFit.cover),
        alignment: q.imageAlignment,
        width: double.infinity,
        height: double.infinity,
      );
    }
    final crop = q.kind == QuestionKind.person && !revealed
        ? _insets[q.crop ?? PersonCrop.eyes]!
        : (0.0, 0.0, 0.0, 0.0);
    final gray = q.kind == QuestionKind.color && !revealed;

    return TweenAnimationBuilder<double>(
      tween: Tween(end: gray ? 0 : 1),
      duration: const Duration(milliseconds: 700),
      curve: easeBrand,
      builder: (context, saturation, child) =>
          ColorFiltered(colorFilter: _saturation(saturation), child: child),
      child: Center(
        child: AspectRatio(
          aspectRatio: 4 / 3,
          child: _AnimatedInsetClip(
            insets: crop,
            child: Image.asset(asset, fit: BoxFit.contain),
          ),
        ),
      ),
    );
  }

  /// Luminance-preserving saturation matrix (0 = grayscale).
  static ColorFilter _saturation(double s) {
    const r = 0.2126, g = 0.7152, b = 0.0722;
    final i = 1 - s;
    return ColorFilter.matrix([
      r * i + s, g * i, b * i, 0, 0, //
      r * i, g * i + s, b * i, 0, 0, //
      r * i, g * i, b * i + s, 0, 0, //
      0, 0, 0, 1, 0, //
    ]);
  }
}

class _AnimatedInsetClip extends StatelessWidget {
  const _AnimatedInsetClip({required this.insets, required this.child});

  final (double, double, double, double) insets;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final (t, r, b, l) = insets;
    return TweenAnimationBuilder<EdgeInsets>(
      tween: EdgeInsetsTween(end: EdgeInsets.fromLTRB(l, t, r, b)),
      duration: const Duration(milliseconds: 700),
      curve: easeBrand,
      builder: (context, e, child) =>
          ClipRect(clipper: _InsetClipper(e), child: child),
      child: child,
    );
  }
}

class _InsetClipper extends CustomClipper<Rect> {
  _InsetClipper(this.f);

  /// Fractions of the box.
  final EdgeInsets f;

  @override
  Rect getClip(Size s) => Rect.fromLTRB(
    s.width * f.left,
    s.height * f.top,
    s.width * (1 - f.right),
    s.height * (1 - f.bottom),
  );

  @override
  bool shouldReclip(_InsetClipper old) => old.f != f;
}

/// "ركز معايا": show the picture, hide it to ask, revisit if needed.
class _MemoryMedia extends StatelessWidget {
  const _MemoryMedia({
    required this.question,
    required this.progress,
    required this.questionId,
  });

  final Question question;
  final QuestionProgress progress;
  final String questionId;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final phase = progress.memory;
    final viewing = phase == MemoryPhase.viewing;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: viewing
              ? _Photo(
                  question: question,
                  asset: question.image!,
                  revealed: true,
                )
              : _Polaroid(
                  child: _MemoryPlaceholder(
                    ready: phase == MemoryPhase.ready,
                    onShow: () => game.showMemory(questionId),
                  ),
                ),
        ),
        if (phase != MemoryPhase.ready) ...[
          const SizedBox(height: 8),
          viewing
              ? GoldButton(
                  height: 46,
                  icon: LucideIcons600.eyeOff,
                  label: lang.t('حفظناها — اسألنا', '7afaznaha — es2alna'),
                  onTap: () => game.hideMemory(questionId),
                )
              : GlassButton(
                  height: 46,
                  icon: LucideIcons.eye,
                  label: lang.t('ارجع للصورة', 'Erga3 lel soora'),
                  onTap: () => game.showMemory(questionId),
                ),
        ],
      ],
    );
  }
}

class _MemoryPlaceholder extends StatelessWidget {
  const _MemoryPlaceholder({required this.ready, required this.onShow});

  final bool ready;
  final VoidCallback onShow;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              ready ? LucideIcons.brain : LucideIcons.eyeOff,
              size: 34,
              color: AppColors.gold,
            ),
            const SizedBox(height: 8),
            Text(
              ready
                  ? lang.t('عيونكم معانا؟', '3eneekom ma3ana?')
                  : lang.t('الصورة اختفت!', 'El soora ekhtafet!'),
              textAlign: TextAlign.center,
              style: AppText.display(22, height: 1.2),
            ),
            if (ready) ...[
              const SizedBox(height: 10),
              PlayButton(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                onPressed: onShow,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons600.eye, size: 18),
                    const SizedBox(width: 8),
                    Text(
                      lang.t('اعرض الصورة', 'E3red el soora'),
                      style: AppText.sans(
                        16,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// "Who took the points?" before leaving an open question. Pops a team
/// index, [nobody], or null to keep playing.
class _LeaveDialog extends StatelessWidget {
  const _LeaveDialog({
    required this.question,
    required this.teamNames,
    required this.points,
  });

  static const nobody = -1;

  final Question question;
  final List<String> teamNames;
  final int points;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = Navigator.of(context);

    Widget team(int i) => GameButton(
      key: ValueKey('leave-team-$i'),
      height: 54,
      radius: 16,
      depth: 5,
      color: teamColors[i],
      borderColor: AppColors.deep,
      onTap: () => nav.pop(i),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            Expanded(
              child: Text(
                teamNames[i],
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.sans(
                  16,
                  weight: FontWeight.w700,
                  color: AppColors.inkOn(teamColors[i]),
                ),
              ),
            ),
            Text(
              '+${lang.toAr(points)}',
              textDirection: TextDirection.ltr,
              style: AppText.num(17, color: AppColors.inkOn(teamColors[i])),
            ),
          ],
        ),
      ),
    );

    return Dialog(
      backgroundColor: AppColors.forest,
      insetPadding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: AppColors.gold.withValues(alpha: 0.4)),
      ),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                lang.t(
                  'قبل ما ترجعوا… مين خد النقط؟',
                  'Abl ma terga3o… meen khad el no2at?',
                ),
                textAlign: TextAlign.center,
                style: AppText.display(24, height: 1.2),
              ),
              const SizedBox(height: 4),
              Text(
                lang.t(
                  'السؤال لازم يتحسم عشان ترجعوا للوحة.',
                  'El so2al lazem yet7esem 3ashan terga3o lel lo7a.',
                ),
                textAlign: TextAlign.center,
                style: AppText.sans(
                  13,
                  color: AppColors.ivory.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.06),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: lang.t('الإجابة: ', 'El egaba: '),
                        style: AppText.sans(
                          14,
                          weight: FontWeight.w700,
                          color: AppColors.gold,
                        ),
                      ),
                      TextSpan(
                        text: lang.t(question.answer, question.answerEn),
                        style: AppText.sans(15, weight: FontWeight.w700),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: team(0)),
                  const SizedBox(width: 10),
                  Expanded(child: team(1)),
                ],
              ),
              const SizedBox(height: 10),
              GlassButton(
                height: 50,
                icon: LucideIcons.x,
                label: lang.t('ولا حد', 'Wala 7ad'),
                onTap: () => nav.pop(nobody),
              ),
              const SizedBox(height: 4),
              TextButton.icon(
                key: const ValueKey('leave-stay'),
                onPressed: () => nav.pop(),
                icon: const Icon(
                  LucideIcons.undo2,
                  size: 16,
                  color: AppColors.gold,
                ),
                label: Text(
                  lang.t('لأ، كمّلوا السؤال', 'La2, kammelo el so2al'),
                  style: AppText.sans(
                    14,
                    weight: FontWeight.w700,
                    color: AppColors.gold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
