import 'package:flutter/widgets.dart';

/// App destinations. The first five are the bottom-bar tabs.
enum AppRoute {
  home,
  categories,
  play,
  shop,
  more,
  gift,
  account,
  contact,
  business,
  experience,
}

/// Lets any widget in the shell navigate and open shared sheets.
class ShellNav extends InheritedWidget {
  const ShellNav({
    super.key,
    required this.route,
    required this.go,
    required this.openJoin,
    required super.child,
  });

  final AppRoute route;
  final void Function(AppRoute route) go;

  /// Opens the "join with code" sheet.
  final VoidCallback openJoin;

  static ShellNav of(BuildContext context) {
    final nav = context.dependOnInheritedWidgetOfExactType<ShellNav>();
    assert(nav != null, 'ShellNav not found');
    return nav!;
  }

  @override
  bool updateShouldNotify(ShellNav oldWidget) => route != oldWidget.route;
}
