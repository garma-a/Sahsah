import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../data/categories.dart';
import '../../data/question_bank.dart';
import '../game/setup_screen.dart';

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
                          color: AppColors.gold,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        lang.ar
                            ? LucideIcons.chevronLeft
                            : LucideIcons.chevronRight,
                        size: 18,
                        color: AppColors.gold,
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
      height: width * 297 / 210 + Poster.stripMaxHeight,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, i) => SizedBox(
          width: width,
          child: CategoryPosterButton(category: categories[i], titleSize: 15),
        ),
      ),
    );
  }
}

/// A poster that opens the category's details sheet.
class CategoryPosterButton extends StatelessWidget {
  const CategoryPosterButton({
    super.key,
    required this.category,
    this.titleSize = 15,
  });

  final Category category;
  final double titleSize;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Semantics(
      button: true,
      label: lang.t(category.name, category.nameEn),
      excludeSemantics: true,
      child: Pressable(
        onTap: () => showCategorySheet(context, category),
        child: Align(
          alignment: Alignment.topCenter,
          child: Poster(category: category, titleSize: titleSize, radius: 16),
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
                    child: Image.asset(
                      BrandImages.category(category.id),
                      width: 96,
                      height: 96 * 297 / 210,
                      fit: BoxFit.cover,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (category.isNew)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              lang.t('تحدي جديد', 'Ta7addy gdeed'),
                              style: AppText.sans(
                                12,
                                weight: FontWeight.w700,
                                color: AppColors.gold,
                              ),
                            ),
                          ),
                        Text(
                          lang.t(category.name, category.nameEn),
                          style: AppText.display(28, height: 1.15),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          lang.t(category.help, category.helpEn),
                          style: AppText.sans(
                            14,
                            height: 1.6,
                            color: AppColors.ivory.withValues(alpha: 0.75),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          lang.t(
                            '٦ أسئلة · ٢٠٠ لـ٦٠٠ نقطة',
                            '6 as2ela · 200 le 600 no2ta',
                          ),
                          style: AppText.sans(
                            12,
                            weight: FontWeight.w600,
                            color: AppColors.ivory.withValues(alpha: 0.5),
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
                onPressed: isPlayable(category.id)
                    ? () {
                        Navigator.of(sheetContext).pop();
                        openSetup(navigator.context, categoryId: category.id);
                      }
                    : null,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.play_arrow_rounded, size: 24),
                    const SizedBox(width: 10),
                    Text(
                      isPlayable(category.id)
                          ? lang.t('العب بالفئة دي', 'El3ab bel fe2a di')
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
