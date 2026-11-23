import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api/api_scope.dart';
import 'core/api/sahsah_api.dart';
import 'core/audio/sound.dart';
import 'core/i18n/lang.dart';
import 'core/session/host_session.dart';
import 'core/theme/app_theme.dart';
import 'core/ui/orientation.dart';
import 'core/ui/tablet_scale.dart';
import 'data/catalog.dart';
import 'features/game/game_controller.dart';
import 'features/shell/app_shell.dart';

class SahsahApp extends StatefulWidget {
  /// [lang], [game], [api] and [sound] can be injected (tests); otherwise
  /// defaults are created. The default [sound] is silent: `main` passes the
  /// one that plays through the phone.
  const SahsahApp({
    super.key,
    this.lang,
    this.game,
    this.api,
    this.sound,
    this.catalog,
    this.launchPromo = false,
  });

  final LangController? lang;
  final GameController? game;
  final SahsahApi? api;
  final SoundController? sound;

  /// The server's categories; by default loaded through [api].
  final CatalogController? catalog;

  /// Pop up the featured promo when the app opens (`main` turns it on).
  final bool launchPromo;

  @override
  State<SahsahApp> createState() => _SahsahAppState();
}

class _SahsahAppState extends State<SahsahApp> {
  late final SahsahApi _api = widget.api ?? SahsahApi();
  late final LangController _lang = widget.lang ?? LangController();
  late final GameController _game =
      widget.game ?? GameController(api: _api, session: HostSession(_api));
  late final SoundController _sound = widget.sound ?? SoundController();
  late final CatalogController _catalog =
      widget.catalog ?? CatalogController(_api);

  @override
  void initState() {
    super.initState();
    // Sideways and full screen everywhere (see core/ui/orientation.dart).
    applyAppOrientation();
    // The catalogue follows the app's language (Franco where it has it).
    _loadCatalog();
    _lang.addListener(_loadCatalog);
    // The room this phone runs, as the server has it now.
    _game.refresh();
    _game.session.renewIfDue();
  }

  /// The catalogue and the game's questions follow the app's language
  /// (Franco where the content has it).
  void _loadCatalog() {
    final language = _lang.ar ? ContentLanguage.ar : ContentLanguage.franco;
    _catalog.load(language);
    _game.setLanguage(language);
  }

  @override
  void dispose() {
    _lang.removeListener(_loadCatalog);
    if (widget.catalog == null) _catalog.dispose();
    if (widget.api == null) _api.close();
    if (widget.lang == null) _lang.dispose();
    if (widget.game == null) _game.dispose();
    if (widget.sound == null) _sound.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ApiScope(
      api: _api,
      child: SoundScope(
        controller: _sound,
        child: GameScope(
          controller: _game,
          child: CatalogScope(
            controller: _catalog,
            child: LangScope(
              controller: _lang,
              child: ListenableBuilder(
                listenable: _lang,
                builder: (context, _) => AnnotatedRegion<SystemUiOverlayStyle>(
                  value: SystemUiOverlayStyle.light.copyWith(
                    statusBarColor: Colors.transparent,
                    systemNavigationBarColor: AppColors.deep,
                  ),
                  child: MaterialApp(
                    title: _lang.t(
                      'صح صح — لعبة الأسئلة',
                      'Sa7Sa7 — Le3bet el as2ela',
                    ),
                    debugShowCheckedModeBanner: false,
                    locale: _lang.locale,
                    supportedLocales: const [Locale('ar'), Locale('en')],
                    localizationsDelegates:
                        GlobalMaterialLocalizations.delegates,
                    theme: AppTheme.dark(),
                    // Respect large system fonts, but cap them so game layouts hold.
                    // On a tablet, the phone's game scaled up to fill it.
                    builder: (context, child) => TabletScale(
                      child: MediaQuery.withClampedTextScaling(
                        maxScaleFactor: 1.3,
                        child: child!,
                      ),
                    ),
                    home: AppShell(launchPromo: widget.launchPromo),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
