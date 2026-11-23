// Wire types of the Sahsah gameplay API (`/api/v1`), mirroring the website's
// `frontend/src/lib/api/types.ts` (itself from `docs/api/openapi.json`).
// Only what the app uses; bigints travel as decimal strings.

typedef Json = Map<String, dynamic>;

/// The content languages the API serves. Franco falls back to Arabic where a
/// category has no Franco text.
enum ContentLanguage { ar, franco }

class CategorySection {
  const CategorySection({
    required this.id,
    required this.name,
    required this.displayOrder,
  });

  factory CategorySection.fromJson(Json j) => CategorySection(
    id: j['id'] as String,
    name: j['name'] as String,
    displayOrder: (j['displayOrder'] as num).toInt(),
  );

  final String id;
  final String name;
  final int displayOrder;

  Json toJson() => {'id': id, 'name': name, 'displayOrder': displayOrder};
}

/// A category in the public catalogue.
class Category {
  const Category({
    required this.id,
    required this.name,
    this.description,
    this.section,
    this.coverUrl,
    required this.publishedPackCount,
  });

  factory Category.fromJson(Json j) => Category(
    id: j['id'] as String,
    name: j['name'] as String,
    description: j['description'] as String?,
    section: j['section'] == null
        ? null
        : CategorySection.fromJson(j['section'] as Json),
    coverUrl: j['coverUrl'] as String?,
    publishedPackCount: (j['publishedPackCount'] as num).toInt(),
  );

  final String id;
  final String name;
  final String? description;
  final CategorySection? section;

  /// A public picture; absent when the category has no cover yet.
  final String? coverUrl;

  /// Packs of six questions. A category with none can't be played.
  final int publishedPackCount;

  bool get playable => publishedPackCount > 0;

  Json toJson() => {
    'id': id,
    'name': name,
    'description': ?description,
    'section': ?section?.toJson(),
    'coverUrl': ?coverUrl,
    'publishedPackCount': publishedPackCount,
  };
}

/// One page of a keyset-paginated list.
class Page<T> {
  const Page(this.items, this.nextCursor);

  factory Page.fromJson(Json j, T Function(Json) item) => Page([
    for (final e in j['items'] as List) item(e as Json),
  ], j['nextCursor'] as String?);

  final List<T> items;
  final String? nextCursor;
}

/// The device's preview host sign-in (ADR 0017).
class PreviewSession {
  const PreviewSession({
    required this.credential,
    required this.expiresAt,
    required this.accountId,
    required this.displayName,
  });

  factory PreviewSession.fromJson(Json j) => PreviewSession(
    credential: j['credential'] as String,
    expiresAt: DateTime.parse(j['expiresAt'] as String),
    accountId: j['accountId'] as String,
    displayName: j['displayName'] as String,
  );

  /// Sent as `Authorization: Bearer …`. Never logged.
  final String credential;
  final DateTime expiresAt;
  final String accountId;
  final String displayName;

  Json toJson() => {
    'credential': credential,
    'expiresAt': expiresAt.toIso8601String(),
    'accountId': accountId,
    'displayName': displayName,
  };
}
