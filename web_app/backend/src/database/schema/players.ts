import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { accounts } from "./identity.js";
import { staffAccounts, staffAuditEvents } from "./staff.js";

/**
 * Account ban history. A ban is active while `lifted_at` is null; the unique partial index allows
 * one active ban per account and is also the fast lookup the gameplay API uses.
 */
export const accountBans = t.pgTable("account_bans", {
  id: t.uuid("id").primaryKey().notNull(),
  accountId: t.uuid("account_id").notNull(),
  reason: t.text("reason").notNull(),
  bannedBy: t.uuid("banned_by").notNull(),
  auditEventId: t.uuid("audit_event_id").unique().notNull(),
  bannedAt: t.timestamp("banned_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  liftedAt: t.timestamp("lifted_at", { withTimezone: true, mode: "string" }),
  liftedBy: t.uuid("lifted_by"),
  liftReason: t.text("lift_reason"),
  liftAuditEventId: t.uuid("lift_audit_event_id").unique(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.uniqueIndex("account_bans_one_active").on(table.accountId).where(sql`lifted_at IS NULL`),
  t.index("account_bans_account_history").on(table.accountId, table.bannedAt, table.id),
  t.foreignKey({ name: "account_bans_account", columns: [table.accountId], foreignColumns: [accounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_bans_banned_by", columns: [table.bannedBy], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_bans_audit", columns: [table.auditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_bans_lifted_by", columns: [table.liftedBy], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_bans_lift_audit", columns: [table.liftAuditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.check("account_bans_reason_present", sql`length(btrim(reason)) > 0`),
  t.check("account_bans_lift_complete", sql`(lifted_at IS NULL) = (lifted_by IS NULL) AND (lifted_at IS NULL) = (lift_reason IS NULL) AND (lifted_at IS NULL) = (lift_audit_event_id IS NULL)`),
  t.check("account_bans_lift_reason_present", sql`lift_reason IS NULL OR length(btrim(lift_reason)) > 0`),
  t.check("account_bans_lift_order", sql`lifted_at IS NULL OR lifted_at >= banned_at`),
]);

/** Staff-only notes on an account. A flag is open until resolved; it restricts nothing. */
export const accountFlags = t.pgTable("account_flags", {
  id: t.uuid("id").primaryKey().notNull(),
  accountId: t.uuid("account_id").notNull(),
  note: t.text("note").notNull(),
  createdBy: t.uuid("created_by").notNull(),
  auditEventId: t.uuid("audit_event_id").unique().notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  resolvedAt: t.timestamp("resolved_at", { withTimezone: true, mode: "string" }),
  resolvedBy: t.uuid("resolved_by"),
  resolveAuditEventId: t.uuid("resolve_audit_event_id").unique(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("account_flags_account_history").on(table.accountId, table.createdAt, table.id),
  t.index("account_flags_open").on(table.accountId).where(sql`resolved_at IS NULL`),
  t.foreignKey({ name: "account_flags_account", columns: [table.accountId], foreignColumns: [accounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_flags_created_by", columns: [table.createdBy], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_flags_audit", columns: [table.auditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_flags_resolved_by", columns: [table.resolvedBy], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "account_flags_resolve_audit", columns: [table.resolveAuditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.check("account_flags_note_present", sql`length(btrim(note)) > 0`),
  t.check("account_flags_resolution_complete", sql`(resolved_at IS NULL) = (resolved_by IS NULL) AND (resolved_at IS NULL) = (resolve_audit_event_id IS NULL)`),
  t.check("account_flags_resolution_order", sql`resolved_at IS NULL OR resolved_at >= created_at`),
]);

/**
 * Durable progress of one bulk grant. The audit event is written once; every credit references it
 * and carries the idempotency key `bulk:<id>:<account>`, so a resumed run never credits twice.
 */
export const bulkGrants = t.pgTable("bulk_grants", {
  id: t.uuid("id").primaryKey().notNull(),
  requestKey: t.uuid("request_key").unique().notNull(),
  auditEventId: t.uuid("audit_event_id").unique().notNull(),
  targetKind: t.text("target_kind").notNull(),
  targetPhones: t.text("target_phones").array(),
  quantity: t.integer("quantity").notNull(),
  reason: t.text("reason").notNull(),
  targetCount: t.integer("target_count").notNull(),
  grantedCount: t.integer("granted_count").default(0).notNull(),
  lastAccountId: t.uuid("last_account_id"),
  createdBy: t.uuid("created_by").notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  completedAt: t.timestamp("completed_at", { withTimezone: true, mode: "string" }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("bulk_grants_recent").on(table.createdAt, table.id),
  t.foreignKey({ name: "bulk_grants_audit", columns: [table.auditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "bulk_grants_created_by", columns: [table.createdBy], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.check("bulk_grants_target", sql`(target_kind = 'all_active' AND target_phones IS NULL) OR (target_kind = 'phone_list' AND target_phones IS NOT NULL AND cardinality(target_phones) > 0)`),
  t.check("bulk_grants_quantity", sql`quantity BETWEEN 1 AND 1000`),
  t.check("bulk_grants_reason_present", sql`length(btrim(reason)) > 0`),
  t.check("bulk_grants_progress", sql`target_count >= 0 AND granted_count >= 0`),
]);
