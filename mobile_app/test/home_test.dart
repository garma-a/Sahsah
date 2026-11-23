import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/home/promo_banner.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_api.dart';

Future<void> pumpApp(
  WidgetTester tester, {
  Lang lang = Lang.ar,
  Size size = const Size(412, 892),
  bool launchPromo = false,
}) async {
  // A phone-sized screen (portrait fallback unless a landscape size is given).
  tester.view.physicalSize = size * 3;
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    SahsahApp(
      api: fakeApi(),
      lang: LangController(lang),

      launchPromo: launchPromo,
    ),
  );
  await settle(tester);
}

/// The sheen animation repeats forever, so pump a fixed time instead of
/// pumpAndSettle.
Future<void> settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

/// Scrolls the text to mid-screen (clear of the floating bars) and taps it.
Future<void> tapText(WidgetTester tester, String text) async {
  final finder = find.text(text).first;
  await Scrollable.ensureVisible(tester.element(finder), alignment: 0.5);
  await tester.pump();
  await tester.tap(finder);
  await settle(tester);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('home is a game lobby with start, join and categories', (
    tester,
  ) async {
    await pumpApp(tester);

    expect(
      Directionality.of(tester.element(find.text('يلا نلعب؟'))),
      TextDirection.rtl,
    );
    expect(find.text('ابدأ لعبة'), findsOneWidget);
    expect(find.text('ادخل بكود'), findsOneWidget);
    // The server's catalogue, by section.
    expect(find.text('باقات تجريبية'), findsOneWidget);
    expect(find.text('كلاسيكيات'), findsOneWidget);
    expect(find.text('الكورة المصرية'), findsOneWidget);
    for (final tab in ['الرئيسية', 'الفئات', 'العب', 'المتجر', 'المزيد']) {
      expect(find.text(tab), findsWidgets, reason: tab);
    }
  });

  testWidgets('language toggle switches to Franco and left-to-right', (
    tester,
  ) async {
    await pumpApp(tester);

    await tapText(tester, 'EN');

    expect(find.text('Yalla nel3ab?'), findsOneWidget);
    expect(find.text('عربي'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('Yalla nel3ab?'))),
      TextDirection.ltr,
    );
  });

  testWidgets('tabs switch pages and home comes back', (tester) async {
    await pumpApp(tester);

    await tapText(tester, 'المزيد');
    expect(find.text('سجّل دخولك'), findsOneWidget);
    expect(find.text('يلا نلعب؟'), findsNothing);

    await tapText(tester, 'الفئات');
    expect(find.text('٨ فئات · اختاروا ٦ للوحة'), findsOneWidget);
    expect(find.text('كلاسيكيات'), findsOneWidget);

    await tapText(tester, 'الرئيسية');
    expect(find.text('يلا نلعب؟'), findsOneWidget);
  });

  testWidgets('join sheet takes a six-digit code', (tester) async {
    await pumpApp(tester);

    await tapText(tester, 'ادخل بكود');
    expect(find.text('ادخل اللعبة بالكود'), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('join-code')), '12a34');
    await settle(tester);
    // Letters are dropped and the code isn't complete yet.
    expect(find.text('4'), findsOneWidget);
    await tester.tap(find.text('ادخل'));
    await settle(tester);
    expect(find.textContaining('غرف اللعب'), findsNothing);

    await tester.enterText(find.byKey(const ValueKey('join-code')), '123456');
    await settle(tester);
    await tester.tap(find.text('ادخل'));
    await settle(tester);
    expect(find.textContaining('غرف اللعب'), findsOneWidget);
  });

  testWidgets('tapping a category opens its details', (tester) async {
    await pumpApp(tester);

    await tapText(tester, 'سينما الأبيض والأسود');
    expect(find.text('وصف سينما الأبيض والأسود'), findsOneWidget);
    expect(
      find.text('٨ باقات، كل باقة ٦ أسئلة من ٢٠٠ لـ٦٠٠ نقطة'),
      findsOneWidget,
    );
  });

  testWidgets('a category with no packs yet says so', (tester) async {
    await pumpApp(tester);

    await tapText(tester, 'فوازير وألغاز');
    expect(find.text('لسه مفيش باقات جاهزة في الفئة دي.'), findsOneWidget);
    expect(find.text('قريبًا'), findsWidgets);
  });

  testWidgets('no server and nothing saved: the real reason and a retry', (
    tester,
  ) async {
    var online = false;
    tester.view.physicalSize = const Size(412, 892) * 3;
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      SahsahApp(
        lang: LangController(Lang.ar),
        api: fakeApi(
          handler: (_) async =>
              online ? null : throw http.ClientException('off'),
        ),
      ),
    );
    await settle(tester);
    expect(
      find.text('مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.'),
      findsOneWidget,
    );

    online = true;
    await tapText(tester, 'جرّب تاني');
    expect(find.text('الكورة المصرية'), findsOneWidget);
  });

  testWidgets('landscape: one-screen lobby, menu tiles and back', (
    tester,
  ) async {
    await pumpApp(tester, size: const Size(892, 412));
    // No game yet: no "new game" button, no gift tile (gifts are bought on
    // the website), no dead "two teams" chip, and a wallet that says play
    // is free.
    expect(find.text('لعبة جديدة'), findsNothing);
    expect(find.text('هدية'), findsNothing);
    expect(find.text('فريقين'), findsNothing);
    expect(find.text('اللعب مجاني'), findsOneWidget);

    // Lobby fits the screen: no page scroll, play button at the end side
    // (left in Arabic), menu tiles at the start side.
    expect(find.byType(CustomScrollView), findsNothing);
    final play = tester.getCenter(find.text('ابدأ لعبة'));
    // The stage is a banner carousel, opening on the new challenges.
    final title = tester.getCenter(find.text('باقات تجريبية'));
    final menu = tester.getCenter(find.text('الفئات'));
    expect(play.dx, lessThan(title.dx));
    expect(menu.dx, greaterThan(title.dx));
    expect(find.text('ادخل بكود'), findsOneWidget);
    expect(find.text('ضيف'), findsOneWidget);

    // The banners turn on their own: the gift discount, free play, then
    // how to play, whose button opens the steps.
    await tester.pump(PromoCarousel.interval);
    await settle(tester);
    expect(find.text('خصم ٢٠٪ على كل الهدايا'), findsOneWidget);
    await tester.pump(PromoCarousel.interval);
    await settle(tester);
    expect(find.text('العبوا ببلاش'), findsOneWidget);
    await tester.pump(PromoCarousel.interval);
    await settle(tester);
    // Let the slide finish: a page ignores taps while it moves.
    await settle(tester);
    expect(find.text('أول مرة تلعبوا؟'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('إزاي نلعب؟'));
    await settle(tester);
    expect(find.text('سمّوا الفريقين'), findsOneWidget);
    await tester.tap(find.text('تمام'));
    await settle(tester);

    // Category shelf with section tabs.
    await tapText(tester, 'الفئات');
    expect(find.text('الكورة المصرية'), findsOneWidget);
    await tapText(tester, 'كلاسيكيات');
    expect(find.text('الكورة المصرية'), findsNothing);
    expect(find.text('سينما الأبيض والأسود'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('hud-back')));
    await settle(tester);

    await tapText(tester, 'المزيد');
    expect(find.text('سجّل دخولك'), findsOneWidget);
    expect(find.text('عن صح صح'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('hud-back')));
    await settle(tester);

    await tapText(tester, 'ادخل بكود');
    expect(find.text('ادخل اللعبة بالكود'), findsOneWidget);
  });

  testWidgets('opening the app pops up the new challenges once', (
    tester,
  ) async {
    await pumpApp(tester, size: const Size(892, 412), launchPromo: true);
    await tester.pump(const Duration(milliseconds: 700));
    await settle(tester);
    final popup = find.byKey(const ValueKey('promo-popup'));
    expect(popup, findsOneWidget);

    // Its button goes to the categories, where the new section comes first.
    await tester.tap(
      find.descendant(of: popup, matching: find.bySemanticsLabel('شوفوها')),
    );
    await settle(tester);
    expect(popup, findsNothing);
    expect(find.text('كلاسيكيات'), findsOneWidget);
  });

  testWidgets('with a screen reader on, the banners hold still', (
    tester,
  ) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(accessibleNavigation: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await pumpApp(tester, size: const Size(892, 412));
    expect(find.text('باقات تجريبية'), findsOneWidget);
    await tester.pump(PromoCarousel.interval * 2);
    await settle(tester);
    expect(find.text('باقات تجريبية'), findsOneWidget);
  });

  testWidgets('the launch pop-up closes and stays closed', (tester) async {
    await pumpApp(tester, size: const Size(892, 412), launchPromo: true);
    await tester.pump(const Duration(milliseconds: 700));
    await settle(tester);
    await tester.tap(
      find.descendant(
        of: find.byKey(const ValueKey('promo-popup')),
        matching: find.bySemanticsLabel('اقفل'),
      ),
    );
    await settle(tester);
    expect(find.byKey(const ValueKey('promo-popup')), findsNothing);
    // The lobby is back, and nothing pops up again.
    await tester.pump(const Duration(seconds: 3));
    expect(find.byKey(const ValueKey('promo-popup')), findsNothing);
    expect(find.text('ادخل بكود'), findsOneWidget);
  });
}
