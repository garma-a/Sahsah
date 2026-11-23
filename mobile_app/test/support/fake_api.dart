import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sahsah_mobile/core/api/sahsah_api.dart';

const _trial = {
  'id': 'section-trial',
  'name': 'باقات تجريبية',
  'displayOrder': 1,
};
const _classics = {
  'id': 'section-classics',
  'name': 'كلاسيكيات',
  'displayOrder': 2,
};

Map<String, Object?> _category(
  String id,
  String name, {
  Map<String, Object?>? section = _trial,
  int packs = 8,
}) => {
  'id': id,
  'name': name,
  'description': 'وصف $name',
  'section': ?section,
  'coverUrl': 'https://covers.test/$id.webp',
  'publishedPackCount': packs,
};

/// The catalogue the fake server serves: two sections, one category with no
/// packs yet, and one with no section.
final fakeCategories = [
  _category('cat-football', 'الكورة المصرية'),
  _category('cat-90s', 'نوستالجيا التسعينات'),
  _category('cat-emoji', 'خمّن الكلمة من الإيموجي'),
  _category('cat-places', 'خمّن المكان'),
  _category('cat-cinema', 'سينما الأبيض والأسود', section: _classics),
  _category('cat-songs', 'موسيقى مصرية', section: _classics),
  _category('cat-soon', 'فوازير وألغاز', section: _classics, packs: 0),
  _category('cat-loose', 'معلومات عامة', section: null),
];

/// A [SahsahApi] over a fake server that serves [fakeCategories] and
/// answers anything else with a 404 problem. [handler] can take a request
/// first; returning null falls through to the defaults.
SahsahApi fakeApi({
  Future<http.Response?> Function(http.Request request)? handler,
}) => SahsahApi(
  baseUrl: 'http://api.test/api',
  client: MockClient((request) async {
    final custom = await handler?.call(request);
    if (custom != null) return custom;
    if (request.url.path == '/api/v1/categories') {
      return _json({'items': fakeCategories});
    }
    return _json({'code': 'NOT_FOUND', 'status': 404}, 404);
  }),
);

http.Response _json(Object body, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(body)),
  status,
  headers: {'content-type': 'application/json'},
);
