import { GameplayProblem } from "./problem.js";
import { log, withContext, type LogContext, type LogFields } from "./logging.js";

export function invariant(
  condition: unknown,
  code: string,
  context: Partial<LogContext> & LogFields = {},
): asserts condition {
  if (condition) return;
  const { scope = "platform.invariant", requestId, operationId, roomId, gameId, accountId, ...fields } = context;
  const error = new GameplayProblem(500, "INTERNAL_INVARIANT");
  // Only known, safe identifiers and bounded diagnostic fields enter the logger.
  withContext(scope, () => log.error(scope, { ...fields, code, stack: error.stack?.split("\n").slice(1).join("\n") }), {
    ...(requestId ? { requestId } : {}), ...(operationId ? { operationId } : {}),
    ...(roomId ? { roomId } : {}), ...(gameId ? { gameId } : {}), ...(accountId ? { accountId } : {}),
  });
  throw error;
}
export function single<T>(rows: T[], code: string): T {
  invariant(rows.length === 1, code, { count: rows.length });
  const row = rows[0];
  invariant(row !== undefined, code);
  return row;
}
