import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../../core/api/game_wire.dart';
import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/play_button.dart';
import 'board_screen.dart';
import 'game_controller.dart';
import '../../core/ui/motion.dart';
import 'lobby_screen.dart' show TeamRoster;
import 'question_screen.dart';
import 'results_screen.dart';
import 'ui/game_ui.dart';

/// A player's phone in someone else's room. It follows the room as the
/// server pushes it: the lobby (pick a team, say ready), then the board,
/// the open question and its answer, and the result. Only the host acts on
/// the game; the player watches it here.
class GuestRoomScreen extends StatefulWidget {
  const GuestRoomScreen({super.key});

  @override
  State<GuestRoomScreen> createState() => _GuestRoomScreenState();
}

class _GuestRoomScreenState extends State<GuestRoomScreen> {
  @override
  void initState() {
    super.initState();
    WakelockPlus.enable().ignore();
  }

  @override
  void dispose() {
    WakelockPlus.disable().ignore();
    super.dispose();
  }

  Future<void> _leave() async {
    final lang = context.lang;
    final game = context.game;
    // Nothing to leave: just go (a plain pop; the back guard would ask
    // again).
    if (!game.hasRoom) {
      Navigator.of(context).pop();
      return;
    }
    final ok = await confirmDialog(
      context,
      title: lang.t('تسيب الغرفة؟', 'Tseeb el oda?'),
      message: lang.t(
        'هتخرج من الغرفة، وعشان ترجع هتحتاج الكود تاني.',
        'Hatokhrog men el oda, w 3ashan terga3 hate7tag el code tany.',
      ),
      confirm: lang.t('اخرج', 'Okhrog'),
      cancel: lang.t('خليني', 'Khaleeny'),
      destructive: true,
    );
    if (!ok || !mounted) return;
    await game.leaveRoom();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final game = context.game;
    final lobby = game.lobby;
    final state = game.game;
    final Widget page;
    if (game.replaced) {
      page = const _Notice(kind: _NoticeKind.replaced);
    } else if (!game.hasRoom) {
      page = const _Notice(kind: _NoticeKind.gone);
    } else if (lobby != null) {
      page = PlayerLobby(lobby: lobby, onLeave: _leave);
    } else if (state == null) {
      page = const _Notice(kind: _NoticeKind.loading);
    } else if (state.finished) {
      page = const ResultsScreen();
    } else if (state.activeId case final id?) {
      page = QuestionScreen(key: ValueKey(id), questionId: id);
    } else {
      page = _ViewerBoard(game: state, onLeave: _leave);
    }
    return PopScope(
      canPop: !game.hasRoom || game.replaced,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: AnimatedSwitcher(
        duration: motionFor(context, const Duration(milliseconds: 220)),
        child: KeyedSubtree(key: ValueKey(page.runtimeType), child: page),
      ),
    );
  }
}

/// The lobby on a player's phone: pick a team, say ready, watch who else
/// is in (the website's player lobby).
class PlayerLobby extends StatelessWidget {
  const PlayerLobby({super.key, required this.lobby, required this.onLeave});

  final LobbyView lobby;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final game = context.game;
    final me = game.me;
    final players = lobby.players;
    final ready = players.where((m) => m.ready).length;
    return GameScaffold(
      tv: true,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                RoundIconButton(
                  icon: LucideIcons.x,
                  label: lang.t('اخرج من الغرفة', 'Okhrog men el oda'),
                  onTap: onLeave,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    me == null
                        ? lang.t('بنجهّز مكانك…', 'Bengahhez makanak…')
                        : lang.t(
                            'أهلًا ${me.displayName}! اختار فريقك',
                            'Ahlan ${me.displayName}! Ekhtar fare2ak',
                          ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.display(24, height: 1.2),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Expanded(
              child: Row(
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
                        mine: me?.teamNumber == t + 1,
                        meId: me?.id,
                        onJoin: me == null || game.busy
                            ? null
                            : () {
                                HapticFeedback.selectionClick();
                                game.setTeam(t);
                              },
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Text(
                    lang.t(
                      '${lang.toAr(ready)} من ${lang.toAr(players.length)} جاهزين. المضيف هو اللي هيبدأ اللعبة.',
                      '$ready men ${players.length} gahzeen. El host howa elly hayebda2 el le3ba.',
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.sans(15, weight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 12),
                PlayButton(
                  key: const ValueKey('player-ready'),
                  height: 54,
                  padding: const EdgeInsets.symmetric(horizontal: 22),
                  ringColor: me?.ready ?? false
                      ? AppColors.green
                      : AppColors.cyan,
                  onPressed: me == null || me.teamNumber == null || game.busy
                      ? null
                      : game.toggleReady,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        me?.ready ?? false
                            ? LucideIcons600.check
                            : LucideIcons600.handshake,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        me?.ready ?? false
                            ? lang.t('جاهز (اضغط تلغي)', 'Gahez (edghat tlghy)')
                            : lang.t('أنا جاهز', 'Ana gahez'),
                        style: const TextStyle(
                          fontFamily: AppFonts.sans,
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The board on a player's phone: the scores and the packs, shown only.
class _ViewerBoard extends StatelessWidget {
  const _ViewerBoard({required this.game, required this.onLeave});

  final Game game;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return GameScaffold(
      tv: true,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: Row(
              children: [
                RoundIconButton(
                  icon: LucideIcons.x,
                  label: lang.t('اخرج من الغرفة', 'Okhrog men el oda'),
                  onTap: onLeave,
                ),
                const SizedBox(width: 8),
                Expanded(child: TeamScore(game: game, team: 0)),
                const SizedBox(width: 8),
                Expanded(child: TeamScore(game: game, team: 1)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              lang.t(
                'المضيف بيختار السؤال الجاي…',
                'El host beyekhtar el so2al el gay…',
              ),
              style: AppText.sans(14, weight: FontWeight.w600),
            ),
          ),
          Expanded(child: BoardGrid(game: game)),
        ],
      ),
    );
  }
}

enum _NoticeKind { loading, gone, replaced }

class _Notice extends StatelessWidget {
  const _Notice({required this.kind});

  final _NoticeKind kind;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final (title, text) = switch (kind) {
      _NoticeKind.loading => (lang.t('بنفتح الغرفة…', 'Benfta7 el oda…'), null),
      _NoticeKind.gone => (
        lang.t('الغرفة اتقفلت', 'El oda et2afalet'),
        lang.t(
          'المضيف قفلها أو شالك منها. تقدر تدخل بكود جديد.',
          'El host 2afalha aw shalak menha. Te2dar todkhol be code gdeed.',
        ),
      ),
      _NoticeKind.replaced => (
        lang.t(
          'الغرفة اتفتحت على جهاز تاني',
          'El oda etfata7et 3ala gehaz tany',
        ),
        lang.t(
          'وقفنا العرض هنا عشان مكانك مفتوح في مكان تاني.',
          'Wa22afna el 3ard hena 3ashan makanak maftoo7 fe makan tany.',
        ),
      ),
    };
    return GameScaffold(
      tv: true,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (kind == _NoticeKind.loading) ...[
                const SizedBox(
                  width: 30,
                  height: 30,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: AppColors.gold,
                  ),
                ),
                const SizedBox(height: 14),
              ],
              Text(title, style: AppText.display(26)),
              if (text != null) ...[
                const SizedBox(height: 6),
                Text(
                  text,
                  textAlign: TextAlign.center,
                  style: AppText.sans(
                    15,
                    color: AppColors.ivory.withValues(alpha: 0.8),
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: 220,
                  child: GoldButton(
                    label: lang.t('الرئيسية', 'El re2eseya'),
                    icon: LucideIcons600.house,
                    onTap: () =>
                        Navigator.of(context).popUntil((r) => r.isFirst),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
