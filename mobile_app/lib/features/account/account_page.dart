import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/game_button.dart';
import '../../data/shop.dart';
import '../game/board_screen.dart';
import '../game/game_controller.dart';
import '../game/setup_screen.dart';
import '../game/ui/game_ui.dart';
import '../shared/form_widgets.dart';

/// Account: playing as a guest, signing in with a WhatsApp code
/// (prototype `AccountPage` and `LoginPage`), and your games on this
/// phone. Sign-in isn't in the backend yet, so sending the code explains
/// that instead of pretending.
class AccountPage extends StatefulWidget {
  const AccountPage({super.key});

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _send() {
    final lang = context.lang;
    String? error;
    if (_name.text.trim().length < 2) {
      error = lang.t('اكتب اسمك.', 'Ekteb esmak.');
    } else if (!isEgyptianMobile(_phone.text)) {
      error = lang.t(
        'رقم موبايل مصري مش صح. مثال: ٠١٢٠ ٠٠٠ ٠٠٠٠',
        'Raqam mobile masry mesh sa7. Masalan: 0120 000 0000',
      );
    }
    setState(() => _error = error);
    if (error != null) return;
    showNoticeSheet(
      context,
      icon: LucideIcons600.messageCircle,
      title: lang.t('تسجيل الدخول جاي قريب', 'Tasgeel el dokhool gay 2orayeb'),
      message: lang.t(
        'الكود على واتساب هيشتغل مع الحسابات في المرحلة الجاية. لحد كده تقدر تلعب كضيف، ولعبتك بتتحفظ على الموبايل ده.',
        'El code 3al WhatsApp hayeshtaghal ma3 el 7esabat fel mar7ala el gaya. Le7ad keda te2dar tel3ab ka deif, w le3betak btet7efez 3al mobile da.',
      ),
      actionLabel: lang.t('العب دلوقتي', 'El3ab delwa2ty'),
      onAction: () {
        if (mounted) openSetup(context);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;

    final guest = PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.ui,
                  border: Border.all(color: AppColors.gold, width: 2),
                ),
                child: const Icon(
                  LucideIcons.userRound,
                  size: 26,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      lang.t('إنت بتلعب كضيف', 'Enta betel3ab ka deif'),
                      style: AppText.display(22, height: 1.2),
                    ),
                    Text(
                      lang.t('سجّل دخولك عشان:', 'Sagel dokhoolak 3ashan:'),
                      style: AppText.sans(13, color: context.mutedText),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          for (final (icon, text) in [
            (
              LucideIcons.coins,
              lang.t('رصيدك يفضل معاك', 'Rasidak yefdal ma3ak'),
            ),
            (
              LucideIcons.history,
              lang.t(
                'ألعابك تتحفظ على أي موبايل',
                'Al3abak tet7efez 3ala ay mobile',
              ),
            ),
            (
              LucideIcons.gift,
              lang.t('تستلم هدايا من صحابك', 'Testelem hadaya men s7abak'),
            ),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Icon(icon, size: 16, color: context.accentText),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      text,
                      style: AppText.sans(14, weight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );

    final signIn = PanelCard(
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              lang.t('سجّل دخولك', 'Sagel dokhoolak'),
              style: AppText.display(24, height: 1.2),
            ),
            const SizedBox(height: 10),
            SahsahField(
              fieldKey: const ValueKey('account-name'),
              label: lang.t('الاسم', 'El esm'),
              controller: _name,
              maxLength: 40,
              autofillHints: const [AutofillHints.name],
            ),
            const SizedBox(height: 10),
            SahsahField(
              fieldKey: const ValueKey('account-phone'),
              label: lang.t('رقم الموبايل', 'Raqam el mobile'),
              controller: _phone,
              hint: '010 000 0000',
              ltr: true,
              keyboardType: TextInputType.phone,
              maxLength: 16,
              autofillHints: const [AutofillHints.telephoneNumber],
            ),
            FormError(_error),
            const SizedBox(height: 14),
            GameButton(
              height: 52,
              radius: 16,
              color: AppColors.green,
              onTap: _send,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    LucideIcons600.messageCircle,
                    size: 19,
                    color: AppColors.ink,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      lang.t(
                        'ابعت الكود على واتساب',
                        'Eb3at el code 3al WhatsApp',
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.sans(
                        16,
                        weight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    final games = _YourGames();

    return LayoutBuilder(
      builder: (context, box) {
        if (box.maxWidth > 700) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [guest, const SizedBox(height: 14), games],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(child: signIn),
            ],
          );
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            guest,
            const SizedBox(height: 14),
            signIn,
            const SizedBox(height: 14),
            games,
          ],
        );
      },
    );
  }
}

/// The game saved on this phone, or an empty state with a play button.
class _YourGames extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final controller = context.game;
    final game = controller.hasActiveGame ? controller.game : null;

    return PanelCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            lang.t('ألعابك', 'Al3abak'),
            style: AppText.display(22, height: 1.2),
          ),
          const SizedBox(height: 10),
          if (game == null)
            Row(
              children: [
                Expanded(
                  child: Text(
                    lang.t(
                      'مفيش لعبة شغالة. أول لعبة هتظهر هنا.',
                      'Mafeesh le3ba shaghala. Awel le3ba hatezhar hena.',
                    ),
                    style: AppText.sans(14, color: context.mutedText),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  width: 120,
                  child: GameButton(
                    height: 44,
                    radius: 14,
                    depth: 5,
                    color: AppColors.play,
                    onTap: () => openSetup(context),
                    child: Text(
                      lang.t('العب', 'El3ab'),
                      style: AppText.sans(
                        16,
                        weight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            )
          else
            _GameRow(game: game),
        ],
      ),
    );
  }
}

class _GameRow extends StatelessWidget {
  const _GameRow({required this.game});

  final Game game;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return GameButton(
      height: 60,
      radius: 16,
      depth: 5,
      color: AppColors.ink,
      borderColor: AppColors.cyan.withValues(alpha: 0.7),
      onTap: () => Navigator.of(
        context,
      ).push(MaterialPageRoute(builder: (_) => const BoardScreen())),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(
          children: [
            const Icon(Icons.play_arrow_rounded, size: 26, color: Colors.white),
            const SizedBox(width: 8),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: [
                    for (var t = 0; t < 2; t++) ...[
                      if (t > 0) const TextSpan(text: '  ·  '),
                      TextSpan(
                        text: '${game.teamNames[t]} ',
                        style: AppText.sans(14, weight: FontWeight.w700),
                      ),
                      TextSpan(
                        text: lang.toAr(game.scores[t]),
                        style: AppText.num(15, color: teamColors[t]),
                      ),
                    ],
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Text(
              lang.t(
                '${lang.toAr(game.resolvedCount)} من ${lang.toAr(game.totalQuestions)}',
                '${game.resolvedCount} men ${game.totalQuestions}',
              ),
              style: AppText.sans(12, color: context.mutedText),
            ),
          ],
        ),
      ),
    );
  }
}
