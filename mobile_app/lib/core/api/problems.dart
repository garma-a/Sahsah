import '../i18n/lang.dart';

/// Player-facing text for every problem code the app can reach, in Arabic
/// and Franco. Mirrors the website's `frontend/src/lib/api/problems.ts`
/// word for word in Arabic. The wire carries stable `code` values
/// (RFC 9457); the server's own `title` and `detail` are never shown.
const _byCode = <String, (String, String)>{
  // identity
  'UNAUTHENTICATED': (
    'الكود السري مش صح. اتأكد منه وجرّب تاني.',
    'El code el serry mesh sa7. Et2aked meno w garrab tany.',
  ),
  'INVALID_PROOF': (
    'الجلسة خلصت. ادخل تاني من الأول.',
    'El galsa khelset. Odkhol tany men el awel.',
  ),
  'CREDENTIAL_EXPIRED': (
    'الجلسة خلصت. ادخل تاني من الأول.',
    'El galsa khelset. Odkhol tany men el awel.',
  ),
  'CONTROLLER_FENCED': (
    'الغرفة بتتدار من جهاز تاني دلوقتي.',
    'El oda betetdar men gehaz tany delwa2ty.',
  ),
  'FRESH_CONTROL_SECRET_REQUIRED': (
    'الغرفة بتتدار من جهاز تاني. كمّل من هنا لو عايز تاخد التحكم.',
    'El oda betetdar men gehaz tany. Kammel men hena law 3ayez takhod el ta7akkom.',
  ),
  'STREAM_REPLACED': (
    'الغرفة اتفتحت على جهاز تاني.',
    'El oda etfata7et 3ala gehaz tany.',
  ),
  // limits and capacity
  'RATE_LIMITED': (
    'حاولت كتير في وقت قصير. استنى لحظة وجرّب تاني.',
    '7awelt keteer fe wa2t 2osayar. Estanna la7za w garrab tany.',
  ),
  'SERVER_AT_CAPACITY': (
    'السيرفر زحمة دلوقتي. جرّب تاني كمان شوية.',
    'El server za7ma delwa2ty. Garrab tany kaman shewaya.',
  ),
  'ADMISSION_PAUSED': (
    'السيرفر زحمة دلوقتي. جرّب تاني كمان شوية.',
    'El server za7ma delwa2ty. Garrab tany kaman shewaya.',
  ),
  'SERVICE_BUSY': (
    'السيرفر مشغول لحظة. جرّب تاني.',
    'El server mashghool la7za. Garrab tany.',
  ),
  'SERVICE_UNAVAILABLE': (
    'السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.',
    'El server mesh mota7 delwa2ty. Garrab tany ba3d shewaya.',
  ),
  'GAMEPLAY_DISABLED': (
    'اللعبة مقفولة دلوقتي. جرّب تاني بعد شوية.',
    'El le3ba ma2foola delwa2ty. Garrab tany ba3d shewaya.',
  ),
  'PRESSURE_UNAVAILABLE': (
    'السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.',
    'El server mesh mota7 delwa2ty. Garrab tany ba3d shewaya.',
  ),
  'INTERNAL_ERROR': (
    'حصلت مشكلة عندنا. جرّب تاني.',
    '7aslet moshkela 3andena. Garrab tany.',
  ),
  // input
  'INVALID_INPUT': (
    'في بيانات مش مظبوطة. راجع اللي كتبته وجرّب تاني.',
    'Fe bayanat mesh mazboota. Rage3 elly katabto w garrab tany.',
  ),
  'INVALID_INVITATION': (
    'الكود لازم يكون ٦ أرقام.',
    'El code lazem yekoon 6 ar2am.',
  ),
  'INVALID_IDENTIFIER': ('الرابط مش صح.', 'El link mesh sa7.'),
  'NOT_FOUND': (
    'ملقيناش اللي بتدور عليه.',
    'Mal2eenash elly betdawwar 3aleih.',
  ),
  // rooms and joining
  'ROOM_ALREADY_OPEN': (
    'عندك غرفة مفتوحة بالفعل.',
    '3andak oda maftoo7a bel fe3l.',
  ),
  'ACCOUNT_ALREADY_PLAYING': (
    'إنت داخل لعبة تانية دلوقتي.',
    'Enta dakhel le3ba tanya delwa2ty.',
  ),
  'ROOM_FULL': (
    'الغرفة اتملت. بتاخد ٥ لاعبين غير المضيف.',
    'El oda etmalet. Betakhod 5 la3eebeen gheir el host.',
  ),
  'ROOM_CLOSED': ('الغرفة اتقفلت.', 'El oda et2afalet.'),
  'ROOM_EXPIRED': (
    'الغرفة انتهت. اطلب من المضيف كود جديد.',
    'El oda entahet. Otlob men el host code gdeed.',
  ),
  'INVITATION_EXPIRED': (
    'الكود انتهى. اطلب من المضيف كود جديد.',
    'El code entaha. Otlob men el host code gdeed.',
  ),
  'INVITATION_UNAVAILABLE': (
    'الكود ده مش شغال. تأكد منه مع المضيف.',
    'El code da mesh shaghal. Et2aked meno ma3 el host.',
  ),
  'ALREADY_JOINED': (
    'إنت داخل الغرفة دي بالفعل.',
    'Enta dakhel el oda di bel fe3l.',
  ),
  'MEMBERSHIP_REVOKED': (
    'المضيف شالك من الغرفة.',
    'El host shalak men el oda.',
  ),
  'PARTICIPATION_ENDED': ('خرجت من اللعبة دي.', 'Kharagt men el le3ba di.'),
  'LOBBY_NOT_OPEN': (
    'الغرفة مش بتستقبل لاعبين دلوقتي.',
    'El oda mesh betesta2bel la3eebeen delwa2ty.',
  ),
  'GAME_ALREADY_STARTED': ('اللعبة بدأت بالفعل.', 'El le3ba bada2et bel fe3l.'),
  // lobby and start
  'MEMBERS_NOT_READY': (
    'لسه في لاعبين مش جاهزين.',
    'Lessa fe la3eebeen mesh gahzeen.',
  ),
  'HOST_SETUP_REQUIRED': (
    'كمّل تجهيز اللعبة الأول: ٦ فئات واسمين للفريقين.',
    'Kammel tag-heez el le3ba el awel: 6 fe2at w esmein lel fare2een.',
  ),
  'SIX_CATEGORIES_REQUIRED': (
    'لازم تختار ٦ فئات بالظبط.',
    'Lazem tekhtar 6 fe2at bel zabt.',
  ),
  'INVALID_SELECTION': (
    'في فئة مش مظبوطة. اختار تاني.',
    'Fe fe2a mesh mazboota. Ekhtar tany.',
  ),
  'SELECTION_CHANGED': (
    'الفئات اتغيرت. راجع اختيارك.',
    'El fe2at etghayaret. Rage3 ekhtiarak.',
  ),
  'CONTENT_NOT_READY': (
    'في فئة لسه مش جاهزة. اختار فئة تانية.',
    'Fe fe2a lessa mesh gahza. Ekhtar fe2a tanya.',
  ),
  'REPEAT_CONSENT_REQUIRED': (
    'في فئة اتلعبت قبل كده. اختار فئة تانية.',
    'Fe fe2a etle3bet 2abl keda. Ekhtar fe2a tanya.',
  ),
  'REPEAT_BASIS_CHANGED': (
    'اللاعبين اتغيروا. راجع الفئات.',
    'El la3eebeen etghayaro. Rage3 el fe2at.',
  ),
  'INSUFFICIENT_TOKENS': (
    'مش قادرين نبدأ اللعبة دلوقتي. كلم فريق صحصح.',
    'Mesh 2adreen nebda2 el le3ba delwa2ty. Kallem fare2 Sa7Sa7.',
  ),
  // versions and conflicts
  'STALE_ROOM_VERSION': (
    'الغرفة اتحدثت من شخص تاني. جرّب تاني.',
    'El oda et7addeset men 7ad tany. Garrab tany.',
  ),
  'STALE_MEMBER_VERSION': (
    'بياناتك اتحدثت. جرّب تاني.',
    'Bayanatak et7addeset. Garrab tany.',
  ),
  'STALE_READY_GENERATION': (
    'حد غيّر في الغرفة. أكد جاهزيتك تاني.',
    '7ad ghayyar fel oda. Akked gahzeyetak tany.',
  ),
  'STALE_GAME_VERSION': (
    'اللوحة اتحدثت. جرّب تاني.',
    'El lo7a et7addeset. Garrab tany.',
  ),
  'OPERATION_CONFLICT': (
    'الطلب ده اتبعت قبل كده بتفاصيل مختلفة. جرّب تاني.',
    'El talab da et-ba3at 2abl keda be tafaseel mokhtalefa. Garrab tany.',
  ),
  'STATE_CONFLICT': (
    'الحالة اتغيرت. جرّب تاني.',
    'El 7ala etghayaret. Garrab tany.',
  ),
  // game
  'INVALID_TRANSITION': (
    'مش ممكن تعمل ده دلوقتي.',
    'Mesh momken te3mel da delwa2ty.',
  ),
  'INVALID_POSITION': ('السؤال ده مش موجود.', 'El so2al da mesh mawgood.'),
  'QUESTION_NOT_CURRENT': (
    'السؤال ده مش المفتوح دلوقتي.',
    'El so2al da mesh el maftoo7 delwa2ty.',
  ),
  'QUESTION_UNAVAILABLE': ('السؤال ده مش متاح.', 'El so2al da mesh mota7.'),
  'RETURN_TO_BOARD_FIRST': ('ارجع للوحة الأول.', 'Erga3 lel lo7a el awel.'),
  'GAME_EXPIRED': (
    'اللعبة انتهت بسبب الخمول.',
    'El le3ba entahet 3ashan mafeesh 7araka.',
  ),
  'GAME_FINISHED': ('اللعبة خلصت.', 'El le3ba khelset.'),
  'CONTENT_PURGED': (
    'المحتوى ده مش متاح تاني.',
    'El mo7tawa da mesh mota7 tany.',
  ),
  // client-side
  'NETWORK': (
    'مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.',
    'Mafeesh ettesal bel server. Et2aked men el net w garrab tany.',
  ),
  'TIMEOUT': (
    'السيرفر اتأخر في الرد. جرّب تاني.',
    'El server et2akhar fel radd. Garrab tany.',
  ),
};

const _byStatus = <int, (String, String)>{
  400: ('في بيانات مش مظبوطة.', 'Fe bayanat mesh mazboota.'),
  401: ('لازم تدخل تاني.', 'Lazem todkhol tany.'),
  403: ('مش مسموح لك تعمل ده.', 'Mesh masmoo7lak te3mel da.'),
  404: ('ملقيناش اللي بتدور عليه.', 'Mal2eenash elly betdawwar 3aleih.'),
  409: ('الحالة اتغيرت. جرّب تاني.', 'El 7ala etghayaret. Garrab tany.'),
  410: ('ده مش متاح تاني.', 'Da mesh mota7 tany.'),
  429: ('حاولت كتير. استنى لحظة.', '7awelt keteer. Estanna la7za.'),
  503: (
    'السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.',
    'El server mesh mota7 delwa2ty. Garrab tany ba3d shewaya.',
  ),
};

/// When the cause is unknown, say so rather than borrow a specific message.
const _generic = ('حصلت مشكلة. جرّب تاني.', '7aslet moshkela. Garrab tany.');

/// The text for a problem [code] (or, for an unknown code, its [status]).
String problemMessage(LangController lang, String code, int status) {
  final (ar, franco) = _byCode[code] ?? _byStatus[status] ?? _generic;
  return lang.t(ar, franco);
}

/// The text for something that went wrong with no problem code at all.
String genericProblem(LangController lang) => lang.t(_generic.$1, _generic.$2);

/// Codes meaning the saved sign-in is no longer accepted: sign in again.
bool isIdentityRejected(String code) =>
    code == 'INVALID_PROOF' ||
    code == 'CREDENTIAL_EXPIRED' ||
    code == 'UNAUTHENTICATED';
