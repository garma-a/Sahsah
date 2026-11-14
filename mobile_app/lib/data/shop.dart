import 'categories.dart';

/// Token packs from the prototype (`TOKEN_PRESETS`, `TOKEN_PRICE` in
/// `sahsah_prototype/src/lib/data.ts`). One token is one game.
const tokenPrice = 10; // EGP per token.
const tokenPacks = [1, 2, 5];

/// The pack marked "most popular".
const featuredPack = 2;

/// Price of a pack in EGP. Gifts are always [giftDiscount] off. Rounded to
/// piastres like the prototype's `orderTotal`.
double packPrice(int count, {bool gift = false}) {
  final list = count * tokenPrice * (gift ? 1 - giftDiscount : 1);
  return (list * 100).round() / 100;
}

/// Price without any discount, for the struck-through "was" price.
int packListPrice(int count) => count * tokenPrice;

/// Digits only, without the +20 country code or the leading 0.
String normalizeEgyptianMobile(String raw) => raw
    .replaceAll(RegExp(r'\D'), '')
    .replaceFirst(RegExp(r'^20'), '')
    .replaceFirst(RegExp(r'^0'), '');

/// Egyptian mobile numbers: 010, 011, 012 or 015 followed by 8 digits.
bool isEgyptianMobile(String raw) =>
    RegExp(r'^1[0125]\d{8}$').hasMatch(normalizeEgyptianMobile(raw));

/// A simple email shape check (something@something.tld).
bool isEmail(String raw) => RegExp(r'^\S+@\S+\.\S+$').hasMatch(raw.trim());
