import 'package:flutter/material.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/retro.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import 'category_widgets.dart';

/// Every category, grouped by section. Landscape: a game-style shelf with
/// section tabs; portrait fallback: a grid per section.
class CategoriesPage extends StatelessWidget {
  const CategoriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final size = MediaQuery.sizeOf(context);
    if (size.width > size.height) return const _Shelf();
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            lang.t('الفئات', 'El Fe2at'),
            style: AppText.display(34, height: 1.1),
          ),
          const SizedBox(height: 4),
          Text(
            lang.t(
              '${lang.toAr(allCategories.length)} فئة · اختاروا ${lang.toAr(boardCategories)} للوحة',
              '${allCategories.length} fe2a · ekhtaro $boardCategories lel lo7a',
            ),
            style: AppText.sans(
              14,
              color: AppColors.ivory.withValues(alpha: 0.65),
            ),
          ),
          for (final section in categorySections) ...[
            const SizedBox(height: 24),
            Text(
              lang.t(section.name, section.nameEn),
              style: AppText.display(22, height: 1.2),
            ),
            const SizedBox(height: 12),
            LayoutBuilder(
              builder: (context, box) {
                // Posters about 120px wide: 3 on a phone held upright, 6–7 sideways.
                final columns = (box.maxWidth / 125).floor().clamp(3, 8);
                const gap = 10.0;
                final width = (box.maxWidth - gap * (columns - 1)) / columns;
                return Wrap(
                  spacing: gap,
                  runSpacing: gap,
                  children: [
                    for (final category in section.categories)
                      SizedBox(
                        width: width,
                        height: width * 297 / 210 + Poster.stripMaxHeight,
                        child: CategoryPosterButton(
                          category: category,
                          titleSize: 14,
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

/// Landscape: section tabs over one row of large posters that scrolls
/// sideways, like a level picker.
class _Shelf extends StatefulWidget {
  const _Shelf();

  @override
  State<_Shelf> createState() => _ShelfState();
}

class _ShelfState extends State<_Shelf> {
  int _section = 0;
  final _scroll = ScrollController();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _select(int index) {
    if (index == _section) return;
    setState(() => _section = index);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final section = categorySections[_section];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            // The shell already keeps clear of cutouts.
            padding: EdgeInsets.zero,
            itemCount: categorySections.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final s = categorySections[i];
              return _SectionTab(
                label: lang.t(s.name, s.nameEn),
                count: s.categories.length,
                selected: i == _section,
                onTap: () => _select(i),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        // Posters pinned on a torn paper strip (brand deck, slide 41).
        Expanded(
          child: TornPaper(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
              child: _posters(section),
            ),
          ),
        ),
      ],
    );
  }

  Widget _posters(CategorySection section) {
    return LayoutBuilder(
      builder: (context, box) {
        // Posters as tall as the space allows.
        final height = box.maxHeight;
        final width = (height - Poster.stripMaxHeight) * 210 / 297;
        return AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: ListView.separated(
            key: ValueKey(_section),
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            // The shell already keeps clear of cutouts.
            padding: EdgeInsets.zero,
            itemCount: section.categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, i) => SizedBox(
              width: width,
              height: height,
              child: CategoryPosterButton(
                category: section.categories[i],
                titleSize: 15,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SectionTab extends StatelessWidget {
  const _SectionTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final color = selected ? AppColors.forest : AppColors.ivory;
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: selected
              ? BoxDecoration(
                  color: AppColors.gold,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: [
                    cssShadow(const Color(0x40FFC72C), y: 6, blur: 14),
                  ],
                )
              : glassDecoration(
                  radius: BorderRadius.circular(999),
                  shadow: false,
                ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: AppText.sans(14, weight: FontWeight.w700, color: color),
              ),
              const SizedBox(width: 6),
              Text(
                lang.toAr(count),
                style: AppText.num(13, color: color.withValues(alpha: 0.7)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
