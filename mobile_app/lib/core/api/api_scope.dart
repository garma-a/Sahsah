import 'package:flutter/widgets.dart';

import 'sahsah_api.dart';

/// Makes the shared backend client available to every screen.
class ApiScope extends InheritedWidget {
  const ApiScope({super.key, required this.api, required super.child});

  final SahsahApi api;

  static SahsahApi of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ApiScope>();
    assert(scope != null, 'ApiScope not found');
    return scope!.api;
  }

  @override
  bool updateShouldNotify(ApiScope oldWidget) => api != oldWidget.api;
}
