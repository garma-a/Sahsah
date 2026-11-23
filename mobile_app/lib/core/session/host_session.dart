import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/sahsah_api.dart';
import '../api/wire.dart';

/// This phone's host sign-in. Until real accounts exist it is the preview
/// sign-in (ADR 0017): the shared passcode once per device, then a 30-day
/// credential the app renews in its last week.
class HostSession extends ChangeNotifier {
  HostSession(this._api, [this._prefs, DateTime Function()? now])
    : _now = now ?? DateTime.now {
    final raw = _prefs?.getString(storageKey);
    if (raw != null) {
      try {
        _session = PreviewSession.fromJson(
          jsonDecode(raw) as Map<String, dynamic>,
        );
      } on Object {
        _prefs?.remove(storageKey);
      }
    }
  }

  static const storageKey = 'sahsah.host.v1';

  /// Renew when this little time is left.
  static const renewWithin = Duration(days: 7);

  final SahsahApi _api;
  final SharedPreferences? _prefs;
  final DateTime Function() _now;
  PreviewSession? _session;

  bool get signedIn => _session != null && _session!.expiresAt.isAfter(_now());
  String? get displayName => _session?.displayName;

  /// The account proof for requests, or null when signed out.
  AccountAuth? get auth => signedIn ? AccountAuth(_session!.credential) : null;
  String? get credential => signedIn ? _session!.credential : null;

  /// Signs this phone in with the shared [passcode]. Throws [ApiError].
  Future<void> signIn({
    required String passcode,
    required String displayName,
  }) async {
    _save(
      await _api.previewSession(
        passcode: passcode.trim(),
        displayName: displayName.trim(),
      ),
    );
  }

  /// Renews the credential in its last week. A credential the server no
  /// longer accepts is dropped, so the next game asks for the passcode.
  Future<void> renewIfDue() async {
    final held = _session;
    if (held == null || held.expiresAt.difference(_now()) > renewWithin) {
      return;
    }
    try {
      _save(
        await _api.previewSession(
          credential: held.credential,
          displayName: held.displayName,
        ),
      );
    } on ApiError catch (e) {
      if (e.identityRejected) signOut();
    }
  }

  void signOut() {
    _session = null;
    _prefs?.remove(storageKey);
    notifyListeners();
  }

  void _save(PreviewSession session) {
    _session = session;
    _prefs?.setString(storageKey, jsonEncode(session.toJson()));
    notifyListeners();
  }
}
