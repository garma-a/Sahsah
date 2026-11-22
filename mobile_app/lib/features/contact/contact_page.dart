import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/game_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../../data/shop.dart';
import '../shared/form_widgets.dart';
import '../shell/link_opener.dart';
import '../../core/ui/motion.dart';

/// The three ways to reach the team (prototype `ContactPage`).
enum ContactTab { support, experience, business }

/// Contact: a problem, feedback, or business/influencers. The support
/// inbox isn't in the backend yet, so sending explains that and points to
/// the social accounts instead of losing the message silently.
class ContactPage extends StatefulWidget {
  const ContactPage({super.key, this.tab = ContactTab.support});

  final ContactTab tab;

  @override
  State<ContactPage> createState() => _ContactPageState();
}

class _ContactPageState extends State<ContactPage> {
  late ContactTab _tab = widget.tab;
  String _reason = 'technical';
  String _kind = 'business';
  int _rating = 0;
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _handle = TextEditingController();
  final _message = TextEditingController();
  String? _error;

  @override
  void dispose() {
    for (final c in [_name, _email, _handle, _message]) {
      c.dispose();
    }
    super.dispose();
  }

  void _clearError() {
    if (_error != null) setState(() => _error = null);
  }

  void _send() {
    final lang = context.lang;
    String? error;
    if (_tab == ContactTab.experience) {
      if (_rating == 0 && _message.text.trim().isEmpty) {
        error = lang.t(
          'قيّم التجربة أو اكتب رأيك.',
          'Qayyem el tagroba aw ekteb ra2yak.',
        );
      }
    } else if (!isEmail(_email.text)) {
      error = lang.t(
        'اكتب إيميل صحيح عشان نرد عليك.',
        'Ekteb email sa7 3ashan nerod 3aleek.',
      );
    } else if (_message.text.trim().length < 5) {
      error = lang.t('اكتب رسالتك.', 'Ekteb resaltak.');
    }
    setState(() => _error = error);
    if (error != null) return;
    showNoticeSheet(
      context,
      icon: LucideIcons600.mail,
      title: lang.t('الإرسال جاي قريب', 'El ersal gay 2orayeb'),
      message: lang.t(
        'صندوق الرسايل بتاع فريق صح صح لسه بيتجهز، فرسالتك ما اتبعتتش. لحد ما يشتغل، كلمنا على السوشيال.',
        'Sandoo2 el rasayel bta3 team Sa7Sa7 lessa beyetgahez, fa resaltak mat-ba3atetsh. Le7ad ma yeshtaghal, kalemna 3al social.',
      ),
      actionLabel: Social.instagram.label,
      onAction: () => openExternal(Social.instagram.url),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;

    final tabs = ChoicePills<ContactTab>(
      options: [
        (
          ContactTab.support,
          lang.t('عندك مشكلة؟', '3andak moshkela?'),
          LucideIcons.wrench,
        ),
        (
          ContactTab.experience,
          lang.t('شاركنا تجربتك', 'Sharekna tagrobtak'),
          LucideIcons.messageCircleHeart,
        ),
        (
          ContactTab.business,
          lang.t('بيزنس ومؤثرين', 'Business w Influencers'),
          LucideIcons.handshake,
        ),
      ],
      selected: _tab,
      onSelect: (t) => setState(() {
        _tab = t;
        _error = null;
      }),
    );

    final Widget topic = switch (_tab) {
      ContactTab.support => _Labelled(
        label: lang.t('نوع المشكلة', 'No3 el moshkela'),
        child: ChoicePills<String>(
          options: [
            ('technical', lang.t('مشكلة تقنية', 'Moshkela te2neya'), null),
            ('purchase', lang.t('في الشراء', 'Fel shera2'), null),
            ('account', lang.t('في الحساب', 'Fel 7esab'), null),
          ],
          selected: _reason,
          onSelect: (v) => setState(() => _reason = v),
        ),
      ),
      ContactTab.experience => _Labelled(
        label: lang.t('إيه رأيك في صح صح؟', 'Eh ra2yak fe Sa7Sa7?'),
        child: _Rating(
          value: _rating,
          onChanged: (v) => setState(() {
            _rating = v;
            _error = null;
          }),
        ),
      ),
      ContactTab.business => _Labelled(
        label: lang.t('إنت…', 'Enta…'),
        child: ChoicePills<String>(
          options: [
            ('business', lang.t('شركة / مكان', 'Sherka / makan'), null),
            (
              'influencer',
              lang.t('مؤثر / صانع محتوى', 'Influencer / content creator'),
              null,
            ),
          ],
          selected: _kind,
          onSelect: (v) => setState(() => _kind = v),
        ),
      ),
    };

    final form = PanelCard(
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            topic,
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: SahsahField(
                    label: lang.t('الاسم', 'El esm'),
                    controller: _name,
                    maxLength: 60,
                    autofillHints: const [AutofillHints.name],
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SahsahField(
                    fieldKey: const ValueKey('contact-email'),
                    label: lang.t('الإيميل', 'El email'),
                    optional: _tab == ContactTab.experience,
                    controller: _email,
                    ltr: true,
                    keyboardType: TextInputType.emailAddress,
                    maxLength: 120,
                    autofillHints: const [AutofillHints.email],
                    onChanged: (_) => _clearError(),
                  ),
                ),
              ],
            ),
            if (_tab == ContactTab.business) ...[
              const SizedBox(height: 10),
              SahsahField(
                label: _kind == 'influencer'
                    ? lang.t('حسابك على السوشيال', 'Account el social')
                    : lang.t('اسم الشركة', 'Esm el sherka'),
                controller: _handle,
                maxLength: 80,
              ),
            ],
            const SizedBox(height: 10),
            SahsahField(
              fieldKey: const ValueKey('contact-message'),
              label: _tab == ContactTab.experience
                  ? lang.t('رأيك', 'Ra2yak')
                  : lang.t('رسالتك', 'Resaltak'),
              optional: _tab == ContactTab.experience,
              controller: _message,
              maxLines: 3,
              maxLength: 1000,
              onChanged: (_) => _clearError(),
            ),
            FormError(_error),
            const SizedBox(height: 14),
            GameButton(
              height: 52,
              radius: 16,
              color: AppColors.play,
              onTap: _send,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    LucideIcons600.send,
                    size: 19,
                    color: Colors.white,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    lang.t('ابعت', 'Eb3at'),
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
        ),
      ),
    );

    return LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth > 700;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            tabs,
            const SizedBox(height: 16),
            if (wide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(width: 250, child: _ReachUs()),
                  const SizedBox(width: 16),
                  Expanded(child: form),
                ],
              )
            else ...[
              const _ReachUs(),
              const SizedBox(height: 14),
              form,
            ],
          ],
        );
      },
    );
  }
}

class _Labelled extends StatelessWidget {
  const _Labelled({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: AppText.sans(13, weight: FontWeight.w700)),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

/// Five faces, from unhappy to delighted.
class _Rating extends StatelessWidget {
  const _Rating({required this.value, required this.onChanged});

  final int value;
  final ValueChanged<int> onChanged;

  static const _faces = ['😕', '😐', '🙂', '😄', '🤩'];

  /// What each face says, for screen readers.
  static const _moods = [
    ('وحشة', 'we7sha'),
    ('مش أوي', 'mesh awy'),
    ('حلوة', '7elwa'),
    ('حلوة أوي', '7elwa awy'),
    ('تحفة', 'to7fa'),
  ];

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Row(
      children: [
        for (final (i, face) in _faces.indexed) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(
            child: Pressable(
              // "٢ من ٥، مش أوي", not "2/5".
              semanticLabel: lang.t(
                '${lang.toAr(i + 1)} من ٥، ${_moods[i].$1}',
                '${i + 1} men 5, ${_moods[i].$2}',
              ),
              selected: value == i + 1,
              onTap: () => onChanged(i + 1),
              child: AnimatedContainer(
                duration: motionFor(context, const Duration(milliseconds: 160)),
                height: 50,
                alignment: Alignment.center,
                decoration: value == i + 1
                    ? BoxDecoration(
                        color: AppColors.gold,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.ink, width: 2.5),
                        boxShadow: [inkDrop(3)],
                      )
                    : paperDecoration(
                        radius: BorderRadius.circular(14),
                        color: Colors.white,
                        border: 2.5,
                        drop: 0,
                      ),
                child: Text(face, style: const TextStyle(fontSize: 24)),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Artwork with "talk to us" and the social accounts.
class _ReachUs extends StatelessWidget {
  const _ReachUs();

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final radius = BorderRadius.circular(22);
    return Container(
      height: 250,
      decoration: BoxDecoration(
        borderRadius: radius,
        border: Border.all(color: AppColors.ink, width: 3),
        boxShadow: [inkDrop(5)],
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: Stack(
          fit: StackFit.expand,
          children: [
            Image.asset(
              BrandImages.contact,
              fit: BoxFit.cover,
              alignment: Alignment.centerLeft,
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [AppColors.card, Color(0x0022160E)],
                  stops: [0.35, 1],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lang.t('كلمنا', 'Kalemna'),
                    style: AppText.display(
                      32,
                      height: 1.1,
                      color: AppColors.ivory,
                    ),
                  ),
                  // Sending isn't open yet (the form says so), so this points
                  // at the icons just below instead of promising. It gives
                  // up lines first when the panel is short.
                  Flexible(
                    child: Text(
                      lang.t(
                        'لحد ما صندوق الرسايل يشتغل، كلمنا على السوشيال.',
                        'Le7ad ma sandoo2 el rasayel yeshtaghal, kallemna 3al social.',
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.sans(
                        13,
                        color: AppColors.ivory.withValues(alpha: 0.75),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Full 48px circles; the gaps give way first on a narrow panel.
                  LayoutBuilder(
                    builder: (context, box) {
                      final gap =
                          ((box.maxWidth - Social.values.length * 48) /
                                  (Social.values.length - 1))
                              .clamp(0.0, 8.0);
                      return FittedBox(
                        fit: BoxFit.scaleDown,
                        alignment: AlignmentDirectional.centerStart,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (final social in Social.values) ...[
                              if (social != Social.values.first)
                                SizedBox(width: gap),
                              // One named link, a full 48px target.
                              Pressable(
                                semanticLabel: social.label,
                                link: true,
                                onTap: () => openExternal(social.url),
                                child: Container(
                                  width: 48,
                                  height: 48,
                                  alignment: Alignment.center,
                                  decoration: paperDecoration(
                                    shape: BoxShape.circle,
                                    border: 2.5,
                                    drop: 3,
                                  ),
                                  child: SocialIcon(
                                    social,
                                    size: 20,
                                    color: AppColors.ink,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
