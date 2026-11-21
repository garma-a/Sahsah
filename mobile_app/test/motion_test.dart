import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahsah_mobile/core/ui/motion.dart';

double _opacity(WidgetTester tester) =>
    tester.widget<Opacity>(find.byType(Opacity)).opacity;

Offset _shift(WidgetTester tester) => tester
    .widget<Transform>(find.byType(Transform).first)
    .transform
    .getTranslation()
    .let((v) => Offset(v.x, v.y));

extension<T> on T {
  R let<R>(R Function(T) f) => f(this);
}

void main() {
  Widget host({bool calm = false, Duration delay = Duration.zero}) =>
      MediaQuery(
        data: MediaQueryData(disableAnimations: calm),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: Rise(
            delay: delay,
            child: const SizedBox(width: 10, height: 10),
          ),
        ),
      );

  testWidgets('a card rises 22px and fades in, after its delay', (
    tester,
  ) async {
    await tester.pumpWidget(host(delay: const Duration(milliseconds: 200)));
    expect(_opacity(tester), 0);
    expect(_shift(tester).dy, 22);

    // Still waiting for its turn.
    await tester.pump(const Duration(milliseconds: 150));
    expect(_opacity(tester), 0);

    await tester.pumpAndSettle();
    expect(_opacity(tester), 1);
    expect(_shift(tester).dy, 0);
  });

  testWidgets('with animations off it is simply there', (tester) async {
    await tester.pumpWidget(host(calm: true));
    expect(_opacity(tester), 1);
    expect(_shift(tester).dy, 0);
  });
}
