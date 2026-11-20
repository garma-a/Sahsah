// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contactKind, contactState } from "./enums.js";
import { bytea } from "./types.js";
import type { JsonObject } from "./types.js";
import { mediaAssets } from "./catalog.js";
import { accounts } from "./identity.js";
import { staffAccounts, staffAuditEvents } from "./staff.js";

export const contactSubmissions = t.pgTable("contact_submissions", {
  id: t.uuid("id").primaryKey().notNull(),
  requestKey: t.uuid("request_key").unique().notNull(),
  requestDigest: bytea("request_digest").notNull(),
  accountId: t.uuid("account_id"),
  kind: contactKind("kind").notNull(),
  supportReason: t.varchar("support_reason", { length: 24 }),
  businessKind: t.varchar("business_kind", { length: 24 }),
  name: t.text("name"),
  email: t.text("email"),
  handle: t.text("handle"),
  message: t.text("message"),
  rating: t.smallint("rating"),
  state: contactState("state").default("open").notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  closedAt: t.timestamp("closed_at", { withTimezone: true, mode: "string" }),
  closedByStaffId: t.uuid("closed_by_staff_id"),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("contact_submissions_staff_inbox").on(table.state, table.createdAt, table.id),
  // Inbox filters: all messages, one kind, and one kind within a state, newest first.
  t.index("contact_submissions_recent").on(table.createdAt, table.id),
  t.index("contact_submissions_kind_recent").on(table.kind, table.createdAt, table.id),
  t.index("contact_submissions_kind_state_recent").on(table.kind, table.state, table.createdAt, table.id),
  t.index("contact_submissions_account_cleanup").on(table.accountId, table.createdAt, table.id),
  t.foreignKey({
    name: "contact_submissions_account",
    columns: [table.accountId],
    foreignColumns: [accounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "contact_submissions_closing_staff",
    columns: [table.closedByStaffId],
    foreignColumns: [staffAccounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("contact_submissions_request_digest", sql`octet_length(request_digest) = 32`),
  t.check("contact_submissions_message_bounds", sql`message IS NULL OR length(message) <= 1000`),
  t.check("contact_submissions_rating_bounds", sql`rating IS NULL OR rating BETWEEN 1 AND 5`),
  t.check("contact_submissions_form_shape", sql`(kind = 'support' AND support_reason IS NOT NULL AND support_reason IN ('technical', 'purchase', 'account') AND business_kind IS NULL AND email IS NOT NULL AND message IS NOT NULL AND length(btrim(message)) >= 5 AND rating IS NULL) OR (kind = 'business' AND business_kind IS NOT NULL AND business_kind IN ('business', 'influencer') AND support_reason IS NULL AND email IS NOT NULL AND message IS NOT NULL AND length(btrim(message)) >= 5 AND rating IS NULL) OR (kind = 'experience' AND support_reason IS NULL AND business_kind IS NULL AND (rating IS NOT NULL OR (message IS NOT NULL AND length(btrim(message)) > 0)))`),
  t.check("contact_submissions_closed_time", sql`(state = 'closed') = (closed_at IS NOT NULL)`),
  t.check("contact_submissions_closing_actor", sql`(closed_at IS NULL) = (closed_by_staff_id IS NULL)`),
  t.check("contact_submissions_closing_order", sql`closed_at IS NULL OR closed_at >= created_at`),
]);

/**
 * A staff answer to a contact message (CONTEXT: Support reply). The row is written as `sending`
 * together with its audit event, the email provider is called afterwards, and the row then becomes
 * `sent` or `failed`. `external` records that staff answered from their own mail app.
 */
export const contactReplies = t.pgTable("contact_replies", {
  id: t.uuid("id").primaryKey().notNull(),
  contactId: t.uuid("contact_id").notNull(),
  staffId: t.uuid("staff_id").notNull(),
  requestKey: t.uuid("request_key").unique().notNull(),
  auditEventId: t.uuid("audit_event_id").unique().notNull(),
  body: t.text("body").notNull(),
  status: t.varchar("status", { length: 16 }).notNull(),
  providerMessageId: t.text("provider_message_id"),
  errorCode: t.varchar("error_code", { length: 40 }),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  completedAt: t.timestamp("completed_at", { withTimezone: true, mode: "string" }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("contact_replies_thread").on(table.contactId, table.createdAt, table.id),
  t.foreignKey({ name: "contact_replies_contact", columns: [table.contactId], foreignColumns: [contactSubmissions.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "contact_replies_staff", columns: [table.staffId], foreignColumns: [staffAccounts.id] }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({ name: "contact_replies_audit", columns: [table.auditEventId], foreignColumns: [staffAuditEvents.id] }).onDelete("no action").onUpdate("no action"),
  t.check("contact_replies_body_bounds", sql`length(btrim(body)) > 0 AND length(body) <= 5000`),
  t.check("contact_replies_status", sql`status IN ('sending', 'sent', 'failed', 'external')`),
  t.check("contact_replies_completion", sql`(status = 'sending') = (completed_at IS NULL)`),
  t.check("contact_replies_outcome", sql`(status = 'failed') = (error_code IS NOT NULL) AND (provider_message_id IS NULL OR status = 'sent')`),
]);

export const publicPages = t.pgTable("public_pages", {
  id: t.uuid("id").primaryKey().notNull(),
  slug: t.varchar("slug", { length: 80 }).unique().notNull(),
  contentSchemaVersion: t.smallint("content_schema_version").default(1).notNull(),
  content: t.jsonb("content").$type<JsonObject>().notNull(),
  isPublished: t.boolean("is_published").default(false).notNull(),
  updatedByStaffId: t.uuid("updated_by_staff_id").notNull(),
  updatedAt: t.timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.foreignKey({
    name: "public_pages_editor",
    columns: [table.updatedByStaffId],
    foreignColumns: [staffAccounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("public_pages_slug_shape", sql`slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  t.check("public_pages_content_shape", sql`content_schema_version > 0 AND jsonb_typeof(content) = 'object'`),
]);

export const publicPageMedia = t.pgTable("public_page_media", {
  pageId: t.uuid("page_id").notNull(),
  slotKey: t.varchar("slot_key", { length: 80 }).notNull(),
  mediaAssetId: t.uuid("media_asset_id").notNull(),
  altAr: t.text("alt_ar"),
  altFranco: t.text("alt_franco"),
}, (table): t.PgTableExtraConfigValue[] => [
  t.primaryKey({ name: "public_page_media_pkey", columns: [table.pageId, table.slotKey] }),
  t.index("public_page_media_asset_references").on(table.mediaAssetId, table.pageId),
  t.foreignKey({
    name: "public_page_media_page",
    columns: [table.pageId],
    foreignColumns: [publicPages.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "public_page_media_asset",
    columns: [table.mediaAssetId],
    foreignColumns: [mediaAssets.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("public_page_media_nonblank_slot", sql`length(btrim(slot_key)) > 0`),
]);

export const siteSettings = t.pgTable("site_settings", {
  id: t.smallint("id").primaryKey().default(1).notNull(),
  settingsSchemaVersion: t.smallint("settings_schema_version").default(1).notNull(),
  logoAssetId: t.uuid("logo_asset_id"),
  branding: t.jsonb("branding").$type<JsonObject>().notNull(),
  updatedByStaffId: t.uuid("updated_by_staff_id").notNull(),
  updatedAt: t.timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.foreignKey({
    name: "site_settings_logo",
    columns: [table.logoAssetId],
    foreignColumns: [mediaAssets.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "site_settings_editor",
    columns: [table.updatedByStaffId],
    foreignColumns: [staffAccounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.check("site_settings_singleton_version", sql`id = 1 AND settings_schema_version > 0`),
  t.check("site_settings_branding_object", sql`jsonb_typeof(branding) = 'object'`),
]);
