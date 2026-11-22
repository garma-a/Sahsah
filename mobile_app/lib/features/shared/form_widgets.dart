import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../game/ui/game_ui.dart';
import '../../core/ui/motion.dart';

/// Labelled text field in the app's dark style.
class SahsahField extends StatelessWidget {
  const SahsahField({
    super.key,
    required this.label,
    required this.controller,
    this.fieldKey,
    this.hint,
    this.optional = false,
    this.keyboardType,
    this.ltr = false,
    this.maxLines = 1,
    this.maxLength,
    this.onChanged,
    this.autofillHints,
  });

  final String label;
  final TextEditingController controller;
  final Key? fieldKey;
  final String? hint;

  /// Adds "(optional)" after the label.
  final bool optional;
  final TextInputType? keyboardType;

  /// Phone numbers and emails read left to right in Arabic too.
  final bool ltr;
  final int maxLines;
  final int? maxLength;
  final ValueChanged<String>? onChanged;
  final Iterable<String>? autofillHints;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    // On paper the field is the website's input: white with an ink edge
    // and a cyan ring when focused. On dark it stays a faint glass field.
    final paper = context.onPaper;
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: paper
          ? const BorderSide(color: AppColors.ink, width: 2.5)
          : BorderSide(color: Colors.white.withValues(alpha: 0.14)),
    );
    // One node for screen readers: the field is announced with its name
    // ("رقم المستلم, edit box"), not as a bare edit box after a loose line.
    return MergeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text.rich(
            TextSpan(
              text: label,
              style: AppText.sans(13, weight: FontWeight.w700),
              children: [
                if (optional)
                  TextSpan(
                    text: lang.t(' (اختياري)', ' (e5tyary)'),
                    style: AppText.sans(12, color: context.mutedText),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            key: fieldKey,
            controller: controller,
            keyboardType: keyboardType,
            maxLines: maxLines,
            maxLength: maxLength,
            onChanged: onChanged,
            autofillHints: autofillHints,
            textDirection: ltr ? TextDirection.ltr : null,
            textAlign: TextAlign.start,
            style: AppText.sans(
              16,
              weight: FontWeight.w600,
              color: context.textColor,
            ),
            cursorColor: paper ? AppColors.ink : AppColors.gold,
            decoration: InputDecoration(
              hintText: hint,
              hintTextDirection: ltr ? TextDirection.ltr : null,
              hintStyle: AppText.sans(15, color: context.mutedText),
              counterText: '',
              isDense: true,
              filled: true,
              fillColor: paper
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.06),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 13,
              ),
              border: border,
              enabledBorder: border,
              focusedBorder: border.copyWith(
                borderSide: paper
                    ? const BorderSide(color: AppColors.cyan, width: 3)
                    : const BorderSide(color: AppColors.gold, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A row of pill options; the selected one is filled yellow.
class ChoicePills<T> extends StatelessWidget {
  const ChoicePills({
    super.key,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final List<(T, String, IconData?)> options;
  final T selected;
  final ValueChanged<T> onSelect;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (value, label, icon) in options)
          _Pill(
            label: label,
            icon: icon,
            selected: value == selected,
            onTap: () => onSelect(value),
          ),
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  final String label;
  final IconData? icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final paper = context.onPaper;
    final ink = selected || paper ? AppColors.ink : AppColors.ivory;
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: motionFor(context, const Duration(milliseconds: 160)),
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: selected
              ? BoxDecoration(
                  color: AppColors.gold,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.ink, width: 2.5),
                  boxShadow: [inkDrop(3)],
                )
              : paper
              ? paperDecoration(
                  radius: BorderRadius.circular(999),
                  border: 2.5,
                  drop: 0,
                )
              : glassDecoration(
                  radius: BorderRadius.circular(999),
                  shadow: false,
                ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 17, color: ink),
                const SizedBox(width: 7),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.sans(14, weight: FontWeight.w700, color: ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Inline error under a form, read out by screen readers.
class FormError extends StatelessWidget {
  const FormError(this.message, {super.key});

  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message;
    if (text == null) return const SizedBox.shrink();
    // A light red on dark; the website's error red on paper.
    final red = context.onPaper
        ? AppColors.errorOnPaper
        : AppColors.errorOnDark;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Semantics(
        liveRegion: true,
        child: Row(
          children: [
            Icon(LucideIcons.circleAlert, size: 16, color: red),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                text,
                style: AppText.sans(13, weight: FontWeight.w600, color: red),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A printed card that groups a form or a list: the website's paper card,
/// with ink text.
class PanelCard extends StatelessWidget {
  const PanelCard({super.key, required this.child, this.padding = 18});

  final Widget child;
  final double padding;

  @override
  Widget build(BuildContext context) {
    return Paper(
      radius: 22,
      drop: 5,
      padding: EdgeInsets.all(padding),
      child: child,
    );
  }
}

/// Bottom sheet for features the backend doesn't have yet (payments,
/// sign-in, the support inbox): says so plainly and offers a next step.
Future<void> showNoticeSheet(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String message,
  String? actionLabel,
  VoidCallback? onAction,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    constraints: const BoxConstraints(maxWidth: 560),
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (sheetContext) {
      final lang = sheetContext.lang;
      return Container(
        decoration: BoxDecoration(
          color: AppColors.forest,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(
            top: BorderSide(color: AppColors.gold.withValues(alpha: 0.4)),
          ),
        ),
        padding: EdgeInsets.fromLTRB(
          22,
          20,
          22,
          20 + MediaQuery.paddingOf(sheetContext).bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, size: 24, color: AppColors.deep),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(title, style: AppText.display(26, height: 1.2)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                message,
                style: AppText.sans(
                  15,
                  height: 1.6,
                  color: AppColors.ivory.withValues(alpha: 0.75),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: GlassButton(
                      label: lang.t('تمام', 'Tamam'),
                      onTap: () => Navigator.of(sheetContext).pop(),
                    ),
                  ),
                  if (actionLabel != null && onAction != null) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: GoldButton(
                        label: actionLabel,
                        onTap: () {
                          Navigator.of(sheetContext).pop();
                          onAction();
                        },
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}
