import 'package:flutter/material.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/retro.dart';
import '../../core/ui/surfaces.dart';
import '../../data/catalog.dart';
import '../../data/game_rules.dart';
import 'category_widgets.dart';
import '../../core/ui/motion.dart';

/// Every category, grouped by section. Landscape: a game-style shelf with
/// section tabs; portrait fallback: a grid per section.
class CategoriesPage extends StatelessWidget {
  const CategoriesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final catalog = context.catalog;
    final size = MediaQuery.sizeOf(context);
    if (catalog.status != CatalogStatus.ready) {
      return const CatalogStatusView();
    }
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
              '${categoryCount(lang, catalog.categories.length)} · اختاروا ${lang.toAr(boardCategories)} للوحة',
              '${categoryCount(lang, catalog.categories.length)} · ekhtaro $boardCategories lel lo7a',
            ),
            style: AppText.sans(14, color: context.mutedText),
          ),
          for (final section in catalog.shelves) ...[
            const SizedBox(height: 24),
            Text(section.title(lang), style: AppText.display(22, height: 1.2)),
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
                    for (final (i, category) in section.categories.indexed)
                      SizedBox(
                        width: width,
                        height: Poster.heightFor(width),
                        child: CategoryPosterButton(
                          category: category,
                          tone: i,
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
    final shelves = context.catalog.shelves;
    // A refresh can bring fewer sections than were on screen.
    final section = shelves[_section.clamp(0, shelves.length - 1)];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            // The shell already keeps clear of cutouts.
            padding: EdgeInsets.zero,
            itemCount: shelves.length,
            separatorBuilder: (_, _) => const SizedBox(width: 8),
            itemBuilder: (context, i) {
              final s = shelves[i];
              return _SectionTab(
                label: s.title(lang),
                count: s.categories.length,
                selected: s == section,
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

  Widget _posters(Shelf section) {
    return LayoutBuilder(
      builder: (context, box) {
        // Posters as tall as the space allows.
        final height = box.maxHeight;
        final width = Poster.widthFor(height);
        return AnimatedSwitcher(
          duration: motionFor(context, const Duration(milliseconds: 200)),
          child: ListView.separated(
            key: ValueKey(section.id),
            controller: _scroll,
            scrollDirection: Axis.horizontal,
            // The shell already keeps clear of cutouts.
            padding: EdgeInsets.zero,
            itemCount: section.categories.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            // The posters rise onto the shelf one after another.
            itemBuilder: (context, i) => SizedBox(
              width: width,
              height: height,
              child: Rise(
                delay: Rise.step(i),
                child: CategoryPosterButton(
                  category: section.categories[i],
                  tone: i,
                ),
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
    final paper = context.onPaper;
    final color = selected || paper ? AppColors.ink : AppColors.ivory;
    return Semantics(
      button: true,
      selected: selected,
      child: Pressable(
        onTap: onTap,
        child: AnimatedContainer(
          duration: motionFor(context, const Duration(milliseconds: 180)),
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: selected
              ? BoxDecoration(
                  color: AppColors.gold,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.ink, width: 2.5),
                  boxShadow: [inkDrop(3)],
                )
              : paper
              ? paperDecoration(
                  radius: BorderRadius.circular(999),
                  color: Colors.white,
                  border: 2.5,
                  drop: 0,
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
