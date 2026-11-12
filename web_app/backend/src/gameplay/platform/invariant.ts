import { GameplayProblem } from "./problem.js";
import { log, withContext, context as loggingContext, type LogContext, type LogFields } from "./logging.js";

export function invariant(
  condition: unknown,
  code: string,
  context: Partial<LogContext> & LogFields = {},
): asserts condition {
  if (condition) return;
  const {
    scope = loggingContext().scope,
    requestId,
    operationId,
    roomId,
    gameId,
    accountId,
    ...fields
  } = context;
  const error = new GameplayProblem(500, "INTERNAL_INVARIANT");
  // Only known, safe identifiers and bounded diagnostic fields enter the logger.
  withContext(
    scope,
    () =>
      log.error(scope, {
        ...fields,
        code,
        stack: error.stack?.split("\n").slice(1).join("\n"),
      }),
    {
      ...(requestId ? { requestId } : {}),
      ...(operationId ? { operationId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(gameId ? { gameId } : {}),
      ...(accountId ? { accountId } : {}),
    },
  );
  throw error;
}
export function single<T>(rows: T[], code: string): T {
  invariant(rows.length === 1, code, { count: rows.length });
  const row = rows[0];
  invariant(row !== undefined, code);
  stateInvariants(row);
  return row;
}

/** Checks persisted state without changing/coercing any values. */
export function stateInvariants(row: unknown): void {
  if (!row || typeof row !== "object") return;
  for (const [key, value] of Object.entries(row)) {
    if (
      [
        "stateVersion",
        "projectionVersion",
        "feedbackVersion",
        "teamOneScore",
        "teamTwoScore",
      ].includes(key)
    )
      invariant(
        typeof value === "bigint" && value >= 0n,
        `STATE_${key.toUpperCase()}`,
      );
    if (["controllerGeneration", "lobbyGeneration"].includes(key))
      invariant(
        (typeof value === "bigint" && value > 0n) ||
          (typeof value === "number" && Number.isInteger(value) && value > 0),
        `STATE_${key.toUpperCase()}`,
      );
    if (
      ["boardPosition", "questionPosition"].includes(key) ||
      (["activeBoardPosition", "activeQuestionPosition"].includes(key) &&
        value !== null)
    )
      invariant(
        typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 6,
        `STATE_${key.toUpperCase()}`,
      );
    if (key === "stageIndex")
      invariant(
        typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 2,
        "STATE_STAGE_INDEX",
      );
    if (key === "remainingMs")
      invariant(
        typeof value === "number" &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 60000,
        "STATE_REMAINING_MS",
      );
    if (key === "awardedPoints" && value !== null)
      invariant(
        typeof value === "number" &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 600,
        "STATE_AWARDED_POINTS",
      );
  }
  if ("activeBoardPosition" in row && "activeQuestionPosition" in row)
    invariant(
      (row.activeBoardPosition === null) ===
        (row.activeQuestionPosition === null),
      "STATE_ACTIVE_POSITION_PAIR",
    );
  if ("basePoints" in row)
    invariant(
      row.basePoints === 200 ||
        row.basePoints === 400 ||
        row.basePoints === 600,
      "STATE_BASE_POINTS",
    );
  if ("timerState" in row && "timerDeadlineAt" in row)
    invariant(
      (row.timerState === "running") === (row.timerDeadlineAt !== null),
      "STATE_TIMER_DEADLINE",
    );
}
export function versionIncrement(
  before: bigint,
  after: bigint,
  code = "VERSION_INCREMENT",
) {
  invariant(after === before + 1n, code, {
    versionBefore: String(before),
    versionAfter: String(after),
  });
}
export async function written<T>(
  query: PromiseLike<T[]>,
  expected: number,
  code: string,
): Promise<T[]> {
  const rows = await query;
  invariant(rows.length === expected, code, { count: rows.length });
  rows.forEach(stateInvariants);
  return rows;
}
/** ON CONFLICT DO NOTHING intentionally permits already-persisted rows. */
export async function writtenAtMost<T>(
  query: PromiseLike<T[]>,
  maximum: number,
  code: string,
): Promise<T[]> {
  const rows = await query;
  invariant(rows.length <= maximum, code, { count: rows.length });
  rows.forEach(stateInvariants);
  return rows;
}
