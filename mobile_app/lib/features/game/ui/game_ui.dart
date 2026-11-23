import 'package:flutter/material.dart';

import '../../../core/i18n/lang.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/brand_background.dart';
import '../../../core/ui/game_button.dart';
import '../../../core/ui/pressable.dart';
import '../../../core/ui/surfaces.dart';
import '../game_controller.dart';

/// Team colours from the website (`teamTone` in components/brand/tones.ts):
/// cyan for the first team, yellow for the second. Red is the main button
/// and the alarm, never a team. Text on either fill is ink.
const teamColors = [AppColors.cyan, AppColors.sun];

/// Full-screen frame for game screens: the poster wall, safe area, no
/// bottom bar. With [tv] the screen is played on the retro TV, as the
/// website stages its board, questions and result.
class GameScaffold extends StatelessWidget {
  const GameScaffold({
    super.key,
    required this.child,
    this.bottom,
    this.tv = false,
  });

  final Widget child;

  /// Stage [child] on the retro TV.
  final bool tv;

  /// Pinned action area above the system bar.
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return _ProblemNotes(child: _frame(context));
  }

  Widget _frame(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deep,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          const Positioned.fill(child: BrandBackground(decorated: false)),
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: SafeArea(
                  bottom: bottom == null,
                  child: tv
                      ? Padding(
                          padding: const EdgeInsets.fromLTRB(8, 6, 8, 12),
                          child: RetroScreen(child: child),
                        )
                      : child,
                ),
              ),
              // The bar's background runs edge to edge; its content stays
              // clear of camera cutouts and the system bar.
              if (bottom != null)
                ClipRect(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.forest.withValues(alpha: 0.94),
                      border: const Border(
                        top: BorderSide(color: AppColors.ink, width: 3),
                      ),
                    ),
                    child: SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                        child: bottom,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Round glass icon button (close, back, end…).
class RoundIconButton extends StatelessWidget {
  const RoundIconButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.size = 44,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Pressable(
      semanticLabel: label,
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: glassDecoration(shape: BoxShape.circle, shadow: false),
        child: Icon(icon, size: size * 0.45, color: AppColors.ivory),
      ),
    );
  }
}

/// Branded yes/no dialog on paper, like the question's leave dialog.
/// Returns true when confirmed.
///
/// A [destructive] one leads with the safe choice: [cancel] ("keep
/// playing") is the yellow button, and the confirm is an outline with red
/// words, so the inviting button never ends anything.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirm,
  String? cancel,
  bool destructive = false,
}) async {
  final lang = context.lang;
  final cancelLabel = cancel ?? lang.t('لأ', 'La2');
  final result = await showDialog<bool>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (dialogContext) {
      final nav = Navigator.of(dialogContext);
      final Widget no = destructive
          ? GoldButton(
              key: const ValueKey('confirm-cancel'),
              label: cancelLabel,
              onTap: () => nav.pop(false),
            )
          : GlassButton(
              key: const ValueKey('confirm-cancel'),
              label: cancelLabel,
              onTap: () => nav.pop(false),
            );
      final Widget yes = destructive
          ? GameButton(
              key: const ValueKey('confirm-ok'),
              height: 52,
              color: AppColors.paper,
              borderColor: AppColors.pressDeep,
              semanticLabel: confirm,
              onTap: () => nav.pop(true),
              child: Text(
                confirm,
                style: AppText.sans(
                  16,
                  weight: FontWeight.w700,
                  color: AppColors.pressDeep,
                ),
              ),
            )
          : GoldButton(
              key: const ValueKey('confirm-ok'),
              label: confirm,
              onTap: () => nav.pop(true),
            );
      return Dialog(
        backgroundColor: AppColors.paper,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: AppColors.ink, width: 4),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  title,
                  style: AppText.display(26, height: 1.2, color: AppColors.ink),
                ),
                const SizedBox(height: 8),
                Text(
                  message,
                  style: AppText.sans(
                    15,
                    height: 1.6,
                    color: AppColors.inkMuted,
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(child: no),
                    const SizedBox(width: 10),
                    Expanded(child: yes),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
  return result ?? false;
}

/// Solid gold action (secondary to the red play button).
class GoldButton extends StatelessWidget {
  const GoldButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.height = 52,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    // The website's yellow chunk: ink outline, ink lip.
    return GameButton(
      height: height,
      radius: 16,
      depth: 4,
      color: AppColors.gold,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: _Label(icon: icon, label: label, color: AppColors.ink),
      ),
    );
  }
}

/// Secondary action: the website's dark button.
class GlassButton extends StatelessWidget {
  const GlassButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.height = 52,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    // The website's dark button: ink face with a cyan ring.
    return GameButton(
      height: height,
      radius: 16,
      depth: 4,
      color: AppColors.ink,
      borderColor: AppColors.cyan.withValues(alpha: 0.7),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: _Label(icon: icon, label: label, color: AppColors.ivory),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.label, required this.color, this.icon});

  final String label;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 19, color: color),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppText.sans(16, weight: FontWeight.w700, color: color),
          ),
        ),
      ],
    );
  }
}

/// Shows what went wrong with a game command, once, as a message on the
/// screen in front (a game played on the server can refuse or fail).
class _ProblemNotes extends StatefulWidget {
  const _ProblemNotes({required this.child});

  final Widget child;

  @override
  State<_ProblemNotes> createState() => _ProblemNotesState();
}

class _ProblemNotesState extends State<_ProblemNotes> {
  GameController? _game;
  int _seen = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final game = context
        .dependOnInheritedWidgetOfExactType<GameScope>()
        ?.notifier;
    if (game == _game) return;
    _game?.removeListener(_check);
    _game = game;
    _seen = game?.problemCount ?? 0;
    game?.addListener(_check);
  }

  @override
  void dispose() {
    _game?.removeListener(_check);
    super.dispose();
  }

  void _check() {
    final game = _game;
    if (game == null || game.problemCount == _seen) return;
    _seen = game.problemCount;
    final problem = game.problem;
    // Only the screen in front speaks; the ones under it stay quiet.
    if (problem == null || !(ModalRoute.of(context)?.isCurrent ?? true)) {
      return;
    }
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          width: 460,
          backgroundColor: AppColors.ui,
          content: Text(
            problem.message(context.lang),
            style: AppText.sans(15, weight: FontWeight.w600),
          ),
        ),
      );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
