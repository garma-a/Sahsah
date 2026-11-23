/// Gifts are this much off: 20%, as the website's promo ticker says. The
/// backend makes it an admin setting (`shop_settings.gift_discount_bps`);
/// once the app reads the shop settings, it comes from there.
const giftDiscount = 0.2;

/// Games a board holds: six categories × six tiles.
const boardCategories = 6;
const boardQuestions = 36;
