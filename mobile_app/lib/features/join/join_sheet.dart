import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../../core/ui/motion.dart';
import '../../core/api/game_wire.dart';
import '../../core/api/sahsah_api.dart';
import '../../core/ui/game_button.dart';
import '../game/game_controller.dart';
import '../game/guest_room_screen.dart';
import '../game/ui/game_ui.dart' show teamColors;
import '../shared/form_widgets.dart';
import 'scan_screen.dart';

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

/// Joining someone's room from this phone: the six-digit code from the
/// host's screen, then a name and a team. The seat proof stays on this
/// phone (see `CONTEXT.md`: Invitation code).
class JoinSheet extends StatefulWidget {
  const JoinSheet({super.key});

  static const codeLength = 6;

  @override
  State<JoinSheet> createState() => _JoinSheetState();
}

class _JoinSheetState extends State<JoinSheet> {
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _focus = FocusNode();
  String? _message;
  bool _busy = false;

  /// The room the code opens; null while entering the code.
  InvitationPreview? _room;
  int? _team;

  bool _named = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // The host's name on this phone, once, as a start.
    if (!_named) {
      _named = true;
      _name.text = context.game.session.displayName ?? '';
    }
  }

  @override
  void dispose() {
    _code.dispose();
    _name.dispose();
    _focus.dispose();
    super.dispose();
  }

  bool get _complete => _code.text.length == JoinSheet.codeLength;

  /// The code is checked first: a wrong or full room says so before the
  /// player types a name.
  Future<void> _check() async {
    final lang = context.lang;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final room = await context.game.preview(_code.text);
      if (!mounted) return;
      setState(() {
        if (room.joinable) {
          _room = room;
        } else {
          _message = room.paused
              ? lang.t(
                  'السيرفر مش بيستقبل لاعبين جداد دلوقتي. جرّب تاني كمان شوية.',
                  'El server mesh besta2bel la3eebeen gdad delwa2ty. Garrab tany kaman shewaya.',
                )
              : room.availableSeats == 0
              ? lang.t(
                  'الغرفة اتملت. بتاخد ٥ لاعبين غير المضيف.',
                  'El oda etmalet. Betakhod 5 la3eebeen gheir el host.',
                )
              : lang.t(
                  'الغرفة دي مش بتستقبل لاعبين دلوقتي.',
                  'El oda di mesh betesta2bel la3eebeen delwa2ty.',
                );
        }
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _message = e.message(lang));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _join() async {
    final lang = context.lang;
    final game = context.game;
    final navigator = Navigator.of(context);
    final name = _name.text.trim();
    if (name.isEmpty || _team == null) {
      setState(
        () => _message = name.isEmpty
            ? lang.t('اكتب اسمك الأول.', 'Ekteb esmak el awel.')
            : lang.t('اختار فريقك.', 'Ekhtar fare2ak.'),
      );
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await game.join(code: _code.text, name: name, team: _team!);
      if (!mounted) return;
      navigator.pop();
      navigator.push(
        MaterialPageRoute(builder: (_) => const GuestRoomScreen()),
      );
    } on ApiError catch (e) {
      if (mounted) setState(() => _message = e.message(lang));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// The camera reads the host's QR; its code fills the boxes and is
  /// checked at once.
  Future<void> _scan() async {
    final code = await JoinScanner.scan(context);
    if (code == null || !mounted) return;
    _code.text = code;
    setState(() => _message = null);
    await _check();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final insets = MediaQuery.viewInsetsOf(context).bottom;
    final safe = MediaQuery.paddingOf(context).bottom;
    final room = _room;

    final Widget body;
    if (room == null) {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
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
            onSubmitted: _complete && !_busy ? _check : null,
          ),
          if (_message != null) _Message(_message!),
          const SizedBox(height: 20),
          Row(
            children: [
              Pressable(
                semanticLabel: lang.t('امسح الـQR', 'Emsa7 el QR'),
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
              const SizedBox(width: 12),
              Expanded(
                child: PlayButton(
                  height: 60,
                  onPressed: _complete && !_busy ? _check : null,
                  // No colour here: the button dims the label when disabled.
                  child: Text(
                    _busy
                        ? lang.t('ثانية…', 'Sanya…')
                        : lang.t('ادخل', 'Odkhol'),
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
      );
    } else {
      body = Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            lang.t('لقينا الغرفة!', 'La2eena el oda!'),
            style: AppText.display(28, height: 1.2),
          ),
          const SizedBox(height: 4),
          Text(
            lang.t(
              'في ${lang.toAr(room.availableSeats)} أماكن فاضية. اكتب اسمك واختار فريقك.',
              'Fe ${room.availableSeats} amaken fadya. Ekteb esmak w ekhtar fare2ak.',
            ),
            style: AppText.sans(
              14,
              color: AppColors.ivory.withValues(alpha: 0.7),
            ),
          ),
          const SizedBox(height: 16),
          SahsahField(
            fieldKey: const ValueKey('join-name'),
            label: lang.t('اسمك', 'Esmak'),
            hint: lang.t('اسمك اللي هيظهر للكل', 'Esmak elly hayezhar lel kol'),
            controller: _name,
            maxLength: 80,
            autofillHints: const [AutofillHints.nickname],
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var t = 0; t < 2; t++) ...[
                if (t > 0) const SizedBox(width: 10),
                Expanded(
                  child: GameButton(
                    key: ValueKey('join-team-$t'),
                    height: 56,
                    radius: 16,
                    depth: _team == t ? 6 : 3,
                    color: _team == t ? teamColors[t] : AppColors.paper,
                    semanticLabel: room.teamNames[t],
                    onTap: () => setState(() {
                      _team = t;
                      _message = null;
                    }),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (_team == t) ...[
                          const Icon(
                            LucideIcons600.check,
                            size: 18,
                            color: AppColors.ink,
                          ),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(
                            room.teamNames[t],
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.display(
                              20,
                              height: 1.2,
                              color: AppColors.ink,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
          if (_message != null) _Message(_message!),
          const SizedBox(height: 18),
          PlayButton(
            key: const ValueKey('join-go'),
            height: 58,
            onPressed: _busy ? null : _join,
            child: Text(
              _busy ? lang.t('ثانية…', 'Sanya…') : lang.t('يلا', 'Yalla'),
              style: const TextStyle(
                fontFamily: AppFonts.sans,
                fontSize: 20,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      );
    }

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
              body,
            ],
          ),
        ),
      ),
    );
  }
}

/// What the server said about the code, or what's missing.
class _Message extends StatelessWidget {
  const _Message(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Semantics(
        liveRegion: true,
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: AppText.sans(
            13,
            weight: FontWeight.w600,
            color: AppColors.gold,
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
      duration: motionFor(context, const Duration(milliseconds: 140)),
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
