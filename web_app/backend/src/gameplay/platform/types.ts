import type { DatabaseService } from "../../database/database.module.js";
import type * as s from "../../database/schema/index.js";
import type { VerifiedAccount } from "./ports.js";
export type Tx = DatabaseService["db"];
export type Room = typeof s.rooms.$inferSelect;
export type Member = typeof s.roomMemberships.$inferSelect;
export type Game = typeof s.games.$inferSelect;
export type Question = typeof s.gameQuestions.$inferSelect;
export interface Actor {
  account?: VerifiedAccount;
  member?: Member;
  secret?: string;
  controlSecret?: string;
  generation?: bigint;
  proofFingerprint?: string;
}
