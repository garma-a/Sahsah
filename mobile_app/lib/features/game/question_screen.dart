import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/retro.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'game_controller.dart';
import 'model/question.dart';
import 'ui/fit_text.dart';
import 'ui/game_ui.dart';

/// Arabic "for [team]": ل + ال joins as لل (للفراعنة), otherwise لـ.
String _forTeam(String name) =>
    name.startsWith('ال') ? 'لل${name.substring(2)}' : 'لـ$name';

/// One question: prompt, media, the 60 s clock, reveal and award.
class QuestionScreen extends StatefulWidget {
  const QuestionScreen({super.key, required this.questionId});

  final String questionId;

  @override
  State<QuestionScreen> createState() => _QuestionScreenState();
}

class _QuestionScreenState extends State<QuestionScreen> {
  Timer? _tick;
  int _lastSecond = -1;

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

  void _award(int? team) {
    final game = context.game;
    final lang = context.lang;
    final q = game.question(widget.questionId);
    HapticFeedback.mediumImpact();
    game.award(widget.questionId, team);
    final names = game.game!.teamNames;
    final message = team == null
        ? lang.t('محدش كسب السؤال ده', 'Ma7adsh kesb el so2al da')
        : lang.t(
            '✓ ${lang.toAr(q.points)} نقطة محسومة ${_forTeam(names[team])}',
            '✓ ${q.points} no2ta ma7sooma le ${names[team]}',
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
              color: team == null ? AppColors.ivory : AppColors.forest,
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
    final id = widget.questionId;
    final q = controller.question(id);
    final p = controller.progressOf(id);
    final memoryWaiting = q.kind == QuestionKind.memory && !p.memoryAsked;

    final header = _Header(question: q);
    final prompt = _PromptCard(
      text: memoryWaiting
          ? context.lang.t(
              'ركّزوا في الصورة… السؤال جاي بعد ما تختفي',
              'Rakkezo fel soora… el so2al gay ba3d ma tekhtefy',
            )
          : context.lang.t(q.prompt, q.promptEn),
      dimmed: memoryWaiting,
    );
    final media = q.image == null
        ? null
        : _Media(question: q, progress: p, questionId: id);
    final answer = p.revealed ? _AnswerCard(question: q) : null;
    final controls = p.revealed
        ? _AwardPanel(game: game, points: q.points, onAward: _award)
        : _TimerPanel(questionId: id, disabled: memoryWaiting);

    return PopScope(
      canPop: true,
      child: GameScaffold(
        child: LayoutBuilder(
          builder: (context, box) {
            final landscape = box.maxWidth > box.maxHeight * 1.1;
            if (landscape) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                child: Column(
                  children: [
                    header,
                    const SizedBox(height: 10),
                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            flex: 5,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(child: prompt),
                                if (answer != null) ...[
                                  const SizedBox(height: 10),
                                  answer,
                                ],
                              ],
                            ),
                          ),
                          if (media != null) ...[
                            const SizedBox(width: 12),
                            Expanded(flex: 6, child: media),
                          ],
                          const SizedBox(width: 12),
                          SizedBox(width: 250, child: controls),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }
            return Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  header,
                  const SizedBox(height: 10),
                  Expanded(flex: media == null ? 5 : 3, child: prompt),
                  if (media != null) ...[
                    const SizedBox(height: 10),
                    Expanded(flex: 5, child: media),
                  ],
                  if (answer != null) ...[const SizedBox(height: 10), answer],
                  const SizedBox(height: 12),
                  controls,
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final category = allCategories.firstWhere(
      (c) => c.id == question.categoryId,
    );
    return Row(
      children: [
        RoundIconButton(
          icon: lang.ar ? LucideIcons.arrowRight : LucideIcons.arrowLeft,
          label: lang.t('رجوع للوحة', 'Rogoo3 lel lo7a'),
          onTap: () => Navigator.of(context).maybePop(),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              lang.t(category.name, category.nameEn),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.display(18, color: AppColors.forest, height: 1.2),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text(
          lang.toAr(question.points),
          textDirection: TextDirection.ltr,
          style: AppText.num(28, height: 1),
        ),
        const SizedBox(width: 4),
        Text(
          lang.t('نقطة', 'no2ta'),
          style: AppText.sans(
            13,
            weight: FontWeight.w600,
            color: AppColors.ivory.withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }
}

class _PromptCard extends StatelessWidget {
  const _PromptCard({required this.text, this.dimmed = false});

  final String text;
  final bool dimmed;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(22);
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: radius,
        border: Border.all(color: AppColors.ivory.withValues(alpha: 0.14)),
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          children: [
            const PositionedDirectional(
              bottom: 0,
              start: 0,
              width: 84,
              height: 84,
              child: Rainbow(corner: RainbowCorner.bottomStart, band: 7),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: SizedBox.expand(
                child: Center(
                  child: FitText(
                    text,
                    max: 40,
                    min: 16,
                    textAlign: TextAlign.center,
                    style: (size) => AppText.display(
                      size,
                      height: 1.35,
                      color: AppColors.ivory.withValues(
                        alpha: dimmed ? 0.6 : 1,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnswerCard extends StatelessWidget {
  const _AnswerCard({required this.question});

  final Question question;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 380),
      curve: easeBrand,
      builder: (context, v, child) => Opacity(
        opacity: v,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - v)),
          child: child,
        ),
      ),
      child: Container(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          gradient: const LinearGradient(
            begin: AlignmentDirectional.topStart,
            end: AlignmentDirectional.bottomEnd,
            colors: [AppColors.gold, Color(0xFFD9A21A)],
          ),
          boxShadow: [cssShadow(const Color(0x4DFFC72C), y: 14, blur: 36)],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lang.t('الإجابة', 'El egaba'),
                    style: AppText.sans(
                      12,
                      weight: FontWeight.w700,
                      color: AppColors.forest.withValues(alpha: 0.6),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    lang.t(question.answer, question.answerEn),
                    style: AppText.display(
                      28,
                      color: AppColors.forest,
                      height: 1.2,
                    ),
                  ),
                ],
              ),
            ),
            if (question.color != null)
              Semantics(
                label: lang.t('اللون الأصلي', 'El loon el asly'),
                child: Container(
                  width: 56,
                  height: 40,
                  decoration: BoxDecoration(
                    color: question.color,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.forest.withValues(alpha: 0.25),
                      width: 2,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Question picture, with the round's special behaviour.
class _Media extends StatelessWidget {
  const _Media({
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
    final q = question;
    final revealed = progress.revealed;
    final radius = BorderRadius.circular(22);

    if (q.kind == QuestionKind.memory && !revealed) {
      final phase = progress.memory;
      final viewing = phase == MemoryPhase.viewing;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _Frame(
              radius: radius,
              child: viewing
                  ? _Picture(question: q, revealed: true)
                  : _MemoryPlaceholder(
                      ready: phase == MemoryPhase.ready,
                      onShow: () => game.showMemory(questionId),
                    ),
            ),
          ),
          if (phase != MemoryPhase.ready) ...[
            const SizedBox(height: 8),
            viewing
                ? GoldButton(
                    height: 48,
                    icon: LucideIcons600.eyeOff,
                    label: lang.t('حفظناها — اسألنا', '7afaznaha — es2alna'),
                    onTap: () => game.hideMemory(questionId),
                  )
                : GlassButton(
                    height: 48,
                    icon: LucideIcons.eye,
                    label: lang.t('ارجع للصورة', 'Erga3 lel soora'),
                    onTap: () => game.showMemory(questionId),
                  ),
          ],
        ],
      );
    }

    return _Frame(
      radius: radius,
      child: InteractiveViewer(
        minScale: 1,
        maxScale: 4,
        child: _Picture(question: q, revealed: revealed),
      ),
    );
  }
}

class _Frame extends StatelessWidget {
  const _Frame({required this.radius, required this.child});

  final BorderRadius radius;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    // Polaroid: cream frame with a deeper bottom edge, turned a little.
    return Transform.rotate(
      angle: -0.02,
      child: Container(
        padding: const EdgeInsets.fromLTRB(8, 8, 8, 22),
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
          child: ColoredBox(color: AppColors.card, child: child),
        ),
      ),
    );
  }
}

/// The picture with person crop / grayscale applied until the reveal.
class _Picture extends StatelessWidget {
  const _Picture({required this.question, required this.revealed});

  final Question question;
  final bool revealed;

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
    if (q.kind == QuestionKind.standard) {
      return Image.asset(
        q.image!,
        fit: BoxFit.cover,
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
            child: Image.asset(q.image!, fit: BoxFit.contain),
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

class _MemoryPlaceholder extends StatelessWidget {
  const _MemoryPlaceholder({required this.ready, required this.onShow});

  final bool ready;
  final VoidCallback onShow;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.1),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.3),
                ),
              ),
              child: Icon(
                ready ? LucideIcons.brain : LucideIcons.eyeOff,
                size: 34,
                color: AppColors.gold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              ready
                  ? lang.t('عيونكم معانا؟', '3eneekom ma3ana?')
                  : lang.t('الصورة اختفت!', 'El soora ekhtafet!'),
              textAlign: TextAlign.center,
              style: AppText.display(26, height: 1.2),
            ),
            if (ready) ...[
              const SizedBox(height: 14),
              PlayButton(
                height: 54,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                onPressed: onShow,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(LucideIcons600.eye, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      lang.t('اعرض الصورة', 'E3red el soora'),
                      style: AppText.sans(
                        17,
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

/// Clock ring with pause/continue, reset and the reveal button.
class _TimerPanel extends StatelessWidget {
  const _TimerPanel({required this.questionId, required this.disabled});

  final String questionId;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final p = game.progressOf(questionId);
    final status = game.timerStatus(p);
    final running = status == TimerStatus.running;

    final ring = _TimerRing(remainingMs: game.remainingMs(p), status: status);
    final toggle = GoldButton(
      height: 52,
      icon: running ? LucideIcons600.pause : LucideIcons600.play,
      label: running ? lang.t('وقّف', 'Wa22af') : lang.t('كمّل', 'Kammel'),
      onTap: disabled ? null : () => game.toggleTimer(questionId),
    );
    final reset = Semantics(
      button: true,
      label: lang.t('إعادة الوقت', 'E3adet el wa2t'),
      excludeSemantics: true,
      child: Pressable(
        onTap: disabled ? null : () => game.resetTimer(questionId),
        child: Opacity(
          opacity: disabled ? 0.45 : 1,
          child: Container(
            width: 52,
            height: 52,
            decoration: glassDecoration(
              radius: BorderRadius.circular(16),
              shadow: false,
            ),
            child: const Icon(
              LucideIcons.rotateCcw,
              size: 20,
              color: AppColors.ivory,
            ),
          ),
        ),
      ),
    );
    final reveal = PlayButton(
      height: 56,
      onPressed: disabled ? null : () => game.reveal(questionId),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons600.eye, size: 20),
          const SizedBox(width: 8),
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                lang.t('إظهار الإجابة', 'Ezhar el egaba'),
                style: const TextStyle(
                  fontFamily: AppFonts.sans,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );

    return LayoutBuilder(
      builder: (context, box) {
        // Side panel (landscape) stacks; bottom panel (portrait) is a row.
        if (box.maxHeight.isFinite) {
          return Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(child: SizedBox(width: 130, height: 130, child: ring)),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(child: toggle),
                  const SizedBox(width: 8),
                  reset,
                ],
              ),
              const SizedBox(height: 8),
              reveal,
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SizedBox(width: 76, height: 76, child: ring),
                const SizedBox(width: 12),
                Expanded(child: toggle),
                const SizedBox(width: 8),
                reset,
              ],
            ),
            const SizedBox(height: 10),
            reveal,
          ],
        );
      },
    );
  }
}

class _TimerRing extends StatelessWidget {
  const _TimerRing({required this.remainingMs, required this.status});

  final int remainingMs;
  final TimerStatus status;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final secs = (remainingMs / 1000).ceil();
    final fraction = remainingMs / GameController.answerMs;
    final low = status == TimerStatus.running && secs <= 10;
    final color = low || status == TimerStatus.elapsed
        ? AppColors.play
        : AppColors.gold;
    final label = switch (status) {
      TimerStatus.ready => lang.t('جاهز', 'Gahez'),
      TimerStatus.running => lang.t('شغّال', 'Shaghal'),
      TimerStatus.paused => lang.t('واقف', 'Wa2ef'),
      TimerStatus.elapsed => lang.t('خلص الوقت', 'El wa2t kheles'),
    };
    return Semantics(
      label: lang.t('$secs ثانية، $label', '$secs sanya, $label'),
      excludeSemantics: true,
      child: CustomPaint(
        painter: _RingPainter(fraction: fraction, color: color),
        child: Center(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // A lone "٠" reads like a dot, so time's up gets an icon.
                  if (status == TimerStatus.elapsed)
                    const Icon(
                      Icons.timer_off_rounded,
                      size: 34,
                      color: AppColors.play,
                    )
                  else
                    Text(
                      lang.toAr(secs),
                      style: AppText.num(32, color: AppColors.ivory, height: 1),
                    ),
                  Text(
                    label,
                    style: AppText.sans(
                      11,
                      color: AppColors.ivory.withValues(alpha: 0.55),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.color});

  final double fraction;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * 0.08;
    final rect = Offset.zero & size;
    final arcRect = rect.deflate(stroke / 2);
    // Solid face so the starry background doesn't show behind the number.
    canvas.drawCircle(
      rect.center,
      size.shortestSide / 2 - stroke / 2,
      Paint()..color = AppColors.card,
    );
    canvas.drawArc(
      arcRect,
      0,
      math.pi * 2,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = Colors.white.withValues(alpha: 0.1),
    );
    canvas.drawArc(
      arcRect,
      -math.pi / 2,
      math.pi * 2 * fraction.clamp(0, 1),
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.color != color;
}

/// "Who got it right?": a team, or nobody.
class _AwardPanel extends StatelessWidget {
  const _AwardPanel({
    required this.game,
    required this.points,
    required this.onAward,
  });

  final Game game;
  final int points;
  final ValueChanged<int?> onAward;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    Widget teamButton(int team) => Semantics(
      button: true,
      child: Pressable(
        onTap: () => onAward(team),
        child: Container(
          height: 60,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: teamColors[team],
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              cssShadow(
                teamColors[team].withValues(alpha: 0.35),
                y: 8,
                blur: 20,
              ),
            ],
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  game.teamNames[team],
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.sans(
                    17,
                    weight: FontWeight.w700,
                    color: AppColors.forest,
                  ),
                ),
              ),
              Text(
                '+${lang.toAr(points)}',
                textDirection: TextDirection.ltr,
                style: AppText.num(17, color: AppColors.forest),
              ),
            ],
          ),
        ),
      ),
    );

    return LayoutBuilder(
      builder: (context, box) {
        final side = box.maxHeight.isFinite;
        final buttons = side
            ? [teamButton(0), const SizedBox(height: 8), teamButton(1)]
            : [
                Row(
                  children: [
                    Expanded(child: teamButton(0)),
                    const SizedBox(width: 10),
                    Expanded(child: teamButton(1)),
                  ],
                ),
              ];
        return Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              lang.t('مين جاوب صح؟', 'Meen gaweb sa7?'),
              textAlign: TextAlign.center,
              style: AppText.display(24, height: 1.2),
            ),
            const SizedBox(height: 10),
            ...buttons,
            const SizedBox(height: 8),
            GlassButton(
              height: 50,
              icon: LucideIcons.x,
              label: lang.t('ولا حد', 'Wala 7ad'),
              onTap: () => onAward(null),
            ),
          ],
        );
      },
    );
  }
}
