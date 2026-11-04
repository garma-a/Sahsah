// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { workState } from "./enums.js";
import type { JsonObject } from "./types.js";

export const outboxEvents = t.pgTable("outbox_events", {
  id: t.uuid("id").primaryKey().notNull(),
  deduplicationKey: t.varchar("deduplication_key", { length: 160 }).unique().notNull(),
  topic: t.varchar("topic", { length: 80 }).notNull(),
  resourceKind: t.varchar("resource_kind", { length: 48 }).notNull(),
  resourceId: t.uuid("resource_id").notNull(),
  payload: t.jsonb("payload").$type<JsonObject>().default(sql`'{}'::jsonb`).notNull(),
  state: workState("state").default("pending").notNull(),
  attemptCount: t.integer("attempt_count").default(0).notNull(),
  maxAttempts: t.smallint("max_attempts").default(10).notNull(),
  availableAt: t.timestamp("available_at", { withTimezone: true, mode: "string" }).notNull(),
  leaseToken: t.uuid("lease_token"),
  leaseUntil: t.timestamp("lease_until", { withTimezone: true, mode: "string" }),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).notNull(),
  finishedAt: t.timestamp("finished_at", { withTimezone: true, mode: "string" }),
  lastErrorCode: t.varchar("last_error_code", { length: 80 }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.index("outbox_events_resource_history").on(table.resourceKind, table.resourceId, table.createdAt, table.id),
  t.index("outbox_events_pending_work").on(table.availableAt, table.id).where(sql`state = 'pending'`),
  t.index("outbox_events_stale_leases").on(table.leaseUntil, table.id).where(sql`state = 'running'`),
  t.check("outbox_events_nonblank_routing", sql`length(btrim(topic)) > 0 AND length(btrim(resource_kind)) > 0`),
  t.check("outbox_events_payload_object", sql`jsonb_typeof(payload) = 'object'`),
  t.check("outbox_events_attempt_bounds", sql`max_attempts > 0 AND attempt_count BETWEEN 0 AND max_attempts`),
  t.check("outbox_events_lease_token_pair", sql`(state = 'running') = (lease_token IS NOT NULL)`),
  t.check("outbox_events_lease_time_pair", sql`(lease_token IS NULL) = (lease_until IS NULL)`),
  t.check("outbox_events_claim_attempt", sql`state <> 'running' OR attempt_count > 0`),
  t.check("outbox_events_finish_pair", sql`(state IN ('succeeded', 'dead')) = (finished_at IS NOT NULL)`),
  t.check("outbox_events_finish_order", sql`finished_at IS NULL OR finished_at >= created_at`),
]);
