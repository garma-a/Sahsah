import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/app.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';
import 'package:sahsah_mobile/features/home/promo_banner.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
      lang: LangController(lang),
      api: SahsahApi(
        baseUrl: 'http://example.test/api',
        client: MockClient((_) async => http.Response('{}', 200)),
      ),
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
    expect(find.text('تحديات جديدة للشلة'), findsOneWidget);
    expect(find.text('مين في الصورة؟'), findsOneWidget);
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
    expect(find.text('مصر وتراثها'), findsOneWidget);

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

    await tapText(tester, 'كورة وجمهور');
    expect(
      find.text('الأهلي والزمالك والمنتخب وأهداف الزمن الجميل.'),
      findsOneWidget,
    );
    expect(find.text('العب بالفئة دي'), findsOneWidget);
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
    final title = tester.getCenter(find.text('تحديات جديدة للشلة'));
    final menu = tester.getCenter(find.text('الفئات'));
    expect(play.dx, lessThan(title.dx));
    expect(menu.dx, greaterThan(title.dx));
    expect(find.text('ادخل بكود'), findsOneWidget);
    expect(find.text('ضيف'), findsOneWidget);

    // The banners turn on their own: free play, then how to play, whose
    // button opens the steps.
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
    expect(find.text('مين في الصورة؟'), findsOneWidget);
    await tapText(tester, 'مصر وتراثها');
    expect(find.text('مين في الصورة؟'), findsNothing);
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
    expect(find.text('مصر وتراثها'), findsOneWidget);
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
