import { readDatabaseConfig, type DatabaseConfig } from "../database/config.js";

type Environment = Record<string, string | undefined>;

export type AdminConfig = {
  database: DatabaseConfig;
  sessionSecret: string;
  bootstrapEmail?: string;
  bootstrapPassword?: string;
  production: boolean;
  trustedProxyHops: number;
  /** Sign-in attempts per address per minute, before the per-email lockout. */
  loginAttemptsPerMinute: number;
  /** Accounts credited per transaction in a bulk grant. */
  bulkGrantChunkSize: number;
};

export function readAdminConfig(env: Environment): AdminConfig {
  // The admin service holds few connections: staff traffic is rare and the API owns the capacity.
  const database = readDatabaseConfig({ ...env, DATABASE_POOL_MAX: env.ADMIN_DATABASE_POOL_MAX ?? "3" });
  if (!database) throw new Error("DATABASE_URL is required for the admin service.");
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? "";
  if (sessionSecret.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters.");
  const hops = env.TRUSTED_PROXY_HOPS ?? "0";
  if (!/^[0-3]$/.test(hops)) throw new Error("TRUSTED_PROXY_HOPS must be 0 to 3.");
  const attempts = env.ADMIN_LOGIN_ATTEMPTS_PER_MINUTE ?? "10";
  if (!/^\d+$/.test(attempts) || Number(attempts) < 1 || Number(attempts) > 1000) throw new Error("ADMIN_LOGIN_ATTEMPTS_PER_MINUTE must be 1 to 1000.");
  const chunk = env.ADMIN_BULK_GRANT_CHUNK_SIZE ?? "200";
  if (!/^\d+$/.test(chunk) || Number(chunk) < 1 || Number(chunk) > 500) throw new Error("ADMIN_BULK_GRANT_CHUNK_SIZE must be 1 to 500.");
  return {
    database: { ...database, application_name: "sahsah-admin" },
    sessionSecret,
    bootstrapEmail: env.ADMIN_BOOTSTRAP_EMAIL,
    bootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD,
    production: env.NODE_ENV === "production",
    trustedProxyHops: Number(hops),
    loginAttemptsPerMinute: Number(attempts),
    bulkGrantChunkSize: Number(chunk),
  };
}
