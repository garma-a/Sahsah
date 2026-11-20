import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Two formats, like the web: Arabic (RTL) and "English" written in
/// Franco-Arabic (LTR, Latin script).
enum Lang { ar, en }

class LangController extends ChangeNotifier {
  LangController([this._lang = Lang.ar, this._prefs]);

  /// Same storage key as the web prototype (`sahsah.lang`).
  static const storageKey = 'sahsah.lang';

  static Future<LangController> load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(storageKey) == 'en' ? Lang.en : Lang.ar;
    return LangController(saved, prefs);
  }

  Lang _lang;
  final SharedPreferences? _prefs;

  Lang get lang => _lang;
  bool get ar => _lang == Lang.ar;
  TextDirection get direction => ar ? TextDirection.rtl : TextDirection.ltr;
  Locale get locale => ar ? const Locale('ar') : const Locale('en');

  /// `t('عربي', 'Franco')`: each string sits next to its translation.
  String t(String arabic, String franco) => ar ? arabic : franco;

  /// Arabic-Indic digits in Arabic, Western digits in Franco.
  String toAr(Object n) {
    final s = '$n';
    if (!ar) return s;
    const digits = '٠١٢٣٤٥٦٧٨٩';
    return s.replaceAllMapped(RegExp(r'\d'), (m) => digits[int.parse(m[0]!)]);
  }

  void setLang(Lang next) {
    if (next == _lang) return;
    _lang = next;
    _prefs?.setString(storageKey, next.name);
    notifyListeners();
  }

  void toggle() => setLang(ar ? Lang.en : Lang.ar);
}

class LangScope extends InheritedNotifier<LangController> {
  const LangScope({
    super.key,
    required LangController controller,
    required super.child,
  }) : super(notifier: controller);

  static LangController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<LangScope>();
    assert(scope != null, 'LangScope not found');
    return scope!.notifier!;
  }
}

extension LangContext on BuildContext {
  LangController get lang => LangScope.of(this);
}
