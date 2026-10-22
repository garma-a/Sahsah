export type QuestionType =
  | 'STANDARD'
  | 'IMAGE_BLUR'
  | 'IMAGE_ZOOM'
  | 'AUDIO_GUESS'
  | 'AUDIO_REVERSE'
export const MODE_LABELS: Record<QuestionType, string> = {
  STANDARD: 'سؤال عادي',
  IMAGE_BLUR: 'صورة مشوشة',
  IMAGE_ZOOM: 'صورة مكبّرة',
  AUDIO_GUESS: 'خمن الصوت',
  AUDIO_REVERSE: 'الكلام بالمقلوب',
}
export type DemoMode =
  | 'IMAGE_PERSON'
  | 'IMAGE_COLOR'
  | 'IMAGE_RIDDLE'
  | 'AUDIO_VOICE'
  | 'IMAGE_MEMORY'
export const GAME_MODE_LABELS = {
  ...MODE_LABELS,
  IMAGE_PERSON: 'مين في الصورة؟',
  IMAGE_COLOR: 'اللون الأصلي إيه؟',
  IMAGE_RIDDLE: 'الصورة بتقول إيه؟',
  AUDIO_VOICE: 'مين صاحب الصوت؟',
  IMAGE_MEMORY: 'ركز معايا',
}
/** Franco-Arabic labels for the English format. */
export const GAME_MODE_LABELS_EN: Record<keyof typeof GAME_MODE_LABELS, string> = {
  STANDARD: 'So2al 3ady',
  IMAGE_BLUR: 'Wada7 El Soora',
  IMAGE_ZOOM: 'Wada7 El Soora',
  AUDIO_GUESS: 'Khamen El Soot',
  AUDIO_REVERSE: 'El Kalam bel Ma2loob',
  IMAGE_PERSON: 'Meen fel Soora?',
  IMAGE_COLOR: 'El Loon El Asly Eh?',
  IMAGE_RIDDLE: 'El Soora Bet2ool Eh?',
  AUDIO_VOICE: 'Meen Sa7b El Soot?',
  IMAGE_MEMORY: 'Rakez M3aya',
}
/** Every question timer runs for one minute and starts automatically. */
export const QUESTION_MS = 60000
export type QuestionCommon = {
  id: string
  categoryId: string
  row: number
  points: number
  prompt: string
  /** Franco-Arabic prompt; falls back to `prompt` when missing. */
  promptEn?: string
  /** One short optional hint/joke line shown under sound clips. */
  hint?: string
  hintEn?: string
  state: 'available' | 'answered'
  /** Team that won the question (null = nobody) once it is answered. */
  wonBy?: TeamId | null
  wonPoints?: number
  stageIndex: number
  availablePoints: number
  audioPlaysUsed: number
  audioIsPlaying: boolean
  audioStartedAt?: number
  audioDurationMs?: number
  answer?: { text: string; textEn?: string; imageUrl?: string; forwardAudioUrl?: string }
}
// Only reveal-authorized content enters this public union.
export type StandardQuestion = QuestionCommon & { type: 'STANDARD' }
export type ImageQuestion = QuestionCommon & {
  type: 'IMAGE_BLUR' | 'IMAGE_ZOOM'
  imageUrl: string
  pointStages: number[]
}
export type AudioQuestion = QuestionCommon & {
  type: 'AUDIO_GUESS' | 'AUDIO_REVERSE'
  audioUrl: string
  maxPlays: number
}
export type DemoPictureQuestion = QuestionCommon & {
  type: 'IMAGE_PERSON' | 'IMAGE_COLOR' | 'IMAGE_RIDDLE'
  imageUrl: string
  crop?: 'eyes' | 'center' | 'lower'
  colorHex?: string
}
export type MemoryQuestion = QuestionCommon & {
  type: 'IMAGE_MEMORY'
  imageUrl: string
  memoryPhase: 'ready' | 'viewing' | 'recall'
  /** True once the picture was hidden and the question shown (stays true if the host goes back). */
  memoryAsked?: boolean
  memorySeconds: number
  memoryEndsAt?: number
}
export type VoiceQuestion = QuestionCommon & {
  type: 'AUDIO_VOICE'
  audioUrl: string
  maxPlays: number
}
export type Question =
  | StandardQuestion
  | ImageQuestion
  | AudioQuestion
  | DemoPictureQuestion
  | MemoryQuestion
  | VoiceQuestion
export type TeamId = 'A' | 'B'
export type Team = { id: TeamId; name: string; score: number }
export type Timer = {
  durationMs: number
  remainingMs: number
  status: 'idle' | 'running' | 'paused' | 'expired'
  startedAt?: number
}
export type Session = {
  id: string
  code: string
  phase: 'lobby' | 'board' | 'question' | 'answer' | 'finished'
  teams: [Team, Team]
  categoryIds: string[]
  questions: Question[]
  activeQuestionId?: string
  answerRevealed: boolean
  timer: Timer
  guests: { name: string; team: TeamId }[]
  lastAward?: { teamId: TeamId | null; points: number; at: number }
  version: number
}
export type AdminQuestion = {
  id: string
  type: QuestionType
  categoryId: string
  row: number
  points: number
  packageId: string
  prompt: string
  answerText: string
  promptEn?: string
  answerTextEn?: string
  alternatives: string[]
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  notes: string
  pointStages: number[]
  focalX: number
  focalY: number
  blurSigmas: number[]
  zoomFactors: number[]
  maxPlays: number
  allowForward: boolean
  stages: string[]
  originalImage?: string
  playableAudio?: string
  forwardSpeech?: string
  durationMs?: number
}
export const defaultPointStages = (points: number) =>
  points === 600 ? [600, 400, 200] : points === 400 ? [400, 250, 150] : [200, 150, 50]
