import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../data/catalog.dart';
import '../game/setup_screen.dart';
import '../../core/ui/cover_image.dart';

/// Row heading with an optional "see all" action at the end.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.onSeeAll});

  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Row(
        children: [
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: AppText.display(24, height: 1.2)),
            ),
          ),
          if (onSeeAll != null)
            Semantics(
              button: true,
              child: Pressable(
                onTap: onSeeAll,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        lang.t('الكل', 'El kol'),
                        style: AppText.sans(
                          14,
                          weight: FontWeight.w600,
                          color: context.accentText,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        lang.ar
                            ? LucideIcons.chevronLeft
                            : LucideIcons.chevronRight,
                        size: 18,
                        color: context.accentText,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Edge-to-edge horizontal row of category posters.
class PosterRow extends StatelessWidget {
  const PosterRow({super.key, required this.categories, this.width = 132});

  final List<Category> categories;
  final double width;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: Poster.heightFor(width),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) => SizedBox(
          width: width,
          child: CategoryPosterButton(category: categories[i], tone: i),
        ),
      ),
    );
  }
}

/// A poster that opens the category's details sheet.
class CategoryPosterButton extends StatelessWidget {
  const CategoryPosterButton({super.key, required this.category, this.tone});

  final Category category;

  /// Tone index on the shelf; derived from the category when null.
  final int? tone;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Pressable(
      semanticLabel: category.playable
          ? category.name
          : lang.t('${category.name}، قريبًا', '${category.name}, 2orayeb'),
      onTap: () => showCategorySheet(context, category),
      child: Align(
        alignment: Alignment.topCenter,
        child: Poster(
          id: category.id,
          name: category.name,
          cover: coverOf(category),
          tone: tone,
          soon: !category.playable,
        ),
      ),
    );
  }
}

/// Category details: artwork, what it is, and a shortcut to play.
Future<void> showCategorySheet(BuildContext context, Category category) {
  final navigator = Navigator.of(context);
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    constraints: const BoxConstraints(maxWidth: 560),
    backgroundColor: Colors.transparent,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (sheetContext) {
      final lang = sheetContext.lang;
      final safe = MediaQuery.paddingOf(sheetContext).bottom;
      return Container(
        decoration: BoxDecoration(
          color: AppColors.forest,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(
            top: BorderSide(color: AppColors.gold.withValues(alpha: 0.3)),
          ),
        ),
        padding: EdgeInsets.fromLTRB(20, 10, 20, 20 + safe),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.ivory.withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: SizedBox(
                      width: 96,
                      height: 96 / Poster.aspect,
                      child: switch (coverOf(category)) {
                        final cover? => CoverPicture(
                          cover,
                          errorBuilder: (_, _, _) =>
                              const ColoredBox(color: AppColors.card),
                        ),
                        null => const ColoredBox(color: AppColors.card),
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          category.name,
                          style: AppText.display(28, height: 1.15),
                        ),
                        if (category.description case final about?) ...[
                          const SizedBox(height: 8),
                          Text(
                            about,
                            style: AppText.sans(
                              14,
                              height: 1.6,
                              color: AppColors.ivory.withValues(alpha: 0.75),
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        Text(
                          category.playable
                              ? lang.t(
                                  '${_packs(lang, category.publishedPackCount)}، '
                                      'كل باقة ٦ أسئلة من ٢٠٠ لـ٦٠٠ نقطة',
                                  '${category.publishedPackCount} ba2a, kol '
                                      'ba2a 6 as2ela men 200 le 600 no2ta',
                                )
                              : lang.t(
                                  'لسه مفيش باقات جاهزة في الفئة دي.',
                                  'Lessa mafeesh ba2at gahza fel fe2a di.',
                                ),
                          style: AppText.sans(
                            12,
                            weight: FontWeight.w600,
                            color: AppColors.ivory.withValues(alpha: 0.72),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              PlayButton(
                height: 58,
                // Until games run through the server, setup picks from
                // the offline categories, so this one isn't preselected.
                onPressed: category.playable
                    ? () {
                        Navigator.of(sheetContext).pop();
                        openSetup(navigator.context);
                      }
                    : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.play_arrow_rounded, size: 24),
                    const SizedBox(width: 10),
                    Text(
                      category.playable
                          ? lang.t('ابدأ لعبة', 'Ebda2 le3ba')
                          : lang.t('قريبًا', '2orayeban'),
                      // No colour: the button dims the label when disabled.
                      style: const TextStyle(
                        fontFamily: AppFonts.sans,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// "باقة" after an Arabic count: plural from 3 to 10.
String _packs(LangController lang, int n) =>
    '${lang.toAr(n)} ${n >= 3 && n <= 10 ? 'باقات' : 'باقة'}';

/// What a catalogue page shows before its categories are in: a quiet
/// "loading", or the real reason it failed with a way to try again.
class CatalogStatusView extends StatelessWidget {
  const CatalogStatusView({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final catalog = context.catalog;
    final error = catalog.error;
    final color = context.onPaper ? AppColors.ink : AppColors.ivory;
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (error == null) ...[
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 3, color: color),
              ),
              const SizedBox(height: 14),
              Text(
                lang.t('بنجيب الفئات…', 'Bengeeb el fe2at…'),
                style: AppText.sans(16, weight: FontWeight.w600, color: color),
              ),
            ] else ...[
              Text(
                error.message(lang),
                textAlign: TextAlign.center,
                style: AppText.sans(16, weight: FontWeight.w600, color: color),
              ),
              const SizedBox(height: 16),
              PlayButton(
                height: 48,
                onPressed: catalog.retry,
                child: Text(
                  lang.t('جرّب تاني', 'Garrab tany'),
                  style: const TextStyle(
                    fontFamily: AppFonts.sans,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
