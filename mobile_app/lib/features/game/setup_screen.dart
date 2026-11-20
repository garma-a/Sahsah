import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:lucide_icons_flutter/lucide_icons_600.dart';

import '../../core/i18n/lang.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/brand_art.dart';
import '../../core/ui/play_button.dart';
import '../../core/ui/pressable.dart';
import '../../core/ui/surfaces.dart';
import '../../data/categories.dart';
import '../../data/question_bank.dart';
import 'board_screen.dart';
import 'game_controller.dart';
import 'ui/game_ui.dart';

/// Opens game setup. [categoryId] preselects a category (from its sheet).
Future<void> openSetup(
  BuildContext context, {
  String? categoryId,
  List<String>? categoryIds,
  List<String>? teams,
}) {
  return Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => SetupScreen(
        initialCategories: categoryIds ?? [?categoryId],
        initialTeams: teams,
        startOnTeams: categoryIds?.length == boardCategories,
      ),
    ),
  );
}

/// Two steps: pick six categories, then name the two teams.
class SetupScreen extends StatefulWidget {
  const SetupScreen({
    super.key,
    this.initialCategories = const [],
    this.initialTeams,
    this.startOnTeams = false,
  });

  final List<String> initialCategories;
  final List<String>? initialTeams;

  /// Replay: categories are already chosen.
  final bool startOnTeams;

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  late final List<String> _selected = [
    for (final id in widget.initialCategories)
      if (isPlayable(id)) id,
  ];
  late int _step = widget.startOnTeams ? 1 : 0;
  late final List<TextEditingController> _teams;

  @override
  void initState() {
    super.initState();
    final names = widget.initialTeams;
    _teams = [
      for (var i = 0; i < 2; i++)
        TextEditingController(text: names == null ? null : names[i]),
    ];
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final lang = context.lang;
    // Default names in the current language, only while untouched.
    final defaults = [
      lang.t('الفراعنة', 'El Fara3na'),
      lang.t('الجدعان', 'El Ged3an'),
    ];
    for (var i = 0; i < 2; i++) {
      if (_teams[i].text.isEmpty) _teams[i].text = defaults[i];
    }
  }

  @override
  void dispose() {
    for (final c in _teams) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _full => _selected.length == boardCategories;

  void _toggle(String id) {
    final lang = context.lang;
    if (!isPlayable(id)) {
      _toast(lang.t('الفئة دي جاية قريب', 'El fe2a di gaya 2orayeb'));
      return;
    }
    setState(() {
      if (_selected.contains(id)) {
        _selected.remove(id);
      } else if (_full) {
        HapticFeedback.heavyImpact();
        _toast(
          lang.t(
            'اخترتوا ٦ فئات. شيلوا واحدة الأول.',
            'Ekhtarto 6 fe2at. Sheelo wa7da el awel.',
          ),
        );
      } else {
        _selected.add(id);
      }
    });
  }

  void _pick(List<String> ids) => setState(
    () => _selected
      ..clear()
      ..addAll(ids.where(isPlayable).take(boardCategories)),
  );

  void _random() {
    final pool = [
      for (final c in allCategories)
        if (isPlayable(c.id)) c.id,
    ]..shuffle(math.Random());
    _pick(pool);
  }

  void _toast(String text) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: AppColors.ui,
          content: Text(text, style: AppText.sans(14, weight: FontWeight.w600)),
        ),
      );
  }

  Future<void> _start() async {
    final lang = context.lang;
    final game = context.game;
    if (game.hasActiveGame) {
      final ok = await confirmDialog(
        context,
        title: lang.t('نبدأ لعبة جديدة؟', 'Nebda2 le3ba gdeeda?'),
        message: lang.t(
          'عندكم لعبة لسه مخلصتش. اللعبة الجديدة هتمسحها.',
          '3andoko le3ba lessa makhlasetsh. El le3ba el gdeeda hatmsa7ha.',
        ),
        confirm: lang.t('ابدأ جديدة', 'Ebda2 gdeeda'),
        destructive: true,
      );
      if (!ok || !mounted) return;
    }
    final names = [
      for (var i = 0; i < 2; i++)
        _teams[i].text.trim().isEmpty
            ? (i == 0
                  ? lang.t('الفراعنة', 'El Fara3na')
                  : lang.t('الجدعان', 'El Ged3an'))
            : _teams[i].text.trim(),
    ];
    game.start(categoryIds: _selected, teams: names);
    if (!mounted) return;
    Navigator.of(
      context,
    ).pushReplacement(MaterialPageRoute(builder: (_) => const BoardScreen()));
  }

  void _back() {
    if (_step == 1 && !widget.startOnTeams) {
      setState(() => _step = 0);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return PopScope(
      canPop: _step == 0 || widget.startOnTeams,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _step = 0);
      },
      child: GameScaffold(
        bottom: _step == 0 ? _categoriesBar(lang) : _teamsBar(lang),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: Row(
                children: [
                  RoundIconButton(
                    icon: _step == 0 || widget.startOnTeams
                        ? LucideIcons.x
                        : (lang.ar
                              ? LucideIcons.arrowRight
                              : LucideIcons.arrowLeft),
                    label: lang.t('رجوع', 'Rogoo3'),
                    onTap: _back,
                  ),
                  const Spacer(),
                  _StepDots(step: _step),
                ],
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                child: _step == 0
                    ? _CategoryStep(
                        key: const ValueKey('categories'),
                        selected: _selected,
                        onToggle: _toggle,
                        onPreset: () => _pick(const [
                          'person',
                          'color',
                          'riddle',
                          'memory',
                          'general',
                          'football',
                        ]),
                        onRandom: _random,
                      )
                    : _TeamsStep(
                        key: const ValueKey('teams'),
                        controllers: _teams,
                        selected: _selected,
                        onEditCategories: widget.startOnTeams
                            ? null
                            : () => setState(() => _step = 0),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _categoriesBar(LangController lang) {
    final n = _selected.length;
    return Row(
      children: [
        Expanded(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: lang.toAr(n),
                      style: AppText.num(22, height: 1.1),
                    ),
                    TextSpan(
                      text: lang.t(
                        ' من ${lang.toAr(boardCategories)} فئات',
                        ' men $boardCategories fe2at',
                      ),
                      style: AppText.sans(15, weight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  for (var i = 0; i < boardCategories; i++) ...[
                    if (i > 0) const SizedBox(width: 4),
                    Expanded(
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        height: 5,
                        decoration: BoxDecoration(
                          color: i < n
                              ? AppColors.gold
                              : Colors.white.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        SizedBox(
          width: 150,
          child: GoldButton(
            height: 54,
            label: lang.t('التالي', 'El taly'),
            icon: lang.ar
                ? LucideIcons600.arrowLeft
                : LucideIcons600.arrowRight,
            onTap: _full ? () => setState(() => _step = 1) : null,
          ),
        ),
      ],
    );
  }

  Widget _teamsBar(LangController lang) {
    return PlayButton(
      height: 60,
      sheen: true,
      onPressed: _full ? _start : null,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.play_arrow_rounded, size: 28),
          const SizedBox(width: 8),
          Text(
            lang.t('ابدأ اللعبة', 'Ebda2 el le3ba'),
            style: AppText.sans(
              20,
              weight: FontWeight.w700,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _StepDots extends StatelessWidget {
  const _StepDots({required this.step});

  final int step;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Row(
      children: [
        Text(
          lang.t(
            'خطوة ${lang.toAr(step + 1)} من ${lang.toAr(2)}',
            'Khatwa ${step + 1} men 2',
          ),
          style: AppText.sans(
            13,
            weight: FontWeight.w600,
            color: AppColors.ivory.withValues(alpha: 0.6),
          ),
        ),
        const SizedBox(width: 10),
        for (var i = 0; i < 2; i++) ...[
          if (i > 0) const SizedBox(width: 4),
          AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: i == step ? 22 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: i == step
                  ? AppColors.gold
                  : Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ],
    );
  }
}

class _CategoryStep extends StatelessWidget {
  const _CategoryStep({
    super.key,
    required this.selected,
    required this.onToggle,
    required this.onPreset,
    required this.onRandom,
  });

  final List<String> selected;
  final ValueChanged<String> onToggle;
  final VoidCallback onPreset;
  final VoidCallback onRandom;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final intro = [
      Text(
        lang.t('اختاروا ٦ فئات', 'Ekhtaro 6 fe2at'),
        style: AppText.display(32, height: 1.15),
      ),
      const SizedBox(height: 4),
      Text(
        lang.t(
          'كل فئة فيها ٦ أسئلة من ٢٠٠ لـ٦٠٠ نقطة.',
          'Kol fe2a feeha 6 as2ela men 200 le 600 no2ta.',
        ),
        style: AppText.sans(14, color: AppColors.ivory.withValues(alpha: 0.65)),
      ),
    ];
    final picks = [
      _QuickPick(
        icon: LucideIcons.sparkles,
        label: lang.t('التحديات الجديدة', 'El ta7adyat el gdeeda'),
        onTap: onPreset,
      ),
      _QuickPick(
        icon: LucideIcons.shuffle,
        label: lang.t('عشوائي', '3ashwa2y'),
        onTap: onRandom,
      ),
    ];

    return LayoutBuilder(
      builder: (context, box) {
        // Landscape: title and quick picks in a side column so the posters
        // start at the top of the screen instead of under the fold.
        if (box.maxWidth > 700) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 230,
                child: ListView(
                  padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 0, 16),
                  children: [
                    ...intro,
                    const SizedBox(height: 16),
                    for (final pick in picks) ...[
                      pick,
                      const SizedBox(height: 8),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ListView(
                  padding: const EdgeInsetsDirectional.fromSTEB(0, 8, 16, 24),
                  children: _sections(lang, first: 0),
                ),
              ),
            ],
          );
        }
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            ...intro,
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: picks),
            ..._sections(lang, first: 22),
          ],
        );
      },
    );
  }

  /// Each section's posters; [first] is the gap above the first title.
  List<Widget> _sections(LangController lang, {required double first}) {
    return [
      for (final (i, section) in categorySections.indexed) ...[
        SizedBox(height: i == 0 ? first : 22),
        Text(
          lang.t(section.name, section.nameEn),
          style: AppText.display(22, height: 1.2),
        ),
        const SizedBox(height: 10),
        LayoutBuilder(
          builder: (context, box) {
            // Posters about 120px wide: 3 on a phone held upright, 5–6 beside the side column.
            final columns = (box.maxWidth / 120).floor().clamp(3, 8);
            const gap = 10.0;
            final width = (box.maxWidth - gap * (columns - 1)) / columns;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                for (final c in section.categories)
                  SizedBox(
                    width: width,
                    height: width * 297 / 210 + Poster.stripMaxHeight,
                    child: _SelectablePoster(
                      category: c,
                      order: selected.indexOf(c.id),
                      full: selected.length == boardCategories,
                      onTap: () => onToggle(c.id),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    ];
  }
}

class _QuickPick extends StatelessWidget {
  const _QuickPick({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      child: Pressable(
        onTap: onTap,
        child: Container(
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            color: AppColors.gold.withValues(alpha: 0.12),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: AppColors.gold),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.sans(
                    14,
                    weight: FontWeight.w600,
                    color: AppColors.gold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SelectablePoster extends StatelessWidget {
  const _SelectablePoster({
    required this.category,
    required this.order,
    required this.full,
    required this.onTap,
  });

  final Category category;

  /// Position in the selection, or -1.
  final int order;
  final bool full;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final selected = order >= 0;
    final available = isPlayable(category.id);
    final dimmed = !available || (full && !selected);
    return Semantics(
      button: true,
      selected: selected,
      enabled: available,
      label: lang.t(category.name, category.nameEn),
      excludeSemantics: true,
      child: Pressable(
        onTap: onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 160),
          opacity: dimmed ? 0.4 : 1,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Poster(
                    category: category,
                    titleSize: 14,
                    radius: 16,
                    showNewBadge: !selected && available,
                  ),
                ),
              ),
              // Selection frame drawn over the poster.
              Positioned.fill(
                child: IgnorePointer(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: selected ? AppColors.gold : Colors.transparent,
                        width: 3,
                      ),
                    ),
                  ),
                ),
              ),
              if (selected)
                PositionedDirectional(
                  top: 6,
                  start: 6,
                  child: Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.gold,
                      shape: BoxShape.circle,
                      boxShadow: [
                        cssShadow(const Color(0x66000000), y: 2, blur: 8),
                      ],
                    ),
                    child: Text(
                      lang.toAr(order + 1),
                      style: AppText.num(16, color: AppColors.forest),
                    ),
                  ),
                ),
              if (!available)
                PositionedDirectional(
                  top: 6,
                  start: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.deep.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      lang.t('قريبًا', '2orayeban'),
                      style: AppText.sans(
                        11,
                        weight: FontWeight.w700,
                        color: AppColors.gold,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TeamsStep extends StatelessWidget {
  const _TeamsStep({
    super.key,
    required this.controllers,
    required this.selected,
    required this.onEditCategories,
  });

  final List<TextEditingController> controllers;
  final List<String> selected;
  final VoidCallback? onEditCategories;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final chosen = [
      for (final id in selected) allCategories.firstWhere((c) => c.id == id),
    ];
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        Text(
          lang.t('سمّوا الفريقين', 'Sammo el fare2een'),
          style: AppText.display(32, height: 1.15),
        ),
        const SizedBox(height: 4),
        Text(
          lang.t(
            'اسم حلو للفريق نص المكسب.',
            'Esm 7elw lel fare2 nos el maksab.',
          ),
          style: AppText.sans(
            14,
            color: AppColors.ivory.withValues(alpha: 0.65),
          ),
        ),
        const SizedBox(height: 18),
        LayoutBuilder(
          builder: (context, box) {
            final vs = Text(
              'VS',
              style: AppText.display(
                22,
                color: AppColors.ivory.withValues(alpha: 0.5),
              ),
            );
            // Wide (landscape): the two teams face each other side by side.
            if (box.maxWidth > 560) {
              return Row(
                children: [
                  Expanded(
                    child: _TeamField(index: 0, controller: controllers[0]),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: vs,
                  ),
                  Expanded(
                    child: _TeamField(index: 1, controller: controllers[1]),
                  ),
                ],
              );
            }
            return Column(
              children: [
                _TeamField(index: 0, controller: controllers[0]),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: vs,
                ),
                _TeamField(index: 1, controller: controllers[1]),
              ],
            );
          },
        ),
        const SizedBox(height: 26),
        Row(
          children: [
            Expanded(
              child: Text(
                lang.t('فئاتكم', 'Fe2atkom'),
                style: AppText.display(22, height: 1.2),
              ),
            ),
            if (onEditCategories != null)
              Semantics(
                button: true,
                child: Pressable(
                  onTap: onEditCategories,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(
                      lang.t('غيّر', 'Ghayyar'),
                      style: AppText.sans(
                        14,
                        weight: FontWeight.w700,
                        color: AppColors.gold,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final c in chosen)
              Container(
                padding: const EdgeInsetsDirectional.fromSTEB(4, 4, 12, 4),
                decoration: glassDecoration(
                  radius: BorderRadius.circular(999),
                  shadow: false,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    ClipOval(
                      child: Image.asset(
                        BrandImages.category(c.id),
                        width: 28,
                        height: 28,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      lang.t(c.name, c.nameEn),
                      style: AppText.sans(13, weight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
          ],
        ),
        const SizedBox(height: 22),
        Glass(
          radius: 18,
          shadow: false,
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(LucideIcons.info, size: 18, color: AppColors.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  lang.t(
                    'تجريبي: اللعبة شغالة على الموبايل ده ومش هيتخصم توكن. دعوة الشلة بالكود جاية مع غرف اللعب.',
                    'Tagreeby: el le3ba shaghala 3al mobile da w mesh hayetkhesem token. Da3wet el shella bel code gaya ma3 ghoraf el le3b.',
                  ),
                  style: AppText.sans(
                    13,
                    height: 1.6,
                    color: AppColors.ivory.withValues(alpha: 0.7),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TeamField extends StatelessWidget {
  const _TeamField({required this.index, required this.controller});

  final int index;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final color = teamColors[index];
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: color.withValues(alpha: 0.1),
        border: Border.all(color: color.withValues(alpha: 0.55), width: 1.5),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            child: Text(
              lang.toAr(index + 1),
              style: AppText.num(18, color: AppColors.forest),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              key: ValueKey('team-$index'),
              controller: controller,
              maxLength: 20,
              textInputAction: index == 0
                  ? TextInputAction.next
                  : TextInputAction.done,
              style: AppText.display(24, height: 1.3),
              cursorColor: color,
              decoration: InputDecoration(
                isDense: true,
                counterText: '',
                border: InputBorder.none,
                labelText: index == 0
                    ? lang.t('الفريق الأول', 'El fare2 el awel')
                    : lang.t('الفريق التاني', 'El fare2 el tany'),
                labelStyle: AppText.sans(
                  13,
                  weight: FontWeight.w600,
                  color: color,
                ),
                floatingLabelBehavior: FloatingLabelBehavior.always,
              ),
            ),
          ),
          Icon(
            LucideIcons.pencil,
            size: 16,
            color: AppColors.ivory.withValues(alpha: 0.4),
          ),
        ],
      ),
    );
  }
}
