// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { bytea } from "./types.js";
import { games } from "./games.js";
import { accounts } from "./identity.js";

export const rooms = t.pgTable("rooms", {
  id: t.uuid("id").primaryKey().notNull(),
  ownerAccountId: t.uuid("owner_account_id").notNull(),
  currentGameId: t.uuid("current_game_id"),
  lobbyGeneration: t.integer("lobby_generation").default(1).notNull(),
  teamOneName: t.text("team_one_name").notNull(),
  teamTwoName: t.text("team_two_name").notNull(),
  createdAt: t.timestamp("created_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  closedAt: t.timestamp("closed_at", { withTimezone: true, mode: "string" }),
  invitationCode: t.char("invitation_code", { length: 6 }).unique(),
  invitationIssuedAt: t.timestamp("invitation_issued_at", { withTimezone: true, mode: "string" }),
  invitationExpiresAt: t.timestamp("invitation_expires_at", { withTimezone: true, mode: "string" }),
  invitationRevokedAt: t.timestamp("invitation_revoked_at", { withTimezone: true, mode: "string" }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.uniqueIndex("rooms_owner_identity").on(table.id, table.ownerAccountId),
  t.index("rooms_expired_code_cleanup").on(table.invitationExpiresAt, table.id).where(sql`invitation_code IS NOT NULL`),
  t.foreignKey({
    name: "rooms_owner",
    columns: [table.ownerAccountId],
    foreignColumns: [accounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "rooms_current_game",
    columns: [table.currentGameId, table.id],
    foreignColumns: [games.id, games.roomId],
  }).onDelete("no action").onUpdate("no action"),
  t.check("rooms_positive_lobby_generation", sql`lobby_generation > 0`),
  t.check("rooms_nonblank_team_names", sql`length(btrim(team_one_name)) > 0 AND length(btrim(team_two_name)) > 0`),
  t.check("rooms_close_order", sql`closed_at IS NULL OR closed_at >= created_at`),
  t.check("rooms_invitation_presence", sql`(invitation_code IS NULL) = (invitation_issued_at IS NULL) AND (invitation_code IS NULL) = (invitation_expires_at IS NULL)`),
  t.check("rooms_six_digit_code", sql`invitation_code IS NULL OR invitation_code ~ '^[0-9]{6}$'`),
  t.check("rooms_invitation_lifetime", sql`invitation_expires_at IS NULL OR invitation_expires_at = invitation_issued_at + interval '24 hours'`),
  t.check("rooms_invitation_revocation", sql`invitation_revoked_at IS NULL OR (invitation_code IS NOT NULL AND invitation_revoked_at >= invitation_issued_at)`),
]);

export const roomMemberships = t.pgTable("room_memberships", {
  id: t.uuid("id").primaryKey().notNull(),
  roomId: t.uuid("room_id").notNull(),
  accountId: t.uuid("account_id"),
  displayName: t.text("display_name").notNull(),
  lobbyTeamNumber: t.smallint("lobby_team_number"),
  readyForGeneration: t.integer("ready_for_generation"),
  readyAt: t.timestamp("ready_at", { withTimezone: true, mode: "string" }),
  joinedAt: t.timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull(),
  leftAt: t.timestamp("left_at", { withTimezone: true, mode: "string" }),
  removedAt: t.timestamp("removed_at", { withTimezone: true, mode: "string" }),
  removalLiftedAt: t.timestamp("removal_lifted_at", { withTimezone: true, mode: "string" }),
  removalLiftedByAccountId: t.uuid("removal_lifted_by_account_id"),
  reconnectCredentialHash: bytea("reconnect_credential_hash").unique(),
  reconnectIssuedAt: t.timestamp("reconnect_issued_at", { withTimezone: true, mode: "string" }),
  reconnectRevokedAt: t.timestamp("reconnect_revoked_at", { withTimezone: true, mode: "string" }),
}, (table): t.PgTableExtraConfigValue[] => [
  t.uniqueIndex("room_memberships_room_identity").on(table.roomId, table.id),
  t.uniqueIndex("room_memberships_one_active_account").on(table.roomId, table.accountId).where(sql`account_id IS NOT NULL AND left_at IS NULL AND removed_at IS NULL`),
  t.index("room_memberships_account_recovery").on(table.accountId, table.roomId).where(sql`account_id IS NOT NULL`),
  t.foreignKey({
    name: "room_memberships_room",
    columns: [table.roomId],
    foreignColumns: [rooms.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "room_memberships_account",
    columns: [table.accountId],
    foreignColumns: [accounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "room_memberships_unblock_host",
    columns: [table.roomId, table.removalLiftedByAccountId],
    foreignColumns: [rooms.id, rooms.ownerAccountId],
  }).onDelete("no action").onUpdate("no action"),
  t.check("room_memberships_inactive_credential_revoked", sql`(left_at IS NULL AND removed_at IS NULL) OR reconnect_credential_hash IS NULL OR reconnect_revoked_at IS NOT NULL`),
  t.check("room_memberships_unblock_order", sql`removal_lifted_at IS NULL OR (removed_at IS NOT NULL AND removal_lifted_at >= removed_at)`),
  t.check("room_memberships_unblock_pair", sql`(removal_lifted_at IS NULL) = (removal_lifted_by_account_id IS NULL)`),
  t.check("room_memberships_nonblank_name", sql`length(btrim(display_name)) > 0`),
  t.check("room_memberships_team_bounds", sql`lobby_team_number IS NULL OR lobby_team_number IN (1, 2)`),
  t.check("room_memberships_ready_pair", sql`(ready_for_generation IS NULL) = (ready_at IS NULL)`),
  t.check("room_memberships_ready_generation", sql`ready_for_generation IS NULL OR ready_for_generation > 0`),
  t.check("room_memberships_ready_order", sql`ready_at IS NULL OR ready_at >= joined_at`),
  t.check("room_memberships_leave_order", sql`left_at IS NULL OR left_at >= joined_at`),
  t.check("room_memberships_removal_order", sql`removed_at IS NULL OR removed_at >= joined_at`),
  t.check("room_memberships_credential_pair", sql`(reconnect_credential_hash IS NULL) = (reconnect_issued_at IS NULL)`),
  t.check("room_memberships_credential_hash", sql`reconnect_credential_hash IS NULL OR octet_length(reconnect_credential_hash) = 32`),
  t.check("room_memberships_credential_revocation", sql`reconnect_revoked_at IS NULL OR (reconnect_issued_at IS NOT NULL AND reconnect_revoked_at >= reconnect_issued_at)`),
]);
