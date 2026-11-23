import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/api/game_wire.dart';
import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/scan_code.dart';
import '../../core/ui/surfaces.dart';
import 'board_screen.dart';
import 'game_controller.dart';
import 'ui/game_ui.dart';

/// The host's room before the game: the code and QR players join with,
/// the two teams filling up, and the start once everyone who joined is
/// ready (the website's host lobby). Live: joins and "ready" arrive over
/// the room's socket.
class HostLobbyScreen extends StatefulWidget {
  const HostLobbyScreen({super.key});

  @override
  State<HostLobbyScreen> createState() => _HostLobbyScreenState();
}

class _HostLobbyScreenState extends State<HostLobbyScreen> {
  GameController? _game;
  bool _left = false;

  @override
  void initState() {
    super.initState();
    // The phone stays awake while players scan its code.
    WakelockPlus.enable().ignore();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final game = context.game;
    if (game == _game) return;
    _game?.removeListener(_check);
    _game = game..addListener(_check);
    _check();
  }

  @override
  void dispose() {
    _game?.removeListener(_check);
    WakelockPlus.disable().ignore();
    super.dispose();
  }

  /// The game started (here, or already when the lobby opened): the board
  /// takes over.
  void _check() {
    final game = _game;
    if (_left || game == null || game.lobby != null || !game.hasActiveGame) {
      return;
    }
    _left = true;
    // Not while building: when the lobby opens on a started game.
    if (SchedulerBinding.instance.schedulerPhase ==
        SchedulerPhase.persistentCallbacks) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _toBoard());
    } else {
      _toBoard();
    }
  }

  void _toBoard() {
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const BoardScreen()));
  }

  /// Removing a player asks first: it takes them out of the room.
  Future<void> _remove(Member member) async {
    final lang = context.lang;
    final game = context.game;
    final ok = await confirmDialog(
      context,
      title: lang.t(
        'تشيل ${member.displayName} من الغرفة؟',
        'Tsheel ${member.displayName} men el oda?',
      ),
      message: lang.t(
        'هيخرج من الغرفة دلوقتي، ويقدر يدخل تاني بالكود.',
        'Hayokhrog men el oda delwa2ty, w ye2dar yedkhol tany bel code.',
      ),
      confirm: lang.t('شيله', 'Sheelo'),
      cancel: lang.t('خليه', 'Khaleeh'),
      destructive: true,
    );
    if (ok && mounted) await game.removePlayer(member.id);
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final lobby = game.lobby;
    if (lobby == null) {
      return GameScaffold(tv: true, child: _Waiting(gone: !game.hasRoom));
    }
    final invitation = game.invitation;
    final players = lobby.players;
    final waiting = players.where((m) => !m.ready).length;
    final status = players.isEmpty
        ? lang.t(
            'لسه محدش دخل. استنوا اللاعبين أو ابدأوا.',
            'Lessa ma7adsh dakhal. Estanno el la3eebeen aw ebda2o.',
          )
        : waiting > 0
        ? lang.t(
            'لسه ${lang.toAr(waiting)} من اللاعبين مش جاهزين',
            'Lessa $waiting mesh gahzeen',
          )
        : lang.t('كله جاهز. يلا نبدأ!', 'Kollo gahez. Yalla nebda2!');

    final invite = Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: paperDecoration(radius: BorderRadius.circular(22)),
      child: DefaultTextStyle.merge(
        style: const TextStyle(color: AppColors.ink),
        child: Column(
          children: [
            Text(
              lang.t('ادخلوا بالكود', 'Odkholo bel code'),
              style: AppText.display(20, height: 1.2, color: AppColors.ink),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ScanCode(
                data: invitation?.joinUrl,
                codeKey: const ValueKey('join-qr'),
                semanticLabel: lang.t(
                  'كود QR للانضمام للغرفة',
                  'QR code lel endemam lel oda',
                ),
              ),
            ),
            const SizedBox(height: 8),
            // The six digits, readable from across the room.
            Semantics(
              label: invitation == null
                  ? lang.t('بنجهّز الكود', 'Bengahhez el code')
                  : lang.t(
                      'كود الغرفة ${invitation.code.split('').join(' ')}',
                      'Code el oda ${invitation.code.split('').join(' ')}',
                    ),
              excludeSemantics: true,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  invitation == null ? '••••••' : lang.toAr(invitation.code),
                  key: const ValueKey('join-code-digits'),
                  textDirection: TextDirection.ltr,
                  style: AppText.num(
                    40,
                    color: AppColors.ink,
                    height: 1.1,
                  ).copyWith(letterSpacing: 6),
                ),
              ),
            ),
          ],
        ),
      ),
    );

    final teams = Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var t = 0; t < 2; t++) ...[
          if (t > 0) const SizedBox(width: 12),
          Expanded(
            child: TeamRoster(
              name: lobby.teamNames[t],
              color: teamColors[t],
              members: [
                for (final m in players)
                  if (m.teamNumber == t + 1) m,
              ],
              connected: game.connected,
              onRemove: game.busy ? null : (m) => _remove(m),
            ),
          ),
        ],
      ],
    );

    final start = PlayButton(
      key: const ValueKey('lobby-start'),
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 22),
      onPressed: lobby.everyoneReady && !game.busy ? game.startGame : null,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.play_arrow_rounded, size: 26),
          const SizedBox(width: 6),
          Text(
            game.busy
                ? lang.t('ثانية…', 'Sanya…')
                : lang.t('ابدأ اللعبة', 'Ebda2 el le3ba'),
            style: const TextStyle(
              fontFamily: AppFonts.sans,
              fontSize: 19,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );

    return GameScaffold(
      tv: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(width: 250, child: invite),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      RoundIconButton(
                        icon: lang.ar
                            ? LucideIcons.arrowRight
                            : LucideIcons.arrowLeft,
                        label: lang.t('رجوع', 'Rogoo3'),
                        onTap: () => Navigator.of(context).maybePop(),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          lang.t('غرفة اللعب', 'Oodet el le3b'),
                          style: AppText.display(26, height: 1.2),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Expanded(child: teams),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          status,
                          key: const ValueKey('lobby-status'),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.display(18, height: 1.3),
                        ),
                      ),
                      const SizedBox(width: 12),
                      start,
                    ],
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

/// A team's card in a lobby: its name on a ribbon of its colour, then the
/// players who joined it with their "ready" mark and whether their phone is
/// connected. [onJoin] (a player's lobby) makes the card the button that
/// moves them onto this team.
class TeamRoster extends StatelessWidget {
  const TeamRoster({
    super.key,
    required this.name,
    required this.color,
    required this.members,
    required this.connected,
    this.mine = false,
    this.onJoin,
    this.meId,
    this.onRemove,
  });

  final String name;
  final Color color;
  final List<Member> members;
  final Set<String> connected;

  /// The player looking at it is on this team.
  final bool mine;
  final VoidCallback? onJoin;
  final String? meId;

  /// The host's lobby: each player gets a button that removes them.
  final ValueChanged<Member>? onRemove;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final card = Container(
      padding: const EdgeInsets.all(10),
      decoration: paperDecoration(
        radius: BorderRadius.circular(18),
        drop: mine ? 6 : 4,
        border: mine ? 4 : 3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.ink, width: 2.5),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(
                      20,
                      height: 1.25,
                      color: AppColors.inkOn(color),
                    ),
                  ),
                ),
                if (onJoin != null || mine)
                  Text(
                    mine ? lang.t('فريقك', 'Fare2ak') : lang.t('انضم', 'Endam'),
                    style: AppText.sans(
                      13,
                      weight: FontWeight.w700,
                      color: AppColors.inkOn(color),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: members.isEmpty
                ? Center(
                    child: Text(
                      lang.t('مستنيين أول لاعب', 'Mestanyeen awel la3eb'),
                      textAlign: TextAlign.center,
                      style: AppText.sans(14, color: AppColors.inkMuted),
                    ),
                  )
                : ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      for (final m in members) ...[
                        _MemberRow(
                          member: m,
                          online: connected.contains(m.id),
                          me: m.id == meId,
                          onRemove: onRemove == null
                              ? null
                              : () => onRemove!(m),
                        ),
                        const SizedBox(height: 6),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
    if (onJoin == null) return card;
    return Semantics(
      button: true,
      selected: mine,
      label: mine
          ? lang.t('فريقك: $name', 'Fare2ak: $name')
          : lang.t('انضم لـ$name', 'Endam le $name'),
      child: GestureDetector(onTap: onJoin, child: card),
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    required this.online,
    required this.me,
    this.onRemove,
  });

  final Member member;
  final bool online;
  final bool me;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.ink, width: 2),
      ),
      child: Row(
        children: [
          // Connected (green) or not (grey).
          Semantics(
            label: online
                ? lang.t('متصل', 'Mettasel')
                : lang.t('مش متصل', 'Mesh mettasel'),
            child: Container(
              width: 9,
              height: 9,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: online
                    ? AppColors.green
                    : AppColors.ink.withValues(alpha: 0.25),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              me
                  ? lang.t(
                      '${member.displayName} (إنت)',
                      '${member.displayName} (enta)',
                    )
                  : member.displayName,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.sans(
                15,
                weight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: member.ready
                  ? AppColors.green
                  : AppColors.ink.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  member.ready ? LucideIcons600.check : LucideIcons.clock,
                  size: 13,
                  color: AppColors.ink,
                ),
                const SizedBox(width: 4),
                Text(
                  member.ready
                      ? lang.t('جاهز', 'Gahez')
                      : lang.t('مستنيينه', 'Mestanyeeno'),
                  style: AppText.sans(
                    12,
                    weight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
              ],
            ),
          ),
          // The host's way to take a player out: a 44px target around a
          // small mark, so it isn't hit by accident.
          if (onRemove != null)
            Pressable(
              key: ValueKey('remove-${member.id}'),
              semanticLabel: lang.t(
                'شيل ${member.displayName}',
                'Sheel ${member.displayName}',
              ),
              onTap: onRemove,
              child: const SizedBox(
                width: 40,
                height: 36,
                child: Center(
                  child: Icon(
                    LucideIcons.userX,
                    size: 18,
                    color: AppColors.inkMuted,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// No lobby to show: still loading it, or the room is gone.
class _Waiting extends StatelessWidget {
  const _Waiting({required this.gone});

  final bool gone;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (gone) ...[
            Text(
              lang.t('الغرفة اتقفلت', 'El oda et2afalet'),
              style: AppText.display(26),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: 220,
              child: GoldButton(
                label: lang.t('الرئيسية', 'El re2eseya'),
                icon: LucideIcons600.house,
                onTap: () => Navigator.of(context).popUntil((r) => r.isFirst),
              ),
            ),
          ] else ...[
            const SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(
                strokeWidth: 3,
                color: AppColors.gold,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              lang.t('بنفتح الغرفة…', 'Benfta7 el oda…'),
              style: AppText.display(22),
            ),
          ],
        ],
      ),
    );
  }
}
