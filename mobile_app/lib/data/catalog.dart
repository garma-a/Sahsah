import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api/sahsah_api.dart';
import '../core/api/wire.dart';
import '../core/i18n/lang.dart';

export '../core/api/wire.dart' show Category, CategorySection, ContentLanguage;

enum CatalogStatus { loading, ready, error }

/// A section of the shelf: the API's sections in their order, then the
/// categories that have none.
class Shelf {
  const Shelf({required this.id, required this.name, required this.categories});

  final String id;

  /// Null for the unsectioned rest ("فئات تانية").
  final String? name;
  final List<Category> categories;

  String title(LangController lang) =>
      name ?? lang.t('فئات تانية', 'Fe2at tanya');
}

/// The public catalogue from the server. The last good copy is kept on the
/// phone, so the shelf shows at once and still shows offline; the server's
/// copy replaces it as soon as it arrives.
class CatalogController extends ChangeNotifier {
  CatalogController(this._api, [this._prefs]);

  static const _storagePrefix = 'sahsah.catalog.';

  final SahsahApi _api;
  final SharedPreferences? _prefs;

  ContentLanguage? _language;
  CatalogStatus _status = CatalogStatus.loading;
  List<Category> _categories = const [];
  Map<String, Category> _byId = const {};
  List<Shelf> _shelves = const [];
  ApiError? _error;
  int _attempt = 0;
  bool _disposed = false;

  CatalogStatus get status => _status;

  /// Every category, in the server's order.
  List<Category> get categories => _categories;
  List<Shelf> get shelves => _shelves;

  /// Why the last load failed; set only while there's nothing to show.
  ApiError? get error => _error;

  Category? byId(String id) => _byId[id];

  /// Loads the catalogue in [language], from the saved copy first. Does
  /// nothing if that language is already loaded or loading.
  Future<void> load(ContentLanguage language) {
    if (language == _language) return Future.value();
    _language = language;
    final saved = _readSaved(language);
    if (saved != null) {
      _show(saved);
    } else {
      _status = CatalogStatus.loading;
      _error = null;
      _notify();
    }
    return _fetch();
  }

  /// After a failure: ask the server again.
  Future<void> retry() {
    if (_language == null) return Future.value();
    if (_categories.isEmpty) {
      _status = CatalogStatus.loading;
      _error = null;
      _notify();
    }
    return _fetch();
  }

  Future<void> _fetch() async {
    final language = _language!;
    final attempt = ++_attempt;
    try {
      final fresh = await _api.listCategories(language);
      if (_disposed || attempt != _attempt) return;
      _show(fresh);
      _prefs?.setString(
        '$_storagePrefix${language.name}',
        jsonEncode([for (final c in fresh) c.toJson()]),
      );
    } on ApiError catch (e) {
      if (_disposed || attempt != _attempt) return;
      // A saved copy stays up; only an empty shelf shows the problem.
      if (_categories.isNotEmpty) return;
      _status = CatalogStatus.error;
      _error = e;
      _notify();
    }
  }

  List<Category>? _readSaved(ContentLanguage language) {
    final raw = _prefs?.getString('$_storagePrefix${language.name}');
    if (raw == null) return null;
    try {
      return [
        for (final e in jsonDecode(raw) as List)
          Category.fromJson(e as Map<String, dynamic>),
      ];
    } on Object {
      return null; // An unreadable copy is as good as none.
    }
  }

  void _show(List<Category> categories) {
    _categories = List.unmodifiable(categories);
    _byId = {for (final c in categories) c.id: c};
    _shelves = shelvesOf(categories);
    _status = CatalogStatus.ready;
    _error = null;
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}

/// Groups [categories] into the API's sections, in section order;
/// unsectioned ones go last (the website's `toShelves`).
List<Shelf> shelvesOf(List<Category> categories) {
  final groups = <String, ({int order, Shelf shelf})>{};
  for (final c in categories) {
    final section = c.section;
    final id = section?.id ?? 'other';
    final group = groups.putIfAbsent(
      id,
      () => (
        order: section?.displayOrder ?? 1 << 31,
        shelf: Shelf(id: id, name: section?.name, categories: []),
      ),
    );
    group.shelf.categories.add(c);
  }
  final sorted = groups.values.toList()
    ..sort((a, b) => a.order.compareTo(b.order));
  return [for (final g in sorted) g.shelf];
}

/// A category's cover picture, or null when it has none yet.
ImageProvider<Object>? coverOf(Category category) => category.coverUrl == null
    ? null
    : CatalogImages.provider(category.coverUrl!);

/// "فئة" or "فئات" after an Arabic count: plural from 3 to 10.
String categoryCount(LangController lang, int n) {
  final arabic = n >= 3 && n <= 10 ? 'فئات' : 'فئة';
  return lang.t('${lang.toAr(n)} $arabic', '$n fe2a${n == 1 ? '' : 't'}');
}

/// Where category covers come from: the server's public pictures, kept on
/// the phone after the first download. Tests swap in a local picture.
abstract final class CatalogImages {
  static ImageProvider<Object> Function(String url) provider = (url) =>
      CachedNetworkImageProvider(url);
}

class CatalogScope extends InheritedNotifier<CatalogController> {
  const CatalogScope({
    super.key,
    required CatalogController controller,
    required super.child,
  }) : super(notifier: controller);

  static CatalogController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<CatalogScope>();
    assert(scope != null, 'CatalogScope not found');
    return scope!.notifier!;
  }
}

extension CatalogContext on BuildContext {
  CatalogController get catalog => CatalogScope.of(this);
}
