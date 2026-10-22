import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'features/lobby/lobby_screen.dart';

class SahsahApp extends StatelessWidget {
  const SahsahApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'صحصح',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B5543)),
        scaffoldBackgroundColor: const Color(0xFFFAF8F0),
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
        ),
      ),
      home: const LobbyScreen(),
    );
  }
}
