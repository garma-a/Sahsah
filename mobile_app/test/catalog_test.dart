import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';
import 'package:sahsah_mobile/data/catalog.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_api.dart';

SahsahApi offlineApi() => SahsahApi(
  baseUrl: 'http://api.test/api',
  client: MockClient((_) async => throw http.ClientException('off')),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('groups the server catalogue by section, unsectioned last', () async {
    final catalog = CatalogController(fakeApi());
    await catalog.load(ContentLanguage.ar);

    expect(catalog.status, CatalogStatus.ready);
    expect(catalog.categories, hasLength(fakeCategories.length));
    expect(
      [for (final s in catalog.shelves) s.name],
      ['باقات تجريبية', 'كلاسيكيات', null],
    );
    expect(catalog.byId('cat-soon')!.playable, isFalse);
  });

  test('with no saved copy and no server, says why', () async {
    final catalog = CatalogController(offlineApi());
    await catalog.load(ContentLanguage.ar);

    expect(catalog.status, CatalogStatus.error);
    expect(catalog.error!.code, 'NETWORK');
  });

  test('retry after a failure loads the catalogue', () async {
    var online = false;
    final catalog = CatalogController(
      fakeApi(
        handler: (_) async => online ? null : throw http.ClientException('off'),
      ),
    );
    await catalog.load(ContentLanguage.ar);
    expect(catalog.status, CatalogStatus.error);

    online = true;
    await catalog.retry();
    expect(catalog.status, CatalogStatus.ready);
    expect(catalog.error, isNull);
  });

  test('the saved copy shows offline; the server copy is saved', () async {
    final prefs = await SharedPreferences.getInstance();
    await CatalogController(fakeApi(), prefs).load(ContentLanguage.ar);
    expect(prefs.getString('sahsah.catalog.ar'), isNotNull);

    final offline = CatalogController(offlineApi(), prefs);
    await offline.load(ContentLanguage.ar);
    expect(offline.status, CatalogStatus.ready);
    expect(offline.categories, hasLength(fakeCategories.length));
  });

  test('a language switch asks for that language, once', () async {
    final languages = <String?>[];
    final catalog = CatalogController(
      fakeApi(
        handler: (request) async {
          languages.add(request.url.queryParameters['language']);
          return null;
        },
      ),
    );
    await catalog.load(ContentLanguage.ar);
    await catalog.load(ContentLanguage.ar);
    await catalog.load(ContentLanguage.franco);

    expect(languages, ['ar', 'franco']);
  });

  test('a late answer never replaces a newer one', () async {
    final catalog = CatalogController(
      SahsahApi(
        baseUrl: 'http://api.test/api',
        client: MockClient((request) async {
          final language = request.url.queryParameters['language']!;
          // The Arabic answer arrives after the Franco one.
          if (language == 'ar') {
            await Future<void>.delayed(const Duration(milliseconds: 20));
          }
          return http.Response.bytes(
            utf8.encode(
              jsonEncode({
                'items': [
                  {
                    'id': 'x',
                    'name': language == 'ar' ? 'عربي' : 'Franco',
                    'publishedPackCount': 1,
                  },
                ],
              }),
            ),
            200,
          );
        }),
      ),
    );
    final first = catalog.load(ContentLanguage.ar);
    await catalog.load(ContentLanguage.franco);
    await first;

    expect(catalog.byId('x')!.name, 'Franco');
  });
}
