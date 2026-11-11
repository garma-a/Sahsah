import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import type { DatabaseConfig } from "./config.js";
import { assertMigrationsCurrent } from "./migrations.js";
import * as schema from "./schema/index.js";

export type SahsahDatabase = NodePgDatabase<typeof schema>;
class DatabaseDrainingError extends Error {
  readonly code = "08006";
}

export class DatabaseConnection {
  private readonly pool: Pool | undefined;
  private readonly orm: SahsahDatabase | undefined;
  private initialized = false;
  private closing: Promise<void> | undefined;
  private gameplayLease?: PoolClient;
  private leaseBackendId?: number;
  private leaseLost = false;
  private transactions = new Set<Promise<void>>();

  constructor(
    config: DatabaseConfig | undefined,
    onIdleError: () => void = () => {},
  ) {
    if (config) {
      this.pool = new Pool({
        ...config,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      // pg requires an idle-client error listener. The caller logs no SQL/parameters.
      this.pool.on("error", onIdleError);
      this.orm = drizzle(this.pool, { schema });
    }
  }

  get db(): SahsahDatabase {
    if (!this.orm || !this.initialized)
      throw new Error("Database is not ready.");
    return this.orm;
  }

  async claimGameplayProcess(): Promise<boolean> {
    if (!this.pool || !this.initialized) return false;
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ acquired: boolean; pid: number }>(
        "SELECT pg_try_advisory_lock(1935763505, 1) AS acquired,pg_backend_pid() AS pid",
      );
      const row = result.rows[0];
      if (!row) throw new Error("Missing advisory lock result.");
      if (!row.acquired) {
        client.release();
        return false;
      }
      this.gameplayLease = client;
      this.leaseBackendId = row.pid;
      client.on("error", () => {
        this.initialized = false;
        this.leaseLost = true;
      });
      // A failed previous lease session may have surviving writer transactions.
      // Their shared transaction locks must drain before occupancy/admission.
      await client.query("SELECT pg_advisory_lock(1935763505,2)");
      await client.query("SELECT pg_advisory_unlock(1935763505,2)");
      return true;
    } catch (error) {
      if (this.gameplayLease === client) {
        this.gameplayLease = undefined;
        this.leaseLost = true;
        this.initialized = false;
      }
      client.release(true);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await assertMigrationsCurrent(client);
      const {
        rows: [role],
      } = await client.query<{ unsafe: boolean }>(`
        SELECT r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication OR r.rolbypassrls
          OR has_schema_privilege(current_user, 'public', 'CREATE')
          OR has_database_privilege(current_user, current_database(), 'CREATE')
          OR has_column_privilege(current_user, 'accounts', 'token_balance', 'UPDATE')
          OR has_column_privilege(current_user, 'accounts', 'token_balance_updated_at', 'UPDATE')
          OR EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace IN
            ('public'::regnamespace, 'drizzle'::regnamespace, 'sahsah_internal'::regnamespace)
            AND c.relkind = 'r' AND (pg_has_role(current_user, c.relowner, 'MEMBER')
              OR has_table_privilege(current_user, c.oid, 'TRUNCATE')))
          OR EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace='sahsah_internal'::regnamespace
            AND has_function_privilege(current_user, p.oid, 'EXECUTE')) AS unsafe
        FROM pg_roles r WHERE r.rolname=current_user
      `);
      if (!role || role.unsafe)
        throw new Error(
          "DATABASE_URL must use the restricted runtime role. Run db:grant-runtime with the migration owner.",
        );
      this.initialized = true;
    } finally {
      client.release();
    }
  }

  async ready(): Promise<boolean> {
    if (!this.pool || !this.initialized) return false;
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async transaction<T>(
    work: (db: SahsahDatabase) => Promise<T>,
    options: { consistentRead?: boolean } = {},
  ): Promise<T> {
    if (!this.pool || !this.initialized)
      throw new Error("Database is not ready.");
    let complete!: () => void;
    const drained = new Promise<void>((resolve) => {
      complete = resolve;
    });
    this.transactions.add(drained);
    let client: PoolClient | undefined;
    let discard = false;
    try {
      client = await this.pool.connect();
      if (!this.initialized || this.closing || this.leaseLost)
        throw new DatabaseDrainingError(
          "Database is draining or gameplay lease was lost.",
        );
      const begin = options.consistentRead
        ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
        : "BEGIN";
      await client.query(
        this.leaseBackendId
          ? `${begin}; SELECT pg_advisory_xact_lock_shared(1935763505,2)`
          : begin,
      );
      if (this.leaseBackendId) {
        const owned = await client.query<{ owned: boolean }>(
          "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND classid=1935763505 AND objid=1 AND objsubid=2 AND pid=$1 AND mode='ExclusiveLock' AND granted) AS owned",
          [this.leaseBackendId],
        );
        if (!owned.rows[0]?.owned || this.leaseLost) {
          this.leaseLost = true;
          this.initialized = false;
          throw new DatabaseDrainingError(
            "Gameplay process lease was replaced.",
          );
        }
      }
      const result = await work(drizzle(client, { schema }));
      if (this.leaseLost)
        throw new DatabaseDrainingError("Gameplay process lease was lost.");
      const commit = await client.query("COMMIT");
      // PostgreSQL can answer ROLLBACK when a callback swallowed a statement error.
      if (commit.command !== "COMMIT")
        throw new Error(
          "Transaction was rolled back; no changes were accepted.",
        );
      return result;
    } catch (error) {
      try {
        await client?.query("ROLLBACK");
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client?.release(discard);
      this.transactions.delete(drained);
      complete();
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
    this.closing ??= (async () => {
      await Promise.all([...this.transactions]);
      if (this.gameplayLease) {
        this.gameplayLease.release(true);
        this.gameplayLease = undefined;
      }
      await this.pool?.end();
    })();
    await this.closing;
  }
}
