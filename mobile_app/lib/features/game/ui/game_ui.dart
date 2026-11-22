import 'package:flutter/material.dart';

import '../../../core/i18n/lang.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/brand_background.dart';
import '../../../core/ui/game_button.dart';
import '../../../core/ui/play_button.dart';
import '../../../core/ui/pressable.dart';
import '../../../core/ui/surfaces.dart';

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

/// Branded yes/no dialog. Returns true when confirmed.
Future<bool> confirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirm,
  bool destructive = false,
}) async {
  final lang = context.lang;
  final result = await showDialog<bool>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.6),
    builder: (dialogContext) => Dialog(
      backgroundColor: AppColors.forest,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: AppColors.gold.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: AppText.display(26, height: 1.2)),
            const SizedBox(height: 8),
            Text(
              message,
              style: AppText.sans(
                15,
                height: 1.6,
                color: AppColors.ivory.withValues(alpha: 0.75),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: GlassButton(
                    label: lang.t('لأ', 'La2'),
                    onTap: () => Navigator.of(dialogContext).pop(false),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: destructive
                      ? PlayButton(
                          height: 52,
                          onPressed: () =>
                              Navigator.of(dialogContext).pop(true),
                          child: Text(
                            confirm,
                            style: AppText.sans(
                              16,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        )
                      : GoldButton(
                          label: confirm,
                          onTap: () => Navigator.of(dialogContext).pop(true),
                        ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
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
