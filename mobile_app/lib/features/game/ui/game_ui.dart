import 'package:flutter/material.dart';

import '../../../core/i18n/lang.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/brand_background.dart';
import '../../../core/ui/play_button.dart';
import '../../../core/ui/pressable.dart';
import '../../../core/ui/surfaces.dart';

/// Team colours from the brand deck: red for the first team, teal for the
/// second.
const teamColors = [AppColors.play, AppColors.teal];

/// Full-screen frame for game screens: brand background, safe area, no
/// bottom bar.
class GameScaffold extends StatelessWidget {
  const GameScaffold({super.key, required this.child, this.bottom});

  final Widget child;

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
                child: SafeArea(bottom: bottom == null, child: child),
              ),
              // The bar's background runs edge to edge; its content stays
              // clear of camera cutouts and the system bar.
              if (bottom != null)
                ClipRect(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.forest.withValues(alpha: 0.92),
                      border: Border(
                        top: BorderSide(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
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
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          width: size,
          height: size,
          decoration: glassDecoration(shape: BoxShape.circle, shadow: false),
          child: Icon(icon, size: size * 0.45, color: AppColors.ivory),
        ),
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
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      child: Pressable(
        onTap: onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: enabled ? 1 : 0.45,
          child: Container(
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.gold,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [cssShadow(const Color(0x40FFC72C), y: 8, blur: 22)],
            ),
            child: _Label(icon: icon, label: label, color: AppColors.forest),
          ),
        ),
      ),
    );
  }
}

/// Outlined glass action.
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
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: height,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: glassDecoration(
            radius: BorderRadius.circular(16),
            shadow: false,
            borderColor: Colors.white.withValues(alpha: 0.2),
          ),
          child: _Label(icon: icon, label: label, color: AppColors.ivory),
        ),
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
