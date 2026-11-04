// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { staffRole } from "./enums.js";
import { bytea } from "./types.js";
import type { JsonObject } from "./types.js";

export const staffAccounts = t.pgTable("staff_accounts", {
  id: t.uuid("id").primaryKey().notNull(),
  role: staffRole("role").notNull(),
  normalizedEmail: t.text("normalized_email").unique().notNull(),
  passwordHash: t.text("password_hash").notNull(),
  isActive: t.boolean("is_active").default(true).notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.check("staff_accounts_normalized_email", sql`length(btrim(normalized_email)) > 0 AND normalized_email = lower(btrim(normalized_email))`),
  t.check("staff_accounts_password_hash_present", sql`length(btrim(password_hash)) > 0`),
]);

export const staffSessions = t.pgTable("staff_sessions", {
  sessionHash: bytea("session_hash").primaryKey().notNull(),
  staffAccountId: t.uuid("staff_account_id").notNull(),
  sessionData: t.jsonb("session_data").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  expiresAt: t.timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  revokedAt: t.timestamp("revoked_at", { withTimezone: true, mode: "string" }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("staff_sessions_account_revocation").on(table.staffAccountId, table.expiresAt),
  t.index("staff_sessions_expiry_cleanup").on(table.expiresAt),
  t.foreignKey({
    name: "staff_sessions_account",
    columns: [table.staffAccountId],
    foreignColumns: [staffAccounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("staff_sessions_hash_shape", sql`octet_length(session_hash) = 32`),
  t.check("staff_sessions_data_object", sql`jsonb_typeof(session_data) = 'object'`),
  t.check("staff_sessions_expiry_order", sql`expires_at > created_at`),
  t.check("staff_sessions_revocation_order", sql`revoked_at IS NULL OR revoked_at >= created_at`),
]);

export const staffAuditEvents = t.pgTable("staff_audit_events", {
  id: t.uuid("id").primaryKey().notNull(),
  staffAccountId: t.uuid("staff_account_id").notNull(),
  actionCode: t.varchar("action_code", { length: 80 }).notNull(),
  targetKind: t.varchar("target_kind", { length: 48 }).notNull(),
  targetKey: t.varchar("target_key", { length: 160 }).notNull(),
  requestKey: t.uuid("request_key").unique().notNull(),
  reason: t.text("reason"),
  details: t.jsonb("details").$type<JsonObject>(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("staff_audit_events_actor_history").on(table.staffAccountId, table.createdAt, table.id),
  t.index("staff_audit_events_target_history").on(table.targetKind, table.targetKey, table.createdAt, table.id),
  t.foreignKey({
    name: "staff_audit_events_actor",
    columns: [table.staffAccountId],
    foreignColumns: [staffAccounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("staff_audit_events_details_object", sql`details IS NULL OR jsonb_typeof(details) = 'object'`),
  t.check("staff_audit_events_nonblank_target_action", sql`length(btrim(action_code)) > 0 AND length(btrim(target_kind)) > 0 AND length(btrim(target_key)) > 0`),
]);
