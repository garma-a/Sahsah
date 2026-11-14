import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/data/shop.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'home_test.dart' show pumpApp, settle, tapText;

const landscape = Size(892, 412);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('shop rules', () {
    test('packs cost 10 EGP a game; gifts are 10% off', () {
      expect(packPrice(1), 10);
      expect(packPrice(2), 20);
      expect(packPrice(5), 50);
      expect(packPrice(1, gift: true), 9);
      expect(packPrice(5, gift: true), 45);
      expect(packListPrice(5), 50);
    });

    test('Egyptian mobile numbers with or without 0 and +20', () {
      for (final ok in [
        '01012345678',
        '010 1234 5678',
        '+201512345678',
        '1112345678',
      ]) {
        expect(isEgyptianMobile(ok), isTrue, reason: ok);
      }
      for (final bad in ['', '0101234567', '01312345678', '123', 'abc']) {
        expect(isEgyptianMobile(bad), isFalse, reason: bad);
      }
    });

    test('email shape', () {
      expect(isEmail('a@b.co'), isTrue);
      expect(isEmail(' a@b.co '), isTrue);
      expect(isEmail('a@b'), isFalse);
      expect(isEmail('ab.co'), isFalse);
    });
  });

  testWidgets('shop: packs, gift phone check and the coming-soon notice', (
    tester,
  ) async {
    await pumpApp(tester, size: landscape);
    await tapText(tester, 'المتجر');

    expect(find.text('الأكثر طلبًا'), findsOneWidget);
    expect(find.text('اشتري'), findsNWidgets(3));

    // Gift tab: a bad number is caught before anything else.
    await tapText(tester, 'هدية · خصم ١٠٪');
    expect(find.text('اهدي صاحبك لعبة'), findsOneWidget);
    await tester.tap(find.text('اهدي').first);
    await settle(tester);
    expect(find.textContaining('اكتب رقم موبايل مصري صح'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('gift-phone')),
      '010 1234 5678',
    );
    await tester.tap(find.text('اهدي').first);
    await settle(tester);
    expect(find.text('الشراء جاي قريب'), findsOneWidget);
  });

  testWidgets('account: sign-in checks name and phone', (tester) async {
    await pumpApp(tester, size: landscape);
    await tapText(tester, 'ضيف');

    expect(find.text('إنت بتلعب كضيف'), findsOneWidget);
    expect(find.text('مفيش لعبة شغالة. أول لعبة هتظهر هنا.'), findsOneWidget);

    await tapText(tester, 'ابعت الكود على واتساب');
    expect(find.text('اكتب اسمك.'), findsOneWidget);

    await tester.enterText(find.byKey(const ValueKey('account-name')), 'منى');
    await tester.enterText(
      find.byKey(const ValueKey('account-phone')),
      '01212345678',
    );
    await tapText(tester, 'ابعت الكود على واتساب');
    expect(find.text('تسجيل الدخول جاي قريب'), findsOneWidget);
  });

  testWidgets('contact: tabs and validation before the notice', (
    tester,
  ) async {
    await pumpApp(tester, size: landscape);
    await tapText(tester, 'المزيد');
    await tapText(tester, 'تواصل معنا');

    expect(find.text('نوع المشكلة'), findsOneWidget);
    await tapText(tester, 'ابعت');
    expect(find.text('اكتب إيميل صحيح عشان نرد عليك.'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('contact-email')),
      'mona@example.com',
    );
    await tester.enterText(
      find.byKey(const ValueKey('contact-message')),
      'اللعبة وقفت مني',
    );
    await tapText(tester, 'ابعت');
    expect(find.text('الإرسال جاي قريب'), findsOneWidget);
    await tapText(tester, 'تمام');

    // Feedback needs a rating or a comment, not an email.
    await tapText(tester, 'شاركنا تجربتك');
    expect(find.text('إيه رأيك في صح صح؟'), findsOneWidget);
  });
}
