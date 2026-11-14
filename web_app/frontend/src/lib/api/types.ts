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

export type Team = { number: number; name: string; score: string };
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
/** Question and answer screens are built in a later change; only their frame is typed here. */
export type QuestionView = {
  phase: "question" | "answer";
  audience: "host" | "viewer";
  roomId: Id;
  gameId: Id;
  boardPosition: number;
  questionPosition: number;
  basePoints: BasePoints;
  teams: Team[];
};
export type ResultView = {
  phase: "result";
  audience: "host" | "viewer";
  result: {
    gameId: Id;
    roomId: Id;
    status: string;
    winningTeamNumber: TeamNumber | null;
    teams: { number: number; name: string; score: string }[];
  };
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

export type GameCommand =
  | { name: "open_question"; expectedGameVersion: Revision; boardPosition: number; questionPosition: number }
  | { name: "return_to_board"; expectedGameVersion: Revision; boardPosition: number; questionPosition: number };
