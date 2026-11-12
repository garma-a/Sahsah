// Friendly Arabic text for every problem code a player or host can reach from this UI.
// The wire carries stable `code` values (RFC 9457); we never show the server's own text.

const byCode: Record<string, string> = {
  // identity
  UNAUTHENTICATED: "الكود السري مش صح. اتأكد منه وجرّب تاني.",
  INVALID_PROOF: "الجلسة خلصت. ادخل تاني من الأول.",
  CREDENTIAL_EXPIRED: "الجلسة خلصت. ادخل تاني من الأول.",
  CONTROLLER_FENCED: "الغرفة بتتدار من جهاز تاني دلوقتي.",
  FRESH_CONTROL_SECRET_REQUIRED: "الغرفة بتتدار من جهاز تاني. كمّل من هنا لو عايز تاخد التحكم.",
  STREAM_REPLACED: "الغرفة اتفتحت على جهاز تاني.",
  // limits and capacity
  RATE_LIMITED: "حاولت كتير في وقت قصير. استنى لحظة وجرّب تاني.",
  SERVER_AT_CAPACITY: "السيرفر زحمة دلوقتي. جرّب تاني كمان شوية.",
  ADMISSION_PAUSED: "السيرفر زحمة دلوقتي. جرّب تاني كمان شوية.",
  SERVICE_BUSY: "السيرفر مشغول لحظة. جرّب تاني.",
  SERVICE_UNAVAILABLE: "السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.",
  GAMEPLAY_DISABLED: "اللعبة مقفولة دلوقتي. جرّب تاني بعد شوية.",
  PRESSURE_UNAVAILABLE: "السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.",
  INTERNAL_ERROR: "حصلت مشكلة عندنا. جرّب تاني.",
  // input
  INVALID_INPUT: "في بيانات مش مظبوطة. راجع اللي كتبته وجرّب تاني.",
  INVALID_INVITATION: "الكود لازم يكون ٦ أرقام.",
  INVALID_IDENTIFIER: "الرابط مش صح.",
  NOT_FOUND: "ملقيناش اللي بتدور عليه.",
  // rooms and joining
  ROOM_ALREADY_OPEN: "عندك غرفة مفتوحة بالفعل.",
  ACCOUNT_ALREADY_PLAYING: "إنت داخل لعبة تانية دلوقتي.",
  ROOM_FULL: "الغرفة اتملت. بتاخد ٥ لاعبين غير المضيف.",
  ROOM_CLOSED: "الغرفة اتقفلت.",
  ROOM_EXPIRED: "الغرفة انتهت. اطلب من المضيف كود جديد.",
  INVITATION_EXPIRED: "الكود انتهى. اطلب من المضيف كود جديد.",
  INVITATION_UNAVAILABLE: "الكود ده مش شغال. تأكد منه مع المضيف.",
  ALREADY_JOINED: "إنت داخل الغرفة دي بالفعل.",
  MEMBERSHIP_REVOKED: "المضيف شالك من الغرفة.",
  PARTICIPATION_ENDED: "خرجت من اللعبة دي.",
  LOBBY_NOT_OPEN: "الغرفة مش بتستقبل لاعبين دلوقتي.",
  GAME_ALREADY_STARTED: "اللعبة بدأت بالفعل.",
  // lobby and start
  MEMBERS_NOT_READY: "لسه في لاعبين مش جاهزين.",
  HOST_SETUP_REQUIRED: "كمّل تجهيز اللعبة الأول: ٦ فئات واسمين للفريقين.",
  SIX_CATEGORIES_REQUIRED: "لازم تختار ٦ فئات بالظبط.",
  INVALID_SELECTION: "في فئة مش مظبوطة. اختار تاني.",
  SELECTION_CHANGED: "الفئات اتغيرت. راجع اختيارك.",
  CONTENT_NOT_READY: "في فئة لسه مش جاهزة. اختار فئة تانية.",
  REPEAT_CONSENT_REQUIRED: "في فئة اتلعبت قبل كده. اختار فئة تانية.",
  REPEAT_BASIS_CHANGED: "اللاعبين اتغيروا. راجع الفئات.",
  INSUFFICIENT_TOKENS: "مش قادرين نبدأ اللعبة دلوقتي. كلم فريق صحصح.",
  // versions and conflicts
  STALE_ROOM_VERSION: "الغرفة اتحدثت من شخص تاني. جرّب تاني.",
  STALE_MEMBER_VERSION: "بياناتك اتحدثت. جرّب تاني.",
  STALE_READY_GENERATION: "حد غيّر في الغرفة. أكد جاهزيتك تاني.",
  STALE_GAME_VERSION: "اللوحة اتحدثت. جرّب تاني.",
  OPERATION_CONFLICT: "الطلب ده اتبعت قبل كده بتفاصيل مختلفة. جرّب تاني.",
  STATE_CONFLICT: "الحالة اتغيرت. جرّب تاني.",
  // game
  INVALID_TRANSITION: "مش ممكن تعمل ده دلوقتي.",
  INVALID_POSITION: "السؤال ده مش موجود.",
  QUESTION_NOT_CURRENT: "السؤال ده مش المفتوح دلوقتي.",
  QUESTION_UNAVAILABLE: "السؤال ده مش متاح.",
  RETURN_TO_BOARD_FIRST: "ارجع للوحة الأول.",
  GAME_EXPIRED: "اللعبة انتهت بسبب الخمول.",
  GAME_FINISHED: "اللعبة خلصت.",
  CONTENT_PURGED: "المحتوى ده مش متاح تاني.",
  // client-side
  NETWORK: "مفيش اتصال بالسيرفر. اتأكد من النت وجرّب تاني.",
  TIMEOUT: "السيرفر اتأخر في الرد. جرّب تاني.",
};

const byStatus: Record<number, string> = {
  400: "في بيانات مش مظبوطة.",
  401: "لازم تدخل تاني.",
  403: "مش مسموح لك تعمل ده.",
  404: "ملقيناش اللي بتدور عليه.",
  409: "الحالة اتغيرت. جرّب تاني.",
  410: "ده مش متاح تاني.",
  429: "حاولت كتير. استنى لحظة.",
  503: "السيرفر مش متاح دلوقتي. جرّب تاني بعد شوية.",
};

export function problemMessage(code: string, status: number): string {
  return byCode[code] ?? byStatus[status] ?? "حصلت مشكلة. جرّب تاني.";
}

/** Codes that mean the stored identity is no longer accepted and sign-in must be repeated. */
export function isIdentityRejected(code: string): boolean {
  return code === "INVALID_PROOF" || code === "CREDENTIAL_EXPIRED" || code === "UNAUTHENTICATED";
}
