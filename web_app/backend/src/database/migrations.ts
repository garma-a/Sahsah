import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Client, PoolClient } from "pg";

export const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
const migrationLock = "7178974626514107";
type Connection = Pick<Client | PoolClient, "query">;
type Journal = { entries: { tag: string; when: number; idx: number }[] };

function localMigrations(folder: string) {
  const journal = JSON.parse(readFileSync(`${folder}/meta/_journal.json`, "utf8")) as Journal;
  const files = readMigrationFiles({ migrationsFolder: folder });
  if (!files.length || journal.entries.length !== files.length || files.some((file, i) =>
    !Number.isSafeInteger(file.folderMillis) || file.folderMillis !== journal.entries[i]?.when ||
    journal.entries[i]?.idx !== i || (i > 0 && file.folderMillis <= files[i - 1].folderMillis))) {
    throw new Error("Invalid migration journal: require a nonempty, strictly ordered history.");
  }
  return files.map((file, i) => ({ ...file, tag: journal.entries[i].tag }));
}

export async function migrationStatus(client: Connection, folder = migrationsFolder) {
  const files = localMigrations(folder);
  const exists = await client.query<{ present: boolean }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS present",
  );
  const applied = exists.rows[0].present
    ? (await client.query<{ hash: string; created_at: string }>(
      "SELECT hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at, id",
    )).rows : [];
  if (applied.length > files.length || applied.some((row, i) =>
    row.hash !== files[i]?.hash || row.created_at !== String(files[i]?.folderMillis))) {
    throw new Error("Applied migrations differ from checked-in history. Restore the applied files; add a new migration for changes.");
  }
  return files.map((file, i) => ({ name: file.tag, hash: file.hash, applied: i < applied.length }));
}

export async function assertMigrationsCurrent(client: Connection) {
  const status = await migrationStatus(client);
  if (status.some((migration) => !migration.applied)) {
    throw new Error("Database schema is incomplete. Run db:migrate with migration-owner credentials.");
  }
}

export async function applyMigrations(client: Client, folder = migrationsFolder) {
  // A session lock spans both history verification and Drizzle's atomic DDL batch.
  // The CLI supplies bounded lock/statement timeouts on this dedicated connection.
  await client.query("SELECT pg_advisory_lock($1::bigint)", [migrationLock]);
  try {
    await client.query("SET search_path TO public");
    await migrationStatus(client, folder);
    await migrate(drizzle(client), { migrationsFolder: folder, migrationsSchema: "drizzle" });
    return await migrationStatus(client, folder);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1::bigint)", [migrationLock]);
  }
}
