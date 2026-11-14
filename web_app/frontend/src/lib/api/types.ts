// Hand-written from docs/api/openapi.json and docs/api/realtime.schema.json.
// Only what the web UI uses today; bigints travel as decimal strings.

export type Id = string;
export type Revision = string;
export type Language = "ar" | "franco";
export type TeamNumber = 1 | 2;
export type BasePoints = 200 | 400 | 600;

export type CategorySection = { id: Id; name: string; displayOrder: number };
export type Category = {
  id: Id;
  name: string;
  description?: string;
  section?: CategorySection;
  coverUrl?: string;
  publishedPackCount: number;
};
export type Page<T> = { items: T[]; nextCursor?: string };

export type Pack = {
  id: Id;
  categoryId: Id;
  packNumber: number;
  contentRevision: Revision;
  questionCount: 6;
  freshForGroup?: boolean;
  repeatRequired?: boolean;
};

export type Selection = {
  boardPosition: number;
  categoryId: Id;
  packId: Id;
  observedRevision: Revision;
  repeatConsentBasis?: string;
};

export type TeamPlayer = { membershipId: Id; displayName: string };
/** `players` is absent from an API that predates the roster in game views; callers then fall back to the lobby roster. */
export type Team = { number: number; name: string; score: string; players?: TeamPlayer[] };
export type Member = {
  id: Id;
  displayName: string;
  teamNumber: TeamNumber | null;
  host: boolean;
  memberVersion: Revision;
  ready: boolean;
};

export type Tile = {
  questionPosition: number;
  basePoints: BasePoints;
  state: "unopened" | "opened" | "revealed" | "resolved";
  winningTeamNumber?: TeamNumber | null;
  awardedPoints?: number;
};
export type BoardCategory = {
  boardPosition: number;
  categoryId: Id;
  packId: Id;
  name: string;
  tiles: Tile[];
};

export type LobbyView = {
  phase: "lobby";
  audience: "host" | "viewer";
  roomId: Id;
  teamOneName: string;
  teamTwoName: string;
  members: Member[];
  selections: Selection[];
  readyGeneration: number;
  idleExpiresAt: string;
  previousGameId?: Id;
};
export type BoardView = {
  phase: "board";
  audience: "host" | "viewer";
  roomId: Id;
  gameId: Id;
  teams: Team[];
  board: BoardCategory[];
  idleExpiresAt: string;
};
export type ImageRef = {
  kind: "image";
  boardPosition: number;
  questionPosition: number;
  role: "prompt_image" | "answer_image" | "hint_image";
  variantNumber: number;
};
export type AudioRef = {
  kind: "audio";
  boardPosition: number;
  questionPosition: number;
  role: "question_audio" | "answer_audio";
  variantNumber: 0;
};
export type MediaRef = ImageRef | AudioRef;

/** The host clip's play state as presence mirrors it: no reference or URL, only how far along it is. */
export type Playback = { playing: boolean; positionMs: number; durationMs: number; updatedAt: string };

export type Timer =
  | { state: "ready"; remainingMs: number }
  | { state: "running"; remainingMs: number; deadlineAt: string }
  | { state: "paused"; remainingMs: number }
  | { state: "elapsed"; remainingMs: 0 };

export type QuestionFormat =
  | "STANDARD"
  | "IMAGE_BLUR"
  | "IMAGE_ZOOM"
  | "IMAGE_PERSON"
  | "IMAGE_COLOR"
  | "IMAGE_RIDDLE"
  | "IMAGE_MEMORY"
  | "AUDIO_GUESS"
  | "AUDIO_REVERSE"
  | "AUDIO_VOICE";

/** What the audience reads, by format. Only the host's view ever carries an `audio` reference. */
export type QuestionContent =
  | { format: "STANDARD"; prompt: string; image?: ImageRef }
  | { format: "IMAGE_BLUR" | "IMAGE_ZOOM"; prompt: string; image: ImageRef; stageIndex: number; stageSuggestions: number[] }
  | { format: "IMAGE_PERSON" | "IMAGE_COLOR" | "IMAGE_RIDDLE"; prompt: string; image?: ImageRef }
  | { format: "IMAGE_MEMORY"; memoryPhase: "ready"; instruction: string }
  | { format: "IMAGE_MEMORY"; memoryPhase: "viewing_first"; instruction: string; image: ImageRef }
  | { format: "IMAGE_MEMORY"; memoryPhase: "recall"; prompt: string }
  | { format: "IMAGE_MEMORY"; memoryPhase: "revisit"; prompt: string; image: ImageRef }
  | { format: "AUDIO_GUESS" | "AUDIO_REVERSE"; prompt: string; durationMs: number; audio?: AudioRef }
  | { format: "AUDIO_VOICE"; prompt: string; durationMs: number; hint?: string; audio?: AudioRef };

export type AnswerContent = {
  format: QuestionFormat;
  text: string;
  image?: ImageRef;
  colorHex?: string;
  forwardAudio?: AudioRef;
};

export type CommandName =
  | "open_question"
  | "return_to_board"
  | "advance_hint"
  | "show_memory"
  | "hide_memory"
  | "pause_timer"
  | "resume_timer"
  | "reset_timer"
  | "reveal_answer"
  | "resolve_question"
  | "adjust_score"
  | "end_game";

/** The open question (phase "question") or its revealed answer (phase "answer"). Only the host gets `controls`. */
export type QuestionView = {
  phase: "question" | "answer";
  audience: "host" | "viewer";
  roomId: Id;
  gameId: Id;
  boardPosition: number;
  questionPosition: number;
  basePoints: BasePoints;
  /** The current hint stage's value: the default award, never above `basePoints`. */
  suggestedPoints: number;
  teams: Team[];
  timer: Timer;
  idleExpiresAt: string;
  question: QuestionContent;
  answer?: AnswerContent;
  controls?: CommandName[];
};

export type CategoryResult = {
  boardPosition: number;
  categoryId: Id;
  name: string;
  resolvedCount: number;
  teamOneAwardPoints: number;
  teamTwoAwardPoints: number;
  winningTeamNumber: TeamNumber | null;
};
export type ResultTeam = {
  number: number;
  name: string;
  score: string;
  questionAwardTotal: number;
  manualAdjustmentTotal: string;
  players?: TeamPlayer[];
};
export type GameResult = {
  gameId: Id;
  roomId: Id;
  status: "finished" | "expired" | "failed";
  endReason: "completed" | "host_ended" | "host_left" | "idle_timeout" | "platform_failure";
  endedAt: string;
  resolvedQuestionCount: number;
  winningTeamNumber: TeamNumber | null;
  teams: ResultTeam[];
  categories: CategoryResult[];
};
export type ResultView = {
  phase: "result";
  audience: "host" | "viewer";
  result: GameResult;
};
export type GameView = BoardView | QuestionView | ResultView;
export type RoomView = LobbyView | GameView;

export type LobbySource = { roomVersion: Revision };
export type GameSource = {
  roomVersion: Revision;
  gameId: Id;
  gameVersion: Revision;
  gameProjectionVersion: Revision;
};
export type Source = LobbySource | GameSource;

export type Snapshot =
  | { source: LobbySource; serverTime: string; language: Language; view: LobbyView }
  | { source: GameSource; serverTime: string; language: Language; view: GameView };

export type Receipt = {
  operationId: Id;
  roomId: Id;
  roomVersion: Revision;
  gameId?: Id;
  gameVersion?: Revision;
  membershipId?: Id;
  membershipVersion?: Revision;
  controllerGeneration?: Revision;
  readyGeneration?: number;
  effect: "changed" | "none";
  accessState?: "live" | "revoked" | "closed";
};

export type Invitation = { code: string; joinUrl: string; issuedAt: string; expiresAt: string };
export type InvitationPreview = {
  joinable: boolean;
  teamOneName: string;
  teamTwoName: string;
  availableSeats: number;
  expiresAt: string;
  admission: "open" | "paused";
};
export type ControlStatus = {
  roomId: Id;
  roomControllerGeneration: Revision;
  currentGameId?: Id;
  gameControllerGeneration?: Revision;
};
export type CurrentRoom = {
  roomId: Id;
  roomVersion: Revision;
  focus: "lobby" | "game" | "result";
  currentGameId?: Id;
};

export type PreviewSession = {
  credential: string;
  expiresAt: string;
  accountId: Id;
  displayName: string;
};

export type SelectionConflict = {
  boardPosition: number;
  categoryId: Id;
  selectedPackId: Id;
  reason: "archived" | "content_changed" | "freshness_changed" | "no_fresh_pack";
  alternatives: Pack[];
};

export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  detail?: string;
  existingRoomId?: Id;
  unreadyMembershipIds?: Id[];
  currentRoomVersion?: Revision;
  currentGameVersion?: Revision;
  currentMembershipVersion?: Revision;
  currentReadyGeneration?: number;
  selectionConflicts?: SelectionConflict[];
};

type Pointer = { expectedGameVersion: Revision; boardPosition: number; questionPosition: number };
export type GameCommand =
  | ({ name: "open_question" } & Pointer)
  | ({ name: "return_to_board" } & Pointer)
  | ({ name: "advance_hint" } & Pointer)
  | ({ name: "show_memory" } & Pointer)
  | ({ name: "hide_memory" } & Pointer)
  | ({ name: "pause_timer" } & Pointer)
  | ({ name: "resume_timer" } & Pointer)
  | ({ name: "reset_timer" } & Pointer)
  | ({ name: "reveal_answer" } & Pointer)
  | ({ name: "resolve_question"; winningTeamNumber: TeamNumber | null; awardedPoints?: number } & Pointer)
  | { name: "adjust_score"; expectedGameVersion: Revision; teamNumber: TeamNumber; targetTotal: string }
  | { name: "end_game"; expectedGameVersion: Revision };

export type MediaLink = {
  ref: MediaRef;
  url: string;
  expiresAt: string;
  contentType: string;
  byteSize: string;
  durationMs?: number;
  width?: number;
  height?: number;
};
export type MediaLinks = { links: MediaLink[]; serverTime: string };
