import 'package:flutter/material.dart';

import '../../core/api/sahsah_api.dart';
import '../../core/i18n/lang.dart';
import '../../core/session/host_session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../shared/form_widgets.dart';

/// Asks once per phone for the shared passcode and the host's name, then
/// signs in (the website's "قبل ما نبدأ"). Pops true when signed in.
Future<bool> showSignInSheet(BuildContext context, HostSession session) async {
  final done = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    constraints: const BoxConstraints(maxWidth: 560),
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (_) => _SignInSheet(session: session),
  );
  return done ?? false;
}

class _SignInSheet extends StatefulWidget {
  const _SignInSheet({required this.session});

  final HostSession session;

  @override
  State<_SignInSheet> createState() => _SignInSheetState();
}

class _SignInSheetState extends State<_SignInSheet> {
  final _passcode = TextEditingController();
  late final _name = TextEditingController(text: widget.session.displayName);
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _passcode.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final lang = context.lang;
    if (_passcode.text.trim().isEmpty || _name.text.trim().isEmpty) {
      setState(
        () => _error = lang.t(
          'اكتب الكود السري واسمك الأول.',
          'Ekteb el code el serry w esmak el awel.',
        ),
      );
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.session.signIn(
        passcode: _passcode.text,
        displayName: _name.text,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message(lang));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
        padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + safe),
        // Scrolls when the keyboard leaves little room (landscape).
        child: SingleChildScrollView(
          child: AutofillGroup(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  lang.t('قبل ما نبدأ', '2abl ma nebda2'),
                  style: AppText.display(28, height: 1.2),
                ),
                const SizedBox(height: 4),
                Text(
                  lang.t(
                    'بنسألك مرة واحدة بس على الموبايل ده.',
                    'Bens2alak marra wa7da bas 3al mobile da.',
                  ),
                  style: AppText.sans(
                    14,
                    color: AppColors.ivory.withValues(alpha: 0.7),
                  ),
                ),
                const SizedBox(height: 18),
                SahsahField(
                  fieldKey: const ValueKey('sign-in-passcode'),
                  label: lang.t('الكود السري', 'El code el serry'),
                  controller: _passcode,
                  obscure: true,
                  ltr: true,
                  maxLength: 200,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 14),
                SahsahField(
                  fieldKey: const ValueKey('sign-in-name'),
                  label: lang.t('اسمك', 'Esmak'),
                  hint: lang.t('اسمك كمضيف', 'Esmak ka host'),
                  controller: _name,
                  maxLength: 80,
                  autofillHints: const [AutofillHints.nickname],
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                FormError(_error),
                const SizedBox(height: 18),
                PlayButton(
                  height: 56,
                  onPressed: _busy ? null : _submit,
                  child: Text(
                    _busy ? lang.t('ثانية…', 'Sanya…') : lang.t('يلا', 'Yalla'),
                    style: const TextStyle(
                      fontFamily: AppFonts.sans,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
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
