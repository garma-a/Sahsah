import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_background.dart';
import '../categories/categories_page.dart';
import '../game/setup_screen.dart';
import '../home/home_page.dart';
import '../join/join_sheet.dart';
import '../more/more_page.dart';
import '../placeholder/coming_soon_page.dart';
import 'app_route.dart';
import 'bottom_nav.dart';
import 'header.dart';
import 'hud.dart';

/// App frame. Landscape (the app's orientation): a game top bar over the
/// lobby or the current screen. Portrait fallback: floating top bar, the
/// scrolling page and the floating bottom bar. See `docs/mobile-game-design.md`.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with TickerProviderStateMixin {
  final _scroll = ScrollController();
  AppRoute _route = AppRoute.home;

  /// Local balance until the backend exposes accounts and tokens.
  final int _tokens = 0;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _go(AppRoute route) {
    if (route == AppRoute.play) {
      // Playing is a full-screen flow over the tabs.
      openSetup(context);
      return;
    }
    if (route == _route) {
      // Tapping the current tab scrolls back to the top, like most apps.
      if (_scroll.hasClients) {
        _scroll.animateTo(
          0,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutCubic,
        );
      }
      return;
    }
    setState(() => _route = route);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(0);
    });
  }

  void _openJoin() => showJoinSheet(context);

  Widget _page() => switch (_route) {
    AppRoute.home => HomePage(tokens: _tokens),
    AppRoute.categories => const CategoriesPage(),
    AppRoute.more => const MorePage(),
    _ => ComingSoonPage(route: _route),
  };

  /// Lobby and shelf fill the screen; other pages scroll as a panel.
  Widget _landscapePage(double bottomInset) => switch (_route) {
    AppRoute.home => Padding(
      padding: EdgeInsets.only(bottom: 14 + bottomInset),
      child: HomePage(tokens: _tokens),
    ),
    AppRoute.categories => Padding(
      padding: EdgeInsets.only(bottom: 14 + bottomInset),
      child: const CategoriesPage(),
    ),
    _ => SingleChildScrollView(
      controller: _scroll,
      padding: EdgeInsets.only(bottom: 24 + bottomInset),
      child: _page(),
    ),
  };

  Widget _scrollArea({required double bottomSpace}) => CustomScrollView(
    controller: _scroll,
    slivers: [
      SliverPersistentHeader(
        floating: true,
        delegate: ShellHeaderDelegate(tokens: _tokens, vsync: this),
      ),
      SliverToBoxAdapter(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 220),
          switchInCurve: Curves.easeOut,
          switchOutCurve: Curves.easeIn,
          layoutBuilder: (current, previous) => Stack(
            alignment: Alignment.topCenter,
            children: [...previous, ?current],
          ),
          child: KeyedSubtree(key: ValueKey(_route), child: _page()),
        ),
      ),
      SliverToBoxAdapter(child: SizedBox(height: bottomSpace)),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final padding = MediaQuery.paddingOf(context);
    final size = MediaQuery.sizeOf(context);
    final landscape = size.width > size.height;

    return PopScope(
      // Back goes home first, like browser history on the web.
      canPop: _route == AppRoute.home,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _go(AppRoute.home);
      },
      child: ShellNav(
        route: _route,
        go: _go,
        openJoin: _openJoin,
        child: Scaffold(
          backgroundColor: AppColors.deep,
          body: Stack(
            children: [
              const Positioned.fill(child: BrandBackground()),
              if (landscape)
                // Landscape game frame: top bar, then a fixed screen (the
                // lobby, the category shelf) or a scrolling panel. Side
                // padding keeps clear of camera cutouts.
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    padding.left + 16,
                    padding.top + 8,
                    padding.right + 16,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      GameHud(route: _route, tokens: _tokens),
                      const SizedBox(height: 10),
                      Expanded(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 220),
                          switchInCurve: Curves.easeOut,
                          switchOutCurve: Curves.easeIn,
                          layoutBuilder: (current, previous) => Stack(
                            fit: StackFit.expand,
                            children: [...previous, ?current],
                          ),
                          child: KeyedSubtree(
                            key: ValueKey(_route),
                            child: _landscapePage(padding.bottom),
                          ),
                        ),
                      ),
                    ],
                  ),
                )
              else ...[
                // Portrait fallback (tablets that ignore the lock). The scroll
                // view starts below the status bar so the floating header
                // never slides underneath it.
                Positioned.fill(
                  top: padding.top,
                  child: _scrollArea(bottomSpace: 120 + padding.bottom),
                ),
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12 + padding.bottom,
                  child: const BottomNav(),
                ),
              ],
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: padding.top,
                child: ColoredBox(color: AppColors.deep.withValues(alpha: 0.8)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
