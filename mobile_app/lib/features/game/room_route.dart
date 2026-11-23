import 'package:flutter/material.dart';

import 'board_screen.dart';
import 'game_controller.dart';
import 'guest_room_screen.dart';
import 'lobby_screen.dart';
import 'results_screen.dart';

/// Opens the room this phone holds where it stands: a player's room, the
/// host's lobby, the board, or the result.
Future<void> openHeldRoom(BuildContext context) {
  final game = context.game;
  final Widget page = game.isGuest
      ? const GuestRoomScreen()
      : game.lobby != null
      ? const HostLobbyScreen()
      : (game.game?.finished ?? false)
      ? const ResultsScreen()
      : const BoardScreen();
  return Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));
}
