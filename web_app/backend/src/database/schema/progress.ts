// Database names and constraints follow the accepted v1.2 design.
// Cyclic foreign keys are evaluated lazily in pgTable extra configuration.
import * as t from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { questions } from "./catalog.js";
import { gamePacks, gamePlayers } from "./games.js";
import { accounts } from "./identity.js";

export const accountQuestionExposures = t.pgTable("account_question_exposures", {
  accountId: t.uuid("account_id").notNull(),
  questionId: t.uuid("question_id").notNull(),
  firstExposedAt: t.timestamp("first_exposed_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
  firstGameId: t.uuid("first_game_id"),
}, (table): t.PgTableExtraConfigValue[] => [
  t.primaryKey({ name: "account_question_exposures_pkey", columns: [table.accountId, table.questionId] }),
  t.foreignKey({
    name: "exposure_account",
    columns: [table.accountId],
    foreignColumns: [accounts.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "exposure_question",
    columns: [table.questionId],
    foreignColumns: [questions.id],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "exposure_first_membership",
    columns: [table.firstGameId, table.accountId],
    foreignColumns: [gamePlayers.gameId, gamePlayers.accountId],
  }).onDelete("no action").onUpdate("no action"),
]);

export const accountPackCompletions = t.pgTable("account_pack_completions", {
  accountId: t.uuid("account_id").notNull(),
  gameId: t.uuid("game_id").notNull(),
  boardPosition: t.smallint("board_position").notNull(),
  completedAt: t.timestamp("completed_at", { withTimezone: true, mode: "string" }).default(sql`now()`).notNull(),
}, (table): t.PgTableExtraConfigValue[] => [
  t.primaryKey({ name: "account_pack_completions_pkey", columns: [table.accountId, table.gameId, table.boardPosition] }),
  t.foreignKey({
    name: "completion_membership",
    columns: [table.gameId, table.accountId],
    foreignColumns: [gamePlayers.gameId, gamePlayers.accountId],
  }).onDelete("no action").onUpdate("no action"),
  t.foreignKey({
    name: "completion_game_pack",
    columns: [table.gameId, table.boardPosition],
    foreignColumns: [gamePacks.gameId, gamePacks.boardPosition],
  }).onDelete("no action").onUpdate("no action"),
]);
