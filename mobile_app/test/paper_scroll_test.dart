import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/core/ui/paper_scroll.dart';

/// A paper page that runs past the sheet says so; one that fits doesn't.
void main() {
  Future<ScrollController> pump(
    WidgetTester tester,
    double contentHeight,
  ) async {
    final controller = ScrollController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      LangScope(
        controller: LangController(),
        child: MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 400,
              child: PaperScroll(
                controller: controller,
                child: SizedBox(height: contentHeight),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    return controller;
  }

  double tabOpacity(WidgetTester tester) => tester
      .widget<AnimatedOpacity>(
        find.ancestor(
          of: find.byKey(const ValueKey('more-below')),
          matching: find.byType(AnimatedOpacity),
        ),
      )
      .opacity;

  testWidgets('a long page shows the tab, which scrolls and then goes', (
    tester,
  ) async {
    final controller = await pump(tester, 1200);
    expect(tabOpacity(tester), 1);

    await tester.tap(find.byKey(const ValueKey('more-below')));
    await tester.pumpAndSettle();
    expect(controller.offset, greaterThan(200));
    expect(tabOpacity(tester), 0);
  });

  testWidgets('a page that fits has no tab', (tester) async {
    await pump(tester, 300);
    expect(tabOpacity(tester), 0);
  });

  testWidgets('with animations off the tab jumps', (tester) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    final controller = await pump(tester, 1200);
    await tester.tap(find.byKey(const ValueKey('more-below')));
    await tester.pump();
    expect(controller.offset, greaterThan(200));
  });
}
