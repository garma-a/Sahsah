import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'game_controller.dart';
import 'model/question.dart';
import 'pack_screen.dart';
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
    await playQuestion(context, id);
    if (mounted && (context.game.game?.finished ?? false)) _showResults();
  }

  /// A pack's six questions on their own screen (200 / 400 / 600).
  Future<void> _openPack(String categoryId) async {
    await Navigator.of(context).push(
      PageRouteBuilder<void>(
        transitionDuration: const Duration(milliseconds: 280),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => PackScreen(categoryId: categoryId),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(begin: const Offset(0, 0.04), end: Offset.zero)
                .animate(
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
    if (mounted && (context.game.game?.finished ?? false)) _showResults();
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
              child: _Board(game: game, onOpen: _openPack),
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
        _BarAction(
          icon: LucideIcons.x,
          caption: lang.t('خروج', 'Khoroog'),
          label: lang.t('خروج', 'Khoroog'),
          onTap: onExit,
        ),
        const SizedBox(width: 8),
        Expanded(child: TeamScore(game: game, team: 0)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: TurnChip(game: game),
        ),
        Expanded(child: TeamScore(game: game, team: 1)),
        const SizedBox(width: 8),
        _BarAction(
          icon: LucideIcons.flag,
          caption: lang.t('إنهاء', 'Enha2'),
          label: lang.t('أنهي اللعبة', 'Anhy el le3ba'),
          onTap: onEnd,
        ),
      ],
    );
  }
}

/// A top-bar button with a word under its icon, so "leave" and "end the
/// game" can't be mixed up.
class _BarAction extends StatelessWidget {
  const _BarAction({
    required this.icon,
    required this.caption,
    required this.label,
    required this.onTap,
  });

  final IconData icon;

  /// The short word shown under the icon.
  final String caption;

  /// The full name for screen readers.
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 52,
          constraints: const BoxConstraints(minWidth: 56),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: glassDecoration(
            radius: BorderRadius.circular(16),
            shadow: false,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: AppColors.ivory),
              const SizedBox(height: 2),
              Text(
                caption,
                maxLines: 1,
                style: AppText.sans(12, weight: FontWeight.w700, height: 1.1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A team's name and score; tap to correct the total. When the score goes
/// up the pill pops and the points gained drop out under it.
class TeamScore extends StatefulWidget {
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
  State<TeamScore> createState() => _TeamScoreState();
}

class _TeamScoreState extends State<TeamScore>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pop = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );
  // The "+400" chip is drawn in the overlay so it sits on top of whatever
  // is under the pill.
  final _link = LayerLink();
  final _portal = OverlayPortalController();
  late int _seen;
  int _gain = 0;

  @override
  void initState() {
    super.initState();
    _seen = widget.game.scores[widget.team];
    _portal.show();
  }

  /// The game object is the same one each rebuild, so the last score is
  /// remembered here to notice a rise. A pill covered by another screen
  /// waits: when its screen is back it shows everything gained meanwhile.
  void _check() {
    if (!TickerMode.of(context)) return;
    final now = widget.game.scores[widget.team];
    if (now > _seen) {
      _gain = now - _seen;
      _pop.forward(from: 0);
    }
    _seen = now;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _check();
  }

  @override
  void didUpdateWidget(TeamScore old) {
    super.didUpdateWidget(old);
    _check();
  }

  @override
  void dispose() {
    _pop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = widget.game;
    final team = widget.team;
    final compact = widget.compact;
    final color = teamColors[team];
    final ink = AppColors.inkOn(color);
    final leading = game.leader == team;
    final pill = Semantics(
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
          // Solid team colour with an ink outline and drop, like the
          // website's team ribbons. The leader is marked by the crown.
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: color,
            border: Border.all(color: AppColors.ink, width: 3),
            boxShadow: [inkDrop(leading ? 6 : 4)],
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
              // The unit sits under the score so it takes no width from the
              // name.
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(end: game.scores[team].toDouble()),
                    duration: const Duration(milliseconds: 600),
                    curve: Curves.easeOutCubic,
                    // A lone Arabic zero is a small dot, so say it.
                    builder: (context, v, _) => Text(
                      v.round() == 0 && lang.ar ? 'صفر' : lang.toAr(v.round()),
                      textDirection: TextDirection.ltr,
                      // The word is wider and has a tail, so it's set smaller.
                      style: AppText.num(
                        v.round() == 0 && lang.ar
                            ? (compact ? 16 : 21)
                            : (compact ? 20 : 26),
                        color: ink,
                        height: 1.05,
                      ),
                    ),
                  ),
                  Text(
                    lang.t('نقطة', 'no2ta'),
                    style: AppText.sans(
                      12,
                      weight: FontWeight.w700,
                      color: ink.withValues(alpha: 0.85),
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    final chip = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.deep, width: 2),
        boxShadow: [cssShadow(const Color(0x66000000), y: 4, blur: 10)],
      ),
      child: Text(
        '+${lang.toAr(_gain)}',
        textDirection: TextDirection.ltr,
        style: AppText.num(17, color: AppColors.deep, height: 1.1),
      ),
    );

    return OverlayPortal(
      controller: _portal,
      // "+400" drops out under the pill, holds, then fades.
      overlayChildBuilder: (context) => Positioned(
        left: 0,
        top: 0,
        child: CompositedTransformFollower(
          link: _link,
          showWhenUnlinked: false,
          targetAnchor: Alignment.bottomCenter,
          followerAnchor: Alignment.topCenter,
          offset: const Offset(0, -8),
          child: IgnorePointer(
            child: FadeTransition(
              opacity: TweenSequence<double>([
                TweenSequenceItem(
                  tween: Tween(begin: 0.0, end: 1.0),
                  weight: 10,
                ),
                TweenSequenceItem(tween: ConstantTween(1.0), weight: 65),
                TweenSequenceItem(
                  tween: Tween(begin: 1.0, end: 0.0),
                  weight: 25,
                ),
              ]).animate(_pop),
              child: SlideTransition(
                position: Tween(begin: const Offset(0, -0.6), end: Offset.zero)
                    .animate(
                      CurvedAnimation(
                        parent: _pop,
                        curve: const Interval(
                          0,
                          0.25,
                          curve: Curves.easeOutBack,
                        ),
                      ),
                    ),
                child: chip,
              ),
            ),
          ),
        ),
      ),
      child: CompositedTransformTarget(
        link: _link,
        // A quick swell as the points land.
        child: ScaleTransition(
          scale: TweenSequence<double>([
            TweenSequenceItem(
              tween: Tween(
                begin: 1.0,
                end: 1.08,
              ).chain(CurveTween(curve: Curves.easeOut)),
              weight: 12,
            ),
            TweenSequenceItem(
              tween: Tween(
                begin: 1.08,
                end: 1.0,
              ).chain(CurveTween(curve: Curves.easeIn)),
              weight: 18,
            ),
            TweenSequenceItem(tween: ConstantTween(1.0), weight: 70),
          ]).animate(_pop),
          child: pill,
        ),
      ),
    );
  }
}

/// Whose turn it is to pick a question, with an arrow towards that team's
/// score. The turn passes by itself after every settled question; tapping
/// hands it to the other team.
class TurnChip extends StatelessWidget {
  const TurnChip({super.key, required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final controller = context.game;
    final team = game.turn;
    final color = teamColors[team];
    final name = game.teamNames[team];
    // Team 0's score sits at the start of the bar, team 1's at the end.
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final arrow = Icon(
      (team == 0) == rtl ? LucideIcons.chevronsRight : LucideIcons.chevronsLeft,
      size: 20,
      color: color,
    );

    return Semantics(
      button: !game.finished,
      label: lang.t(
        'الدور على $name، اضغط عشان تبدّل الدور',
        'El door 3ala $name, edghat 3ashan tebaddel el door',
      ),
      excludeSemantics: true,
      child: Pressable(
        key: const ValueKey('turn-chip'),
        onTap: game.finished ? null : controller.switchTurn,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          height: 52,
          constraints: const BoxConstraints(maxWidth: 170),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          decoration: BoxDecoration(
            color: AppColors.deep,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color, width: 2),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (team == 0) ...[arrow, const SizedBox(width: 4)],
              Flexible(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      lang.t('الدور على', 'El door 3ala'),
                      maxLines: 1,
                      style: AppText.sans(
                        12,
                        color: AppColors.ivory.withValues(alpha: 0.8),
                        height: 1.2,
                      ),
                    ),
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.display(16, height: 1.25),
                    ),
                  ],
                ),
              ),
              if (team == 1) ...[const SizedBox(width: 4), arrow],
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

/// A pack on the board: its cover photo, name and one pip per question.
/// Tapping it opens the pack's questions.
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
    final lang = context.lang;
    final category = allCategories.firstWhere((c) => c.id == categoryId);
    final slot = game.categoryIds.indexOf(categoryId);
    final frame =
        AppColors.categoryColors[slot % AppColors.categoryColors.length];
    final ids = [for (var r = 0; r < tilePoints.length; r++) '$categoryId-$r'];
    final left = ids.where((id) => !game.results.containsKey(id)).length;
    final done = left == 0;
    final open =
        ids.contains(game.activeId) ||
        ids.any(
          (id) =>
              !game.results.containsKey(id) &&
              game.progress[id]?.revealed == true,
        );
    final name = lang.t(category.name, category.nameEn);
    final radius = BorderRadius.circular(18);

    return Semantics(
      button: !done,
      label: done
          ? lang.t('$name، خلصت', '$name, khelset')
          : lang.t(
              '$name، باقي ${lang.toAr(left)} أسئلة',
              '$name, ba2y $left as2ela',
            ),
      excludeSemantics: true,
      child: Pressable(
        scale: 0.97,
        onTap: done ? null : () => onOpen(categoryId),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: frame, width: 3),
            boxShadow: [cssShadow(const Color(0x66000000), y: 10, blur: 24)],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(15),
            child: Stack(
              fit: StackFit.expand,
              children: [
                ColorFiltered(
                  colorFilter: done
                      ? const ColorFilter.matrix([
                          0.2126, 0.7152, 0.0722, 0, 0, //
                          0.2126, 0.7152, 0.0722, 0, 0, //
                          0.2126, 0.7152, 0.0722, 0, 0, //
                          0, 0, 0, 1, 0, //
                        ])
                      : const ColorFilter.mode(
                          Colors.transparent,
                          BlendMode.dst,
                        ),
                  child: Image.asset(
                    BrandImages.category(categoryId),
                    fit: BoxFit.cover,
                    alignment: const Alignment(0, -0.35),
                  ),
                ),
                const DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.center,
                      colors: [Color(0xF02B3230), Color(0x002B3230)],
                    ),
                  ),
                ),
                if (done)
                  ColoredBox(color: AppColors.deep.withValues(alpha: 0.45)),
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: _Badge(
                    color: done ? AppColors.green : AppColors.deep,
                    ink: Colors.white,
                    icon: done ? LucideIcons600.check : null,
                    label: done
                        ? lang.t('خلصت', 'Khelset')
                        : lang.t('باقي ${lang.toAr(left)}', 'Ba2y $left'),
                  ),
                ),
                if (open && !done)
                  PositionedDirectional(
                    top: 8,
                    end: 8,
                    child: _Badge(
                      color: AppColors.gold,
                      ink: AppColors.deep,
                      icon: LucideIcons600.circlePlay,
                      label: lang.t('سؤال مفتوح', 'So2al maftoo7'),
                    ),
                  ),
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 8,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.display(20, height: 1.25),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          for (final (i, id) in ids.indexed) ...[
                            if (i > 0) const SizedBox(width: 4),
                            Expanded(child: _Pip(result: game.results[id])),
                          ],
                        ],
                      ),
                    ],
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

class _Badge extends StatelessWidget {
  const _Badge({
    required this.color,
    required this.ink,
    required this.label,
    this.icon,
  });

  final Color color;
  final Color ink;
  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: ink),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppText.sans(12, weight: FontWeight.w700, color: ink),
          ),
        ],
      ),
    );
  }
}

/// One question's state on a pack card: open, won by a team, or nobody.
class _Pip extends StatelessWidget {
  const _Pip({required this.result});

  final TileResult? result;

  @override
  Widget build(BuildContext context) {
    final r = result;
    final team = r?.team;
    return Container(
      height: 6,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(3),
        color: r == null
            ? AppColors.ivory.withValues(alpha: 0.85)
            : team == null
            ? AppColors.ivory.withValues(alpha: 0.2)
            : teamColors[team],
      ),
    );
  }
}
