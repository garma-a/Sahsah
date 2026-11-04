export type DatabaseConfig = {
  connectionString: string;
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statement_timeout: number;
  lock_timeout: number;
  idle_in_transaction_session_timeout: number;
  application_name: string;
  options: string;
};

type Environment = Record<string, string | undefined>;

export function databaseUrl(value: string | undefined, name: string): string {
  try {
    if (!value?.trim()) throw new Error();
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
        !url.username || url.pathname.length < 2 || url.hash) throw new Error();
    return value;
  } catch {
    // Never include a credential-bearing URL in diagnostics.
    throw new Error(`${name} must be an explicit PostgreSQL URL with host, user and database.`);
  }
}

function bounded(env: Environment, name: string, fallback: number, maximum: number): number {
  const value = env[name] ?? String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return Number(value);
}

export function readDatabaseConfig(env: Environment): DatabaseConfig | undefined {
  if (env.DATABASE_URL === undefined || env.DATABASE_URL === "") {
    if (env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production.");
    return undefined;
  }
  return {
    connectionString: databaseUrl(env.DATABASE_URL, "DATABASE_URL"),
    max: bounded(env, "DATABASE_POOL_MAX", 5, 20),
    connectionTimeoutMillis: bounded(env, "DATABASE_CONNECT_TIMEOUT_MS", 5000, 30000),
    idleTimeoutMillis: bounded(env, "DATABASE_IDLE_TIMEOUT_MS", 30000, 300000),
    statement_timeout: bounded(env, "DATABASE_STATEMENT_TIMEOUT_MS", 10000, 60000),
    lock_timeout: bounded(env, "DATABASE_LOCK_TIMEOUT_MS", 5000, 30000),
    idle_in_transaction_session_timeout: bounded(env, "DATABASE_TRANSACTION_IDLE_TIMEOUT_MS", 10000, 60000),
    application_name: "sahsah-api",
    options: "-c timezone=UTC -c search_path=pg_catalog,public",
  };
}
