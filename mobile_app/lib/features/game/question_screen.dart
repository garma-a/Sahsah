import 'dart:async';
import 'dart:math' as math;

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api/game_wire.dart' show MediaRef;
import '../../core/audio/sound.dart';
import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import 'board_screen.dart' show TeamScore;
import 'game_controller.dart';
import 'model/question.dart';
import 'pack_screen.dart' show PackScreen;
import 'ui/fit_text.dart';
import 'ui/game_ui.dart';
import 'ui/photo_viewer.dart';
import '../../core/ui/motion.dart';

/// Arabic "for [team]": ل + ال joins as لل (للفراعنة), otherwise لـ.
String _forTeam(String name) =>
    name.startsWith('ال') ? 'لل${name.substring(2)}' : 'لـ$name';

/// Opens question [id] and waits until the host leaves it. Leaving without
/// a decision keeps its time, stage and reveal for later (Q54).
Future<void> playQuestion(BuildContext context, String id) =>
    playQuestionOn(Navigator.of(context), context.game, id);

/// [playQuestion] without a context.
Future<void> playQuestionOn(
  NavigatorState navigator,
  GameController game,
  String id,
) async {
  game.open(id);
  await navigator.push(
    PageRouteBuilder<void>(
      transitionDuration: const Duration(milliseconds: 260),
      reverseTransitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (_, _, _) => QuestionScreen(questionId: id),
      transitionsBuilder: (context, animation, _, child) =>
          MediaQuery.disableAnimationsOf(context)
          ? child
          : FadeTransition(
              opacity: animation,
              child: ScaleTransition(
                scale: Tween(begin: 0.96, end: 1.0).animate(
                  CurvedAnimation(
                    parent: animation,
                    curve: Curves.easeOutCubic,
                  ),
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
  TimerStatus? _lastStatus;

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
      final status = game.timerStatus(p);
      if (secs == _lastSecond && status == _lastStatus) return;
      final sound = context.sound;
      if (status == TimerStatus.running && secs != _lastSecond) {
        // The last ten seconds tick out loud.
        if (secs == 10) HapticFeedback.heavyImpact();
        final tick = SoundController.forSecond(secs);
        if (tick != null) sound.play(tick);
      }
      // The clock ran out just now (not: a question reopened after its
      // time was already up).
      if (status == TimerStatus.elapsed && _lastStatus == TimerStatus.running) {
        HapticFeedback.heavyImpact();
        sound.play(Sfx.timeUp);
      }
      _lastSecond = secs;
      _lastStatus = status;
      setState(() {});
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
        questionId: id,
        teamNames: game.game!.teamNames,
        points: game.availablePoints(id),
        onReveal: () => game.reveal(id),
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
    context.sound.play(team == null ? Sfx.nobody : Sfx.correct);
    game.award(widget.questionId, team);
    final names = game.game!.teamNames;
    final message = team == null
        ? lang.t('محدش كسب السؤال ده', 'Ma7adsh kesb el so2al da')
        : lang.t(
            '✓ ${lang.toAr(points)} نقطة محسومة ${_forTeam(names[team])}',
            '✓ $points no2ta ma7sooma le ${names[team]}',
          );
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    final ink = team == null
        ? AppColors.ivory
        : AppColors.inkOn(teamColors[team]);
    // Over the foot of the pack's side panel, clear of the tiles; centred
    // at the bottom if the pack has no side panel (portrait).
    // Measured against the app's own overlay, the space the snack bar is
    // laid out in (on a tablet the app is scaled, so screen pixels differ).
    final root = Overlay.of(context).context.findRenderObject();
    final panel = PackScreen.coverKey.currentContext?.findRenderObject();
    final Rect? over = panel is RenderBox && panel.hasSize && root is RenderBox
        ? panel.localToGlobal(Offset.zero, ancestor: root) & panel.size
        : null;
    final screen = root is RenderBox ? root.size : MediaQuery.sizeOf(context);
    navigator.pop();
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          width: over == null ? 460 : null,
          margin: over == null
              ? null
              : EdgeInsets.fromLTRB(
                  math.max(0, over.left + 8),
                  0,
                  math.max(0, screen.width - over.right + 8),
                  math.max(0, screen.height - over.bottom + 8),
                ),
          persist: false,
          duration: const Duration(seconds: 2),
          backgroundColor: team == null ? AppColors.ui : teamColors[team],
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.ink, width: 3),
          ),
          padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 10, 12),
          content: Text(
            message,
            style: AppText.sans(15, weight: FontWeight.w700, color: ink),
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
    // Opening on the server, or it couldn't be opened.
    if (controller.viewOf(id) == null) {
      return GameScaffold(
        tv: true,
        child: _Opening(
          busy: controller.busy,
          onRetry: () => controller.open(id),
        ),
      );
    }
    final q = controller.question(id);
    final p = controller.progressOf(id);
    final categoryName = game.nameOf(q.categoryId);
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
        // A dash, not a dot: an Arabic zero is a dot, so "٢٠٠ ·" would
        // read as ٢٠٠٠.
        '$categoryName – ${lang.toAr(points)} نقطة',
        '$categoryName – $points no2ta',
      ),
      child: content,
    );

    // The clock waits on the memory picture and the acting rules, and
    // stops with the reveal.
    final timerOff =
        p.revealed ||
        (q.kind == QuestionKind.memory && !p.memoryAsked) ||
        (q.kind == QuestionKind.acting && !controller.actorReady(id));
    final timer = _TimerBar(questionId: id, disabled: timerOff);
    Widget score(int team) => TeamScore(game: game, team: team, compact: true);

    // Back (button or gesture) asks who took the points first.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: GameScaffold(
        tv: true,
        child: LayoutBuilder(
          builder: (context, box) {
            final landscape = box.maxWidth > box.maxHeight * 1.1;
            return Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // One slim strip: a score at each corner and the clock
                  // between them, where the whole table can see it. The
                  // card below gets the full width.
                  if (landscape)
                    Row(
                      children: [
                        Expanded(flex: 3, child: score(0)),
                        const SizedBox(width: 12),
                        Expanded(flex: 5, child: timer),
                        const SizedBox(width: 12),
                        Expanded(flex: 3, child: score(1)),
                      ],
                    )
                  else ...[
                    Row(
                      children: [
                        Expanded(child: score(0)),
                        const SizedBox(width: 8),
                        Expanded(child: score(1)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    timer,
                  ],
                  const SizedBox(height: 22),
                  Expanded(child: card),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Width / height of a question's picture, so its frame can hug it.
double _photoAspect(Question q) => switch (q.kind) {
  QuestionKind.staged => 1,
  QuestionKind.standard => 4 / 5,
  _ => 4 / 3,
};

/// A picture beside its controls. With room (landscape) the picture takes
/// the card's full height and [top] / [bottom] stack next to it; otherwise
/// everything stacks.
class _MediaLayout extends StatelessWidget {
  const _MediaLayout({
    required this.aspect,
    required this.media,
    required this.top,
    required this.bottom,
  });

  /// Width / height of the picture.
  final double aspect;
  final Widget media;

  /// The question or the answer; takes the space that's left.
  final Widget top;

  /// Buttons; as tall as they need.
  final Widget bottom;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        if (box.maxWidth > box.maxHeight * 1.3) {
          final width = math.min(box.maxWidth * 0.48, box.maxHeight * aspect);
          return Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: top),
                    const SizedBox(height: 12),
                    bottom,
                  ],
                ),
              ),
              const SizedBox(width: 14),
              SizedBox(width: width, child: media),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(flex: 2, child: top),
            const SizedBox(height: 8),
            Expanded(flex: 3, child: media),
            const SizedBox(height: 12),
            bottom,
          ],
        );
      },
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
            // The website's question card: grained paper with a chunky ink
            // outline and drop. Text on it is ink.
            decoration: paperDecoration(
              radius: BorderRadius.circular(24),
              border: 4,
              drop: 7,
            ),
            child: DefaultTextStyle.merge(
              style: const TextStyle(color: AppColors.ink),
              child: IconTheme.merge(
                data: const IconThemeData(color: AppColors.ink),
                child: child,
              ),
            ),
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
                color: AppColors.gold,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.ink, width: 3),
                boxShadow: [inkDrop(3)],
              ),
              child: Text(
                badge,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.display(17, height: 1.3, color: AppColors.ink),
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
    final memoryWaiting = q.kind == QuestionKind.memory && !p.memoryAsked;
    // 6B: before Ready the screen shows the rules; the timer waits.
    final actingRules =
        q.kind == QuestionKind.acting &&
        !game.actorReady(questionId) &&
        !p.revealed;
    final canClarify = game.can(questionId, 'advance_hint');

    // With no picture the question has the whole card, so it can be bigger.
    final textOnly = q.kind == QuestionKind.standard && q.image == null;
    final prompt = FitText(
      memoryWaiting && q.prompt.isEmpty
          ? lang.t(
              'ركّزوا في الصورة… السؤال جاي بعد ما تختفي',
              'Rakkezo fel soora… el so2al gay ba3d ma tekhtefy',
            )
          : q.prompt,
      max: textOnly ? 46 : 38,
      min: 16,
      textAlign: TextAlign.center,
      style: (size) => AppText.display(
        size,
        height: 1.35,
        // An instruction, not a disabled line: full ink.
        color: context.textColor,
      ),
    );

    // The picture, when the question has one.
    final Widget? media = switch (q.kind) {
      QuestionKind.acting => null,
      QuestionKind.audio => _ClipCard(clip: q.audio, hint: q.hint),
      QuestionKind.memory => _MemoryMedia(
        question: q,
        progress: p,
        questionId: questionId,
      ),
      QuestionKind.staged when q.clue != null => _WithClue(question: q),
      _ when q.image != null => _Photo(question: q, image: q.image!),
      _ => null,
    };

    final back = SizedBox(
      width: 130,
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
        onTap: () => game.startActing(questionId),
      );
    } else if (memoryWaiting) {
      // Nothing to reveal yet: say when the answer comes, rather than show
      // a faded button with no reason.
      primary = _Hint(
        icon: LucideIcons600.eyeOff,
        label: lang.t(
          'الإجابة بتظهر بعد السؤال',
          'El egaba btezhar ba3d el so2al',
        ),
      );
    } else {
      primary = _GreenButton(
        icon: LucideIcons600.eye,
        label: lang.t('إظهار الإجابة', 'Ezhar el egaba'),
        onTap: game.can(questionId, 'reveal_answer')
            ? () => game.reveal(questionId)
            : null,
      );
    }

    final clarify = canClarify
        ? GoldButton(
            height: 50,
            icon: LucideIcons600.zoomIn,
            label: lang.t('وضّح الصورة', 'Wada7 el soora'),
            onTap: () => game.advanceStage(questionId),
          )
        : null;

    // Back at the start, the main buttons at the end. Beside a picture
    // the row is narrow, so "clarify" takes a row of its own there.
    final actions = LayoutBuilder(
      builder: (context, box) {
        final own = clarify != null && box.maxWidth < 520 ? clarify : null;
        final inline = own == null ? clarify : null;
        final row = Row(
          children: [
            back,
            const SizedBox(width: 12),
            Expanded(
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (inline != null) ...[
                    Flexible(
                      flex: 5,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 200),
                        child: inline,
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Flexible(
                    flex: 6,
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: own == null ? 240 : double.infinity,
                      ),
                      child: primary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
        if (own == null) return row;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [own, const SizedBox(height: 10), row],
        );
      },
    );

    final bottom = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (q.kind == QuestionKind.staged) ...[
          _StageLadder(stages: q.pointStages, stage: p.stage),
          const SizedBox(height: 12),
        ],
        actions,
      ],
    );

    if (media == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: q.kind != QuestionKind.acting
                ? Center(child: prompt)
                : actingRules
                ? _ActingRules(cardUrl: q.cardUrl)
                : _ActingLive(prompt: prompt),
          ),
          const SizedBox(height: 12),
          bottom,
        ],
      );
    }
    return _MediaLayout(
      aspect: _photoAspect(q),
      media: media,
      top: Center(child: prompt),
      bottom: bottom,
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
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 19, color: AppColors.ink),
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

/// Dark pill: pause/continue, the time left, reset (template 6A).
/// The answering clock: play / pause, the time left, a bar that drains,
/// and reset. It turns red for the last ten seconds and says so when the
/// time is up.
/// Where a button will be once it means something: a dashed-feeling ink
/// outline with the reason, not a faded button.
class _Hint extends StatelessWidget {
  const _Hint({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.ink.withValues(alpha: 0.35),
          width: 2,
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: AppColors.inkMuted),
          const SizedBox(width: 8),
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.sans(
                14,
                weight: FontWeight.w700,
                color: AppColors.inkMuted,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

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
    // The screen repaints once a second, so a running bar glides towards
    // where it will be at the next tick.
    final left = (running ? ms - 1000 : ms) / GameController.answerMs;

    // A 48×48 target (the platforms' minimum) around a 38px button, so a
    // hurried thumb mid-game still lands.
    Widget round(IconData icon, String label, VoidCallback? onTap) => Pressable(
      semanticLabel: label,
      onTap: disabled ? null : onTap,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: elapsed ? Colors.white : AppColors.ink,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 19,
              color: elapsed ? AppColors.ink : Colors.white,
            ),
          ),
        ),
      ),
    );

    return Opacity(
      opacity: disabled ? 0.55 : 1,
      child: AnimatedContainer(
        duration: motionFor(context, const Duration(milliseconds: 250)),
        height: 48,
        // The website's timer: a white face with an ink edge and drop;
        // the bar is cyan, amber when paused and red for the last ten
        // seconds, and the whole face turns red when time is up.
        decoration: BoxDecoration(
          color: elapsed ? AppColors.press : Colors.white,
          borderRadius: BorderRadius.circular(999),
          boxShadow: [inkDrop(4)],
        ),
        // The edge is painted over the face, not around it, so the
        // buttons keep their full 48px targets in a 48px bar.
        foregroundDecoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.ink, width: 3),
        ),
        child: Row(
          children: [
            round(
              running ? LucideIcons600.pause : LucideIcons600.play,
              running ? lang.t('وقّف', 'Wa22af') : lang.t('كمّل', 'Kammel'),
              // Only what the server allows right now.
              game.can(questionId, switch (status) {
                    TimerStatus.running => 'pause_timer',
                    TimerStatus.paused => 'resume_timer',
                    _ => 'reset_timer',
                  })
                  ? () => game.toggleTimer(questionId)
                  : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Semantics(
                label: elapsed
                    ? lang.t('خلص الوقت', 'El wa2t kheles')
                    : lang.t('$secs ثانية', '$secs sanya'),
                excludeSemantics: true,
                child: elapsed
                    ? Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            LucideIcons600.alarmClockOff,
                            size: 20,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 8),
                          Flexible(
                            child: Text(
                              lang.t('خلص الوقت!', 'El wa2t kheles!'),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppText.display(
                                20,
                                height: 1.2,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ],
                      )
                    : Row(
                        children: [
                          SizedBox(
                            width: 80,
                            child: Text(
                              lang.toAr(time),
                              textDirection: TextDirection.ltr,
                              textAlign: TextAlign.center,
                              style: AppText.num(
                                28,
                                color: low ? AppColors.press : AppColors.ink,
                                height: 1,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: SizedBox(
                                height: 10,
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    ColoredBox(
                                      color: AppColors.ink.withValues(
                                        alpha: 0.1,
                                      ),
                                    ),
                                    TweenAnimationBuilder<double>(
                                      tween: Tween(end: left.clamp(0.0, 1.0)),
                                      duration: Duration(
                                        milliseconds: running ? 1000 : 250,
                                      ),
                                      builder: (context, v, _) => Align(
                                        alignment:
                                            AlignmentDirectional.centerStart,
                                        child: FractionallySizedBox(
                                          widthFactor: v,
                                          heightFactor: 1,
                                          child: ColoredBox(
                                            color: low
                                                ? AppColors.press
                                                : running
                                                ? AppColors.cyan
                                                : AppColors.amber,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(width: 10),
            round(
              LucideIcons.rotateCcw,
              lang.t('إعادة الوقت', 'E3adet el wa2t'),
              game.can(questionId, 'reset_timer')
                  ? () => game.resetTimer(questionId)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

// ---- 6B acting -------------------------------------------------------------

/// Before Ready: the rules and the code the actor scans (template 6B). The
/// card opens on the actor's phone only (ADR 0019).
class _ActingRules extends StatelessWidget {
  const _ActingRules({required this.cardUrl});

  final String? cardUrl;

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
              _CardQr(url: cardUrl),
              const SizedBox(width: 14),
              Expanded(
                // The three rules keep the full width and shrink together
                // when the card is short (a phone's), rather than spill
                // under the buttons.
                child: LayoutBuilder(
                  builder: (context, box) => Center(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: SizedBox(
                        width: box.maxWidth,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (final (i, rule) in rules.indexed) ...[
                              if (i > 0) const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: AppColors.ink,
                                    width: 2,
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
                                          color: AppColors.ink,
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
                    ),
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

/// The charades card's address as a QR code, for the actor's phone.
class _CardQr extends StatelessWidget {
  const _CardQr({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final link = url;
    return Semantics(
      label: lang.t(
        'كود الممثل: امسحه من موبايله',
        'Code el momasel: emsa7o men mobailo',
      ),
      excludeSemantics: true,
      child: Container(
        width: 170,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.paperShade,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.ink, width: 2.5),
        ),
        child: Column(
          children: [
            Expanded(
              child: AspectRatio(
                aspectRatio: 1,
                child: Container(
                  padding: const EdgeInsets.all(6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: link == null
                      ? const Icon(LucideIcons.qrCode, color: AppColors.ink)
                      : QrImageView(
                          data: link,
                          padding: EdgeInsets.zero,
                          eyeStyle: const QrEyeStyle(
                            eyeShape: QrEyeShape.square,
                            color: AppColors.ink,
                          ),
                          dataModuleStyle: const QrDataModuleStyle(
                            dataModuleShape: QrDataModuleShape.square,
                            color: AppColors.ink,
                          ),
                        ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              lang.t('للممثل بس', 'Lel momasel bas'),
              maxLines: 1,
              style: AppText.sans(13, weight: FontWeight.w700),
            ),
          ],
        ),
      ),
    );
  }
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
        Icon(LucideIcons.drama, size: 54, color: context.accentText),
        const SizedBox(height: 10),
        Flexible(child: prompt),
        const SizedBox(height: 10),
        Text(
          lang.t(
            'من غير ولا كلمة… والباقي يخمّن',
            'Men gher wala kelma… wel ba2y ykhammen',
          ),
          style: AppText.sans(15, color: context.mutedText),
        ),
      ],
    );
  }
}

// ---- 6C staged -------------------------------------------------------------

/// Points ladder as a row of steps: done ones fade, the current one
/// glows, later ones are locked (template 6C).
class _StageLadder extends StatelessWidget {
  const _StageLadder({required this.stages, required this.stage});

  final List<int> stages;
  final int stage;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Row(
      children: [
        for (final (i, points) in stages.indexed) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Semantics(
              label: lang.t(
                'الصورة ${lang.toAr(i + 1)}: ${lang.toAr(points)} نقطة',
                'El soora ${i + 1}: $points no2ta',
              ),
              selected: i == stage,
              excludeSemantics: true,
              child: AnimatedContainer(
                duration: motionFor(context, const Duration(milliseconds: 220)),
                height: 42,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: i == stage
                      ? AppColors.gold
                      : i < stage
                      ? context.faint
                      : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: i < stage
                        ? AppColors.ink.withValues(alpha: 0.3)
                        : AppColors.ink,
                    width: 2.5,
                  ),
                  boxShadow: i == stage ? [inkDrop(3)] : null,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      i < stage
                          ? LucideIcons.check
                          : i == stage
                          ? LucideIcons600.eye
                          : LucideIcons.lock,
                      size: 16,
                      color: i == stage
                          ? AppColors.ink
                          : AppColors.ink.withValues(alpha: 0.5),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      lang.toAr(points),
                      style:
                          AppText.num(
                            20,
                            height: 1,
                            color: AppColors.ink.withValues(
                              alpha: i < stage ? 0.4 : 1,
                            ),
                          ).copyWith(
                            decoration: i < stage
                                ? TextDecoration.lineThrough
                                : null,
                          ),
                    ),
                  ],
                ),
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
    // The answer's picture; a riddle's illustration may stay.
    final picture =
        q.answerImage ??
        (q.kind == QuestionKind.riddle || q.kind == QuestionKind.standard
            ? q.image
            : null);

    // The website's answer slab: yellow, ink-edged, turning up from its
    // top edge once when it appears.
    final answer = Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Flexible(
          child: _RevealSlab(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  lang.t('الإجابة الصحيحة', 'El egaba el sa7ee7a'),
                  textAlign: TextAlign.center,
                  style: AppText.display(
                    16,
                    height: 1,
                    color: AppColors.ink.withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(height: 4),
                Flexible(
                  child: FitText(
                    q.answer,
                    max: 40,
                    min: 18,
                    textAlign: TextAlign.center,
                    style: (size) => AppText.display(
                      size,
                      height: 1.25,
                      color: AppColors.ink,
                    ),
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
                          border: Border.all(color: AppColors.ink, width: 3),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );

    Widget teamButton(int team) => GameButton(
      height: 52,
      radius: 16,
      depth: 5,
      color: teamColors[team],
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

    final nobody = GlassButton(
      height: 52,
      icon: LucideIcons.x,
      label: lang.t('ولا حد', 'Wala 7ad'),
      onTap: () => onAward(null),
    );
    final backToQuestion = TextButton.icon(
      onPressed: onBackToQuestion,
      icon: Icon(LucideIcons.undo2, size: 16, color: context.accentText),
      label: Text(
        lang.t('ارجع للسؤال', 'Erga3 lel so2al'),
        style: AppText.sans(
          14,
          weight: FontWeight.w700,
          color: context.accentText,
        ),
      ),
    );

    // "Who got it?" — both teams, then nobody. Beside a picture the row
    // is narrow, so "nobody" drops to the line below.
    final award = LayoutBuilder(
      builder: (context, box) {
        final tight = box.maxWidth < 420;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
                if (!tight) ...[
                  const SizedBox(width: 10),
                  SizedBox(width: 120, child: nobody),
                ],
              ],
            ),
            const SizedBox(height: 4),
            if (tight)
              Row(
                children: [
                  Expanded(child: nobody),
                  const SizedBox(width: 10),
                  Expanded(child: backToQuestion),
                ],
              )
            else
              Center(child: backToQuestion),
          ],
        );
      },
    );

    final Widget? media = picture != null
        ? _Photo(question: q, image: picture)
        : q.forwardAudio != null
        ? _ClipCard(
            clip: q.forwardAudio,
            label: lang.t('اسمع المقطع صح', 'Esma3 el ma2ta3 sa7'),
          )
        : null;
    if (media == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: answer),
          const SizedBox(height: 10),
          award,
        ],
      );
    }
    return _MediaLayout(
      aspect: _photoAspect(q),
      media: media,
      top: answer,
      bottom: award,
    );
  }
}

/// The answer slab (the website's `reveal` keyframes): it turns up from
/// its top edge, overshoots a little and settles, once.
class _RevealSlab extends StatelessWidget {
  const _RevealSlab({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final calm = MediaQuery.disableAnimationsOf(context);
    final slab = Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: AppColors.sun,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.ink, width: 4),
        boxShadow: [inkDrop(7)],
      ),
      child: child,
    );
    if (calm) return slab;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: motionFor(context, const Duration(milliseconds: 650)),
      curve: Curves.easeOut,
      child: slab,
      builder: (context, t, child) {
        // 0 → 60%: from folded back (-80°) to just past flat (8°); then
        // settle to flat.
        final angle = t < 0.6
            ? -80 + (88 * t / 0.6)
            : 8 - 8 * ((t - 0.6) / 0.4);
        final scale = t < 0.6
            ? 0.92 + 0.1 * t / 0.6
            : 1.02 - 0.02 * ((t - 0.6) / 0.4);
        return Opacity(
          opacity: (t / 0.6).clamp(0.0, 1.0),
          child: Transform(
            alignment: Alignment.topCenter,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 1 / 900)
              ..rotateX(angle * math.pi / 180)
              ..scaleByDouble(scale, scale, 1, 1),
            child: child,
          ),
        );
      },
    );
  }
}

// ---- Pictures --------------------------------------------------------------

/// The question picture in a polaroid frame. Tap to open it full screen
/// and zoom. It comes from a short-lived link; until the link is in, the
/// frame waits.
class _Photo extends StatelessWidget {
  const _Photo({required this.question, required this.image});

  final Question question;
  final MediaRef image;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final provider = context.game.image(image);
    if (provider == null) {
      return _Framed(
        aspect: _photoAspect(question),
        child: const Center(
          child: SizedBox(
            width: 28,
            height: 28,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: AppColors.gold,
            ),
          ),
        ),
      );
    }
    Widget picture({required bool full}) => _Picture(
      image: provider,
      fit: full || question.kind == QuestionKind.staged
          ? BoxFit.contain
          : (question.isPictureRound ? BoxFit.contain : BoxFit.cover),
    );
    return _Framed(
      aspect: _photoAspect(question),
      child: Semantics(
        button: true,
        label: lang.t('كبّر الصورة', 'Kabbar el soora'),
        child: GestureDetector(
          onTap: () => showPhotoViewer(context, (_) => picture(full: true)),
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

/// A clue round: the picture, with the latest clue card beside it.
class _WithClue extends StatelessWidget {
  const _WithClue({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          flex: 3,
          child: _Photo(question: question, image: question.image!),
        ),
        const SizedBox(height: 8),
        Expanded(
          flex: 2,
          child: _Photo(question: question, image: question.clue!),
        ),
      ],
    );
  }
}

/// A cream photo frame, turned a little, sized to a picture of [aspect]
/// (width / height): it grows as large as its box allows and leaves no
/// empty bars around the picture.
class _Framed extends StatelessWidget {
  const _Framed({required this.aspect, required this.child});

  final double aspect;
  final Widget child;

  static const _pad = 6.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        var w = math.max(0.0, box.maxWidth - _pad * 2);
        var h = w / aspect;
        final maxH = math.max(0.0, box.maxHeight - _pad * 2);
        if (h > maxH) {
          h = maxH;
          w = h * aspect;
        }
        return Center(
          child: Transform.rotate(
            angle: -0.012,
            child: Container(
              width: w + _pad * 2,
              height: h + _pad * 2,
              padding: const EdgeInsets.all(_pad),
              // A white print with an ink edge, pinned a little crooked.
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                color: Colors.white,
                border: Border.all(color: AppColors.ink, width: 3),
                boxShadow: [inkDrop(5)],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                // Dark behind the picture, so anything drawn there (the
                // memory round's notes) stays light.
                child: ColoredBox(
                  color: AppColors.deep,
                  child: DefaultTextStyle.merge(
                    style: const TextStyle(color: AppColors.ivory),
                    child: IconTheme.merge(
                      data: const IconThemeData(color: AppColors.ivory),
                      child: child,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// A question picture. The server sends it already cropped or in grey
/// where the format asks for it, and the full picture with the answer.
class _Picture extends StatelessWidget {
  const _Picture({required this.image, required this.fit});

  final ImageProvider<Object> image;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Image(
      image: image,
      fit: fit,
      width: double.infinity,
      height: double.infinity,
      gaplessPlayback: true,
      errorBuilder: (_, _, _) => const Center(
        child: Icon(LucideIcons.imageOff, size: 30, color: AppColors.ivory),
      ),
    );
  }
}

/// A clip the host plays out loud (audio rounds), in the picture's place.
class _ClipCard extends StatefulWidget {
  const _ClipCard({required this.clip, this.hint, this.label});

  final MediaRef? clip;

  /// A spoken clue under the button (`AUDIO_VOICE`).
  final String? hint;

  /// What the button says before it's played.
  final String? label;

  @override
  State<_ClipCard> createState() => _ClipCardState();
}

class _ClipCardState extends State<_ClipCard> {
  AudioPlayer? _player;
  StreamSubscription<PlayerState>? _state;
  bool _playing = false;
  bool _failed = false;

  @override
  void dispose() {
    _state?.cancel();
    _player?.dispose();
    super.dispose();
  }

  Future<void> _toggle() async {
    final game = context.game;
    final player = _player ??= AudioPlayer();
    if (_playing) {
      await player.pause();
      return;
    }
    // A link renewed if it's about to expire.
    final url = await game.freshMediaUrl(widget.clip);
    if (url == null || !mounted) return;
    _state ??= player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _playing = s == PlayerState.playing);
    });
    try {
      setState(() => _failed = false);
      await player.play(UrlSource(url));
    } on Object {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final ready = context.game.mediaUrl(widget.clip) != null;
    return _Framed(
      aspect: 4 / 3,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Pressable(
                semanticLabel: _playing
                    ? lang.t('وقّف المقطع', 'Wa22af el ma2ta3')
                    : lang.t('شغّل المقطع', 'Shaghghal el ma2ta3'),
                onTap: ready ? _toggle : null,
                child: Container(
                  width: 84,
                  height: 84,
                  decoration: BoxDecoration(
                    color: ready ? AppColors.gold : AppColors.disabled,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.ink, width: 3),
                    boxShadow: [inkDrop(4)],
                  ),
                  child: ready
                      ? Icon(
                          _playing ? LucideIcons600.pause : LucideIcons600.play,
                          size: 38,
                          color: AppColors.ink,
                        )
                      : const Padding(
                          padding: EdgeInsets.all(26),
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: AppColors.ink,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                _failed
                    ? lang.t(
                        'المقطع مشتغلش. جرّب تاني.',
                        'El ma2ta3 mashtaghalsh. Garrab tany.',
                      )
                    : widget.label ?? lang.t('اسمعوا كويس', 'Esma3o kwayes'),
                textAlign: TextAlign.center,
                style: AppText.display(20, height: 1.2),
              ),
              if (widget.hint case final hint?) ...[
                const SizedBox(height: 6),
                Text(
                  hint,
                  textAlign: TextAlign.center,
                  style: AppText.sans(14, height: 1.4),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The question couldn't be shown yet: it's opening on the server, or the
/// server refused (the message says why).
class _Opening extends StatelessWidget {
  const _Opening({required this.busy, required this.onRetry});

  final bool busy;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (busy) ...[
            const SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.gold,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              lang.t('بنفتح السؤال…', 'Benfta7 el so2al…'),
              style: AppText.display(22),
            ),
          ] else ...[
            Text(
              lang.t('مقدرناش نفتح السؤال', 'Ma2dernash nefta7 el so2al'),
              style: AppText.display(24),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 150,
                  child: GlassButton(
                    height: 50,
                    icon: lang.ar
                        ? LucideIcons.arrowRight
                        : LucideIcons.arrowLeft,
                    label: lang.t('رجوع', 'Rogoo3'),
                    onTap: () => Navigator.of(context).pop(),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 170,
                  child: GoldButton(
                    height: 50,
                    icon: LucideIcons600.rotateCcw,
                    label: lang.t('جرّب تاني', 'Garrab tany'),
                    onTap: onRetry,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
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
          child: viewing && question.image != null
              ? _Photo(question: question, image: question.image!)
              : _Framed(
                  aspect: _photoAspect(question),
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
                  onTap: game.can(questionId, 'hide_memory')
                      ? () => game.hideMemory(questionId)
                      : null,
                )
              : GlassButton(
                  height: 46,
                  icon: LucideIcons.eye,
                  label: lang.t('ارجع للصورة', 'Erga3 lel soora'),
                  onTap: game.can(questionId, 'show_memory')
                      ? () => game.showMemory(questionId)
                      : null,
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
class _LeaveDialog extends StatefulWidget {
  const _LeaveDialog({
    required this.questionId,
    required this.teamNames,
    required this.points,
    required this.onReveal,
  });

  static const nobody = -1;

  final String questionId;
  final List<String> teamNames;
  final int points;

  /// The host asked to see the answer from here; it counts as a reveal.
  final VoidCallback onReveal;

  @override
  State<_LeaveDialog> createState() => _LeaveDialogState();
}

class _LeaveDialogState extends State<_LeaveDialog> {
  // Pressing back by mistake mustn't spoil the answer: it shows only once
  // the server has revealed it.

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final nav = Navigator.of(context);
    final game = context.game;
    final question = game.question(widget.questionId);
    final shown = game.progressOf(widget.questionId).revealed;
    final teamNames = widget.teamNames;
    final points = widget.points;

    Widget team(int i) => GameButton(
      key: ValueKey('leave-team-$i'),
      height: 54,
      radius: 16,
      depth: 5,
      color: teamColors[i],
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

    // A paper card, like the website's award panel: ink text, ink edge.
    return Dialog(
      backgroundColor: AppColors.paper,
      insetPadding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: AppColors.ink, width: 4),
      ),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: AppColors.ink),
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
                  style: AppText.sans(13, color: AppColors.inkMuted),
                ),
                const SizedBox(height: 10),
                if (!shown)
                  Center(
                    child: OutlinedButton.icon(
                      key: const ValueKey('leave-show-answer'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(0, 44),
                        backgroundColor: Colors.white,
                        side: const BorderSide(
                          color: AppColors.ink,
                          width: 2.5,
                        ),
                        shape: const StadiumBorder(),
                      ),
                      onPressed: game.busy ? null : widget.onReveal,
                      icon: const Icon(
                        LucideIcons.eye,
                        size: 16,
                        color: AppColors.ink,
                      ),
                      label: Text(
                        lang.t(
                          'الإجابة مخفية · اظهروها',
                          'El egaba makhfeya · ezharooha',
                        ),
                        style: AppText.sans(
                          14,
                          weight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.sun,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.ink, width: 2.5),
                    ),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: lang.t('الإجابة: ', 'El egaba: '),
                            style: AppText.sans(
                              14,
                              weight: FontWeight.w700,
                              color: AppColors.inkMuted,
                            ),
                          ),
                          TextSpan(
                            text: question.answer,
                            style: AppText.sans(
                              15,
                              weight: FontWeight.w700,
                              color: AppColors.ink,
                            ),
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
                  onTap: () => nav.pop(_LeaveDialog.nobody),
                ),
                const SizedBox(height: 4),
                TextButton.icon(
                  key: const ValueKey('leave-stay'),
                  onPressed: () => nav.pop(),
                  icon: const Icon(
                    LucideIcons.undo2,
                    size: 16,
                    color: AppColors.pressDeep,
                  ),
                  label: Text(
                    lang.t('لأ، كمّلوا السؤال', 'La2, kammelo el so2al'),
                    style: AppText.sans(
                      14,
                      weight: FontWeight.w700,
                      color: AppColors.pressDeep,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
