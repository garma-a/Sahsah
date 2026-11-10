import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'core/api/api_scope.dart';
import 'core/api/sahsah_api.dart';
import 'core/i18n/lang.dart';
import 'core/theme/app_theme.dart';
import 'core/ui/orientation.dart';
import 'features/game/game_controller.dart';
import 'features/shell/app_shell.dart';

class SahsahApp extends StatefulWidget {
  /// [lang], [game] and [api] can be injected (tests); otherwise defaults are
  /// created.
  const SahsahApp({super.key, this.lang, this.game, this.api});

  final LangController? lang;
  final GameController? game;
  final SahsahApi? api;

  @override
  State<SahsahApp> createState() => _SahsahAppState();
}

class _SahsahAppState extends State<SahsahApp> {
  late final SahsahApi _api = widget.api ?? SahsahApi();
  late final LangController _lang = widget.lang ?? LangController();
  late final GameController _game = widget.game ?? GameController();

  @override
  void initState() {
    super.initState();
    // Sideways and full screen everywhere (see core/ui/orientation.dart).
    applyAppOrientation();
  }

  @override
  void dispose() {
    if (widget.api == null) _api.close();
    if (widget.lang == null) _lang.dispose();
    if (widget.game == null) _game.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ApiScope(
      api: _api,
      child: GameScope(
        controller: _game,
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
                localizationsDelegates: GlobalMaterialLocalizations.delegates,
                theme: AppTheme.dark(),
                // Respect large system fonts, but cap them so game layouts hold.
                builder: (context, child) => MediaQuery.withClampedTextScaling(
                  maxScaleFactor: 1.3,
                  child: child!,
                ),
                home: const AppShell(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
