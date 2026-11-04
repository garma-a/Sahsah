import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { DatabaseConfig } from "./config.js";
import { assertMigrationsCurrent } from "./migrations.js";
import * as schema from "./schema/index.js";

export type SahsahDatabase = NodePgDatabase<typeof schema>;

export class DatabaseConnection {
  private readonly pool: Pool | undefined;
  private readonly orm: SahsahDatabase | undefined;
  private initialized = false;
  private closing: Promise<void> | undefined;

  constructor(config: DatabaseConfig | undefined, onIdleError: () => void = () => {}) {
    if (config) {
      this.pool = new Pool(config);
      // pg requires an idle-client error listener. The caller logs no SQL/parameters.
      this.pool.on("error", onIdleError);
      this.orm = drizzle(this.pool, { schema });
    }
  }

  get db(): SahsahDatabase {
    if (!this.orm || !this.initialized) throw new Error("Database is not ready.");
    return this.orm;
  }

  async initialize(): Promise<void> {
    if (!this.pool) return;
    const client = await this.pool.connect();
    try {
      await assertMigrationsCurrent(client);
      const { rows: [role] } = await client.query<{ unsafe: boolean }>(`
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
      if (!role || role.unsafe) throw new Error("DATABASE_URL must use the restricted runtime role. Run db:grant-runtime with the migration owner.");
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

  async transaction<T>(work: (db: SahsahDatabase) => Promise<T>): Promise<T> {
    if (!this.pool || !this.initialized) throw new Error("Database is not ready.");
    const client = await this.pool.connect();
    let discard = false;
    try {
      await client.query("BEGIN");
      const result = await work(drizzle(client, { schema }));
      const commit = await client.query("COMMIT");
      // PostgreSQL can answer ROLLBACK when a callback swallowed a statement error.
      if (commit.command !== "COMMIT") throw new Error("Transaction was rolled back; no changes were accepted.");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
    this.closing ??= this.pool?.end() ?? Promise.resolve();
    await this.closing;
  }
}
