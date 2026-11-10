import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';

/// Opens the "join with code" bottom sheet guests use to enter a room.
Future<void> showJoinSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    // Don't stretch across a landscape screen.
    constraints: const BoxConstraints(maxWidth: 560),
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (_) => const JoinSheet(),
  );
}

/// Six-digit invitation code entry (see `CONTEXT.md`: Invitation code).
class JoinSheet extends StatefulWidget {
  const JoinSheet({super.key});

  static const codeLength = 6;

  @override
  State<JoinSheet> createState() => _JoinSheetState();
}

class _JoinSheetState extends State<JoinSheet> {
  final _code = TextEditingController();
  final _focus = FocusNode();
  String? _message;

  @override
  void dispose() {
    _code.dispose();
    _focus.dispose();
    super.dispose();
  }

  bool get _complete => _code.text.length == JoinSheet.codeLength;

  void _join() {
    final lang = context.lang;
    // Rooms aren't in the backend yet; say so instead of failing silently.
    setState(
      () => _message = lang.t(
        'الدخول بالكود جاي مع غرف اللعب في المرحلة الجاية.',
        'El dokhool bel code gay ma3 ghoraf el le3b fel mar7ala el gaya.',
      ),
    );
  }

  void _scan() {
    final lang = context.lang;
    setState(
      () => _message = lang.t(
        'مسح الـQR جاي في المرحلة الجاية. اكتب الكود دلوقتي.',
        'Mas7 el QR gay fel mar7ala el gaya. Ekteb el code delwa2ty.',
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final insets = MediaQuery.viewInsetsOf(context).bottom;
    final safe = MediaQuery.paddingOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: insets),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.forest,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(
            top: BorderSide(color: AppColors.gold.withValues(alpha: 0.3)),
          ),
        ),
        padding: EdgeInsets.fromLTRB(20, 10, 20, 20 + safe),
        // Scrolls when the keyboard leaves little room (landscape).
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.ivory.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                lang.t('ادخل اللعبة بالكود', 'Odkhol el le3ba bel code'),
                style: AppText.display(28, height: 1.2),
              ),
              const SizedBox(height: 4),
              Text(
                lang.t(
                  'الكود ٦ أرقام على شاشة المضيف.',
                  'El code 6 arqam 3ala shashet el host.',
                ),
                style: AppText.sans(
                  14,
                  color: AppColors.ivory.withValues(alpha: 0.65),
                ),
              ),
              const SizedBox(height: 20),
              _CodeBoxes(
                controller: _code,
                focusNode: _focus,
                onChanged: () => setState(() => _message = null),
                onSubmitted: _complete ? _join : null,
              ),
              if (_message != null) ...[
                const SizedBox(height: 14),
                Text(
                  _message!,
                  textAlign: TextAlign.center,
                  style: AppText.sans(
                    13,
                    weight: FontWeight.w600,
                    color: AppColors.gold,
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Row(
                children: [
                  Semantics(
                    button: true,
                    label: lang.t('امسح الـQR', 'Emsa7 el QR'),
                    excludeSemantics: true,
                    child: Pressable(
                      onTap: _scan,
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: glassDecoration(
                          radius: BorderRadius.circular(16),
                          shadow: false,
                        ),
                        child: const Icon(
                          LucideIcons.scanLine,
                          size: 26,
                          color: AppColors.gold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PlayButton(
                      height: 60,
                      onPressed: _complete ? _join : null,
                      // No colour here: the button dims the label when disabled.
                      child: Text(
                        lang.t('ادخل', 'Odkhol'),
                        style: const TextStyle(
                          fontFamily: AppFonts.sans,
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Six boxes driven by one hidden numeric field, so typing, deleting and
/// pasting a whole code all work naturally.
class _CodeBoxes extends StatelessWidget {
  const _CodeBoxes({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final VoidCallback onChanged;
  final VoidCallback? onSubmitted;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return GestureDetector(
      onTap: focusNode.requestFocus,
      child: Stack(
        children: [
          // Invisible field that owns the keyboard and the text.
          Opacity(
            opacity: 0,
            child: SizedBox(
              height: 64,
              child: TextField(
                key: const ValueKey('join-code'),
                controller: controller,
                focusNode: focusNode,
                autofocus: true,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.go,
                showCursor: false,
                enableInteractiveSelection: false,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(JoinSheet.codeLength),
                ],
                onChanged: (_) => onChanged(),
                onSubmitted: (_) => onSubmitted?.call(),
                decoration: const InputDecoration(border: InputBorder.none),
              ),
            ),
          ),
          // Codes read left to right, as on the host screen.
          Directionality(
            textDirection: TextDirection.ltr,
            child: ListenableBuilder(
              listenable: Listenable.merge([controller, focusNode]),
              builder: (context, _) {
                final text = controller.text;
                return Semantics(
                  label: lang.t('كود اللعبة', 'Code el le3ba'),
                  value: text,
                  child: Row(
                    children: [
                      for (var i = 0; i < JoinSheet.codeLength; i++) ...[
                        if (i > 0) SizedBox(width: i == 3 ? 14 : 8),
                        Expanded(
                          child: _Box(
                            digit: i < text.length ? text[i] : '',
                            active:
                                focusNode.hasFocus &&
                                (i == text.length ||
                                    (i == JoinSheet.codeLength - 1 &&
                                        text.length == JoinSheet.codeLength)),
                          ),
                        ),
                      ],
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.digit, required this.active});

  final String digit;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      height: 64,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: digit.isEmpty
            ? Colors.white.withValues(alpha: 0.05)
            : AppColors.gold.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          width: active ? 2 : 1,
          color: active
              ? AppColors.gold
              : Colors.white.withValues(alpha: digit.isEmpty ? 0.15 : 0.3),
        ),
      ),
      child: Text(
        digit,
        style: AppText.num(30, color: AppColors.ivory, height: 1),
      ),
    );
  }
}
