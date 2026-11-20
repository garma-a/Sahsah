import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';

void main() {
  test('getHealth calls /health and parses the response', () async {
    late Uri requested;
    final api = SahsahApi(
      baseUrl: 'http://example.test/api/',
      client: MockClient((request) async {
        requested = request.url;
        return http.Response(
          jsonEncode({'status': 'ok', 'service': 'sahsah-backend'}),
          200,
        );
      }),
    );

    final health = await api.getHealth();

    expect(requested.toString(), 'http://example.test/api/health');
    expect(health.isOk, isTrue);
    expect(health.service, 'sahsah-backend');
  });

  test('getHealth throws ApiException on a non-2xx status', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((_) async => http.Response('down', 503)),
    );

    await expectLater(
      api.getHealth(),
      throwsA(
        isA<ApiException>().having((e) => e.statusCode, 'statusCode', 503),
      ),
    );
  });

  test('getHealth throws ApiException on network errors', () async {
    final api = SahsahApi(
      baseUrl: 'http://example.test/api',
      client: MockClient((_) async => throw http.ClientException('offline')),
    );

    await expectLater(api.getHealth(), throwsA(isA<ApiException>()));
  });
}
