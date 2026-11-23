import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';
import 'package:sahsah_mobile/core/api/wire.dart';
import 'package:sahsah_mobile/core/i18n/lang.dart';

http.Response json(Object body, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(body)),
  status,
  headers: {'content-type': 'application/json'},
);

Map<String, Object?> category(String id) => {
  'id': id,
  'name': 'فئة $id',
  'publishedPackCount': 2,
};

Future<ApiError> failure(Future<Object?> call) async {
  try {
    await call;
  } on ApiError catch (e) {
    return e;
  }
  fail('expected an ApiError');
}

void main() {
  test('getHealth calls /health and parses the response', () async {
    late Uri requested;
    final api = SahsahApi(
      baseUrl: 'http://example.test/api/',
      client: MockClient((request) async {
        requested = request.url;
        return json({'status': 'ok', 'service': 'sahsah-backend'});
      }),
    );

    final health = await api.getHealth();

    expect(requested.toString(), 'http://example.test/api/health');
    expect(health.isOk, isTrue);
    expect(health.service, 'sahsah-backend');
  });

  test('a problem response carries its code and status', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient(
        (_) async => http.Response(
          jsonEncode({'code': 'RATE_LIMITED', 'status': 429}),
          429,
          headers: {'retry-after': '12'},
        ),
      ),
    );

    final error = await failure(api.getHealth());
    expect(error.status, 429);
    expect(error.code, 'RATE_LIMITED');
    expect(error.retryAfter, 12);
  });

  test('a failure without a problem body is worded by its status', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((_) async => http.Response('down', 503)),
    );

    final error = await failure(api.getHealth());
    expect(error.code, 'UNKNOWN');
    expect(
      error.message(LangController(Lang.ar)),
      'السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.',
    );
  });

  test('no connection is NETWORK, with the honest message', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((_) async => throw http.ClientException('offline')),
    );

    final error = await failure(api.getHealth());
    expect(error.code, 'NETWORK');
    expect(
      error.message(LangController(Lang.ar)),
      'مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.',
    );
  });

  test('a body that breaks the contract is a problem, not a crash', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((_) async => json({'items': 'nope'})),
    );

    final error = await failure(api.listCategories(ContentLanguage.ar));
    expect(error.code, 'INVALID_RESPONSE');
  });

  test('listCategories follows the cursor in the asked language', () async {
    final asked = <Uri>[];
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((request) async {
        asked.add(request.url);
        return request.url.queryParameters['cursor'] == null
            ? json({
                'items': [category('a'), category('b')],
                'nextCursor': 'next',
              })
            : json({
                'items': [category('c')],
              });
      }),
    );

    final categories = await api.listCategories(ContentLanguage.franco);

    expect([for (final c in categories) c.id], ['a', 'b', 'c']);
    expect(asked, hasLength(2));
    expect(asked.first.path, '/api/v1/categories');
    expect(asked.first.queryParameters['language'], 'franco');
    expect(asked.last.queryParameters['cursor'], 'next');
  });

  test('previewSession sends the passcode and reads the credential', () async {
    late http.Request sent;
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((request) async {
        sent = request;
        return json({
          'credential': 'secret-credential',
          'expiresAt': '2026-12-01T00:00:00.000Z',
          'accountId': 'acc-1',
          'displayName': 'مضيف',
        });
      }),
    );

    final session = await api.previewSession(
      passcode: '1234',
      displayName: 'مضيف',
    );

    expect(sent.method, 'POST');
    expect(sent.url.path, '/api/v1/preview/sessions');
    expect(jsonDecode(sent.body), {'passcode': '1234', 'displayName': 'مضيف'});
    expect(session.credential, 'secret-credential');
    expect(session.expiresAt, DateTime.utc(2026, 12));
  });

  test('a wrong passcode reads as one', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient(
        (_) async => json({'code': 'UNAUTHENTICATED', 'status': 401}, 401),
      ),
    );

    final error = await failure(
      api.previewSession(passcode: 'x', displayName: 'مضيف'),
    );
    expect(error.identityRejected, isTrue);
    expect(
      error.message(LangController(Lang.ar)),
      'الكود السري مش صح. اتأكد منه وجرّب تاني.',
    );
  });

  test('operation ids are random UUID v4s', () {
    final id = newOperationId();
    expect(
      id,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
    expect(newOperationId(), isNot(id));
  });
}
