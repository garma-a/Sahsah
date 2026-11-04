import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql, eq } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { is } from "drizzle-orm";
import { DatabaseConnection } from "../../dist/database/connection.js";
import { readDatabaseConfig } from "../../dist/database/config.js";
import { applyMigrations, migrationStatus, migrationsFolder } from "../../dist/database/migrations.js";
import { grantRuntime } from "../../dist/database/permissions.js";
import * as schema from "../../dist/database/schema/index.js";
import { cluster, exec } from "./cluster.mjs";

function config(url, extra = {}) {
  return readDatabaseConfig({ NODE_ENV: "test", DATABASE_URL: url, DATABASE_POOL_MAX: "1", ...extra });
}

test("database configuration is explicit, bounded and secret-safe", () => {
  assert.equal(readDatabaseConfig({ NODE_ENV: "test" }), undefined);
  assert.throws(() => readDatabaseConfig({ NODE_ENV: "production" }), /required in production/);
  for (const url of [" ", "https://secret:password@host/database", "postgresql://host/db", "postgresql://user@host/"]) {
    assert.throws(() => config(url), (error) => !error.message.includes("secret") && /PostgreSQL URL/.test(error.message));
  }
  for (const setting of ["0", "-1", "21", "Infinity", "1.5"]) {
    assert.throws(() => config("postgresql://app@localhost/test", { DATABASE_POOL_MAX: setting }), /integer between/);
  }
});

test("PostgreSQL 18 migrations, runtime permissions and transactions", { timeout: 180000 }, async (t) => {
  const pg = await cluster(t);
  const owner = await pg.database("sahsah_application");
  t.after(() => owner.end());
  const runtime = await pg.connect("sahsah_app", "sahsah_application");
  t.after(() => runtime.end());
  const database = new DatabaseConnection(config(pg.url()));
  t.after(() => database.close());
  await database.initialize();

  await t.test("fresh and repeat migrations preserve the complete schema", async () => {
    assert.equal((await migrationStatus(owner)).filter((entry) => entry.applied).length, 2);
    await applyMigrations(owner);
    const { rows: [counts] } = await owner.query(`SELECT
      (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
      (SELECT count(*)::int FROM pg_type WHERE typnamespace='public'::regnamespace AND typtype='e') AS enums,
      (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f') AS foreign_keys,
      (SELECT count(*)::int FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c') AS checks,
      (SELECT count(*)::int FROM pg_indexes WHERE schemaname='public') AS indexes,
      (SELECT count(*)::int FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid
        WHERE c.relnamespace='public'::regnamespace AND indpred IS NOT NULL) AS partial_indexes`);
    assert.deepEqual(counts, { tables: 39, enums: 37, foreign_keys: 87, checks: 304, indexes: 148, partial_indexes: 19 });
    const tables = Object.values(schema).filter((entry) => is(entry, PgTable)).map(getTableConfig);
    assert.equal(tables.length, 39);
    assert.equal(tables.flatMap((table) => table.columns).length, 501);
    assert.equal(tables.flatMap((table) => table.foreignKeys).length, 87);
    assert.equal(tables.flatMap((table) => table.checks).length, 304);
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='f' AND condeferrable AND NOT condeferred")).rows[0].count, 87);
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM pg_proc WHERE pronamespace='sahsah_internal'::regnamespace AND prosecdef AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']")).rows[0].count, 28);
    assert.equal((await owner.query("SELECT count(*)::int AS count FROM shop_settings")).rows[0].count, 0);
    await assert.rejects(runtime.query("INSERT INTO shop_settings(id) VALUES (1)"), /gift_discount_bps/);
  });

  await t.test("the runtime role cannot own, alter, truncate or bypass the financial guards", async () => {
    await assert.rejects(grantRuntime(owner, "sahsah_owner"), /migration ownership/);
    for (const statement of [
      "UPDATE accounts SET token_balance=9", "UPDATE accounts SET token_balance_updated_at=now()",
      "UPDATE token_ledger_entries SET amount=9", "DELETE FROM token_ledger_entries",
      "UPDATE staff_audit_events SET reason='changed'", "TRUNCATE accounts CASCADE",
      "ALTER TABLE accounts DISABLE TRIGGER ALL", "CREATE TABLE public.unauthorized(id int)",
      "SELECT sahsah_internal.invalidate_deletion_checkpoint(NULL)",
      "SET session_replication_role=replica", "SET ROLE sahsah_owner",
      "DELETE FROM drizzle.__drizzle_migrations",
    ]) await assert.rejects(runtime.query(statement), (error) => error.code === "42501", statement);
    const unsafe = new DatabaseConnection(config(pg.url("sahsah_owner")));
    try { await assert.rejects(unsafe.initialize(), /restricted runtime role/); }
    finally { await unsafe.close(); }
  });

  await t.test("all 68 SQL integrity cases and six races run against actual migrations as the runtime role", async () => {
    const { stdout, stderr } = await exec("python3", ["tests/database/reference-fixtures.py", pg.root], { timeout: 90000, maxBuffer: 2 ** 20 });
    assert.equal(stderr, "");
    const result = JSON.parse(stdout.trim().split("\n").at(-1));
    assert.equal(result.passed, 68);
    assert.equal(result.role, "sahsah_app");
    t.diagnostic("68 migrated-schema reference cases passed, including 6 independent-connection races.");
  });

  const account = randomUUID();
  const staff = randomUUID();
  const phone = "+201055550001";
  const grant = async (db, amount = 2, staffId = staff) => {
    const audit = randomUUID();
    await db.insert(schema.staffAuditEvents).values({ id: audit, staffAccountId: staffId, actionCode: "token_grant", targetKind: "account", targetKey: account, requestKey: randomUUID(), reason: "Synthetic integration grant" });
    await db.insert(schema.tokenLedgerEntries).values({ id: randomUUID(), accountId: account, entryKind: "credit", amount, idempotencyKey: randomUUID(), staffAuditEventId: audit, reasonText: "Synthetic integration grant" });
  };
  await t.test("typed sourced grants commit once and the insert trigger projects the balance", async () => {
    await database.transaction(async (db) => {
      await db.insert(schema.staffAccounts).values({ id: staff, role: "admin", normalizedEmail: "node-test@example.invalid", passwordHash: "synthetic-not-a-real-password" });
      await db.insert(schema.accounts).values({ id: account, displayName: "Synthetic player", phoneE164: phone, phoneVerifiedAt: sql`now()` });
      await grant(db);
    });
    assert.equal((await database.db.select().from(schema.accounts).where(eq(schema.accounts.id, account)))[0].tokenBalance, 2);
    await database.transaction(async (db) => {
      await db.update(schema.staffAccounts).set({ isActive: false }).where(eq(schema.staffAccounts.id, staff));
    });
    await assert.rejects(database.transaction((db) => grant(db)), /query/i);
    assert.equal((await runtime.query("SELECT token_balance FROM accounts WHERE id=$1", [account])).rows[0].token_balance, 2);
  });

  await t.test("statement and deferred COMMIT failures roll back and release a one-connection pool", async () => {
    await assert.rejects(database.transaction(async (db) => {
      await db.insert(schema.categories).values({ id: randomUUID(), nameAr: "اختبار" });
      await db.execute(sql`SELECT 1/0`);
    }));
    const id = randomUUID();
    await assert.rejects(database.transaction(async (db) => {
      await db.insert(schema.categories).values({ id, nameAr: "اختبار" });
      await db.update(schema.accounts).set({ state: "deleted", deletedAt: sql`clock_timestamp()`, displayName: null, phoneE164: null, phoneVerifiedAt: null }).where(eq(schema.accounts.id, account));
      // Use a fresh zero-bank account so the failure is deferred consent, not a row CHECK.
    }));
    const zero = randomUUID();
    await database.transaction((db) => db.insert(schema.accounts).values({ id: zero, displayName: "Zero", phoneE164: "+201055550002", phoneVerifiedAt: sql`now()` }));
    await assert.rejects(database.transaction((db) => db.update(schema.accounts).set({ state: "deleted", deletedAt: sql`clock_timestamp()`, displayName: null, phoneE164: null, phoneVerifiedAt: null }).where(eq(schema.accounts.id, zero))), /completed consent workflow/);
    assert.equal((await runtime.query("SELECT state FROM accounts WHERE id=$1", [zero])).rows[0].state, "active");
    assert.equal((await runtime.query("SELECT count(*)::int AS count FROM categories WHERE id=$1", [id])).rows[0].count, 0);
    await assert.rejects(database.transaction(async (db) => {
      try { await db.execute(sql`SELECT 1/0`); } catch { /* Simulate a caller swallowing an error. */ }
    }), /rolled back/);
    assert.equal(await database.ready(), true);
  });

  await t.test("bigint, numeric, bytea and timestamptz round-trip without losing precision", async () => {
    const pack = randomUUID(), category = randomUUID(), challenge = randomUUID();
    const hash = randomBytes(32);
    await database.transaction(async (db) => {
      await db.insert(schema.categories).values({ id: category, nameAr: "اختبار" });
      await db.insert(schema.questionPacks).values({ id: pack, categoryId: category, packNumber: 1, contentRevision: 9007199254740993n });
      await db.insert(schema.phoneVerificationChallenges).values({ id: challenge, accountId: account, phoneE164: phone, purpose: "sign_in", otpMac: hash, macKeyVersion: 1, createdAt: "2026-01-01T00:00:00.123456Z", expiresAt: "2026-01-01T00:05:00.123456Z" });
    });
    assert.equal((await database.db.select().from(schema.questionPacks).where(eq(schema.questionPacks.id, pack)))[0].contentRevision, 9007199254740993n);
    const proof = (await database.db.select().from(schema.phoneVerificationChallenges).where(eq(schema.phoneVerificationChallenges.id, challenge)))[0];
    assert.deepEqual(proof.otpMac, hash);
    assert.match(proof.createdAt, /\.123456/);
    const result = await database.db.execute(sql`SELECT '99999999999999.123456'::numeric(20,6) AS amount`);
    assert.equal(result.rows[0].amount, "99999999999999.123456");
  });

  await t.test("Nest readiness uses the migrated runtime database and shutdown closes its pool", async () => {
    const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, ADMIN_ENABLED: process.env.ADMIN_ENABLED };
    process.env.DATABASE_URL = pg.url(); process.env.NODE_ENV = "test"; process.env.ADMIN_ENABLED = "false";
    const { createApplication } = await import("../../dist/application.js");
    let app;
    try {
      app = await createApplication(); await app.listen(0, "127.0.0.1");
      const response = await fetch(`${await app.getUrl()}/api/health/ready`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { status: "ok", database: "ready" });
    } finally {
      await app?.close();
      for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value;
    }
  });

  await t.test("unreachable or unmigrated databases fail initialization without applying DDL", async () => {
    const emptyOwner = await pg.database("sahsah_empty", false);
    try {
      const empty = new DatabaseConnection(config(pg.url("sahsah_owner", "sahsah_empty")));
      try { await assert.rejects(empty.initialize(), /schema is incomplete/); }
      finally { await empty.close(); }
      assert.equal((await emptyOwner.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0);
    } finally { await emptyOwner.end(); }
    const unavailable = new DatabaseConnection(config("postgresql://app@localhost/db?host=%2Ftmp%2Fsahsah-nonexistent-socket", { DATABASE_CONNECT_TIMEOUT_MS: "200" }));
    try { await assert.rejects(unavailable.initialize()); assert.equal(await unavailable.ready(), false); }
    finally { await unavailable.close(); }
  });

  await t.test("changed applied migration content is rejected", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "sahsah-migration-tamper-"));
    try {
      await cp(migrationsFolder, folder, { recursive: true });
      const file = path.join(folder, "0000_sahsah_schema.sql");
      await writeFile(file, `${await readFile(file, "utf8")}\n-- changed after application\n`);
      await assert.rejects(applyMigrations(owner, folder), /differ from checked-in history/);
      assert.equal((await migrationStatus(owner)).every((entry) => entry.applied), true);
    } finally { await rm(folder, { recursive: true, force: true }); }
  });

  await t.test("a failed migration batch leaves no partially initialized domain schema", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "sahsah-migration-failure-"));
    const target = await pg.database("sahsah_failure", false);
    try {
      await cp(migrationsFolder, folder, { recursive: true });
      const file = path.join(folder, "0001_postgresql_integrity.sql");
      await writeFile(file, `${await readFile(file, "utf8")}\nSELECT 1/0;\n`);
      await assert.rejects(applyMigrations(target, folder));
      assert.equal((await target.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'")).rows[0].count, 0);
      assert.equal((await migrationStatus(target)).every((entry) => !entry.applied), true);
      await applyMigrations(target);
      assert.equal((await migrationStatus(target)).every((entry) => entry.applied), true);
    } finally { await target.end(); await rm(folder, { recursive: true, force: true }); }
  });

  await t.test("competing migrators coordinate on the same history", async () => {
    const first = await pg.database("sahsah_concurrent_migrations", false);
    const second = await pg.connect("sahsah_owner", "sahsah_concurrent_migrations");
    try {
      await Promise.all([applyMigrations(first), applyMigrations(second)]);
      assert.equal((await migrationStatus(first)).filter((entry) => entry.applied).length, 2);
    } finally { await first.end(); await second.end(); }
  });
});
