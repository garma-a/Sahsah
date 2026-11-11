import { DatabaseService } from "../../database/database.module.js";
import { GameplayRuntime } from "../platform/runtime.js";
import { writtenAtMost } from "../platform/invariant.js";
import { single, invariant } from "../platform/invariant.js";
import { Body, Controller, Header, HttpCode, Post, Req, UseFilters } from "@nestjs/common";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { and, eq, sql } from "drizzle-orm";
import * as s from "../../database/schema/index.js";
import { z } from "zod";
import { clientAddress } from "../platform/http.js";
import { previewCredential, previewIdentity } from "./identity.js";
import { GameplayProblemFilter, requireState } from "../platform/problem.js";
import { GameplayRates } from "../platform/rates.js";

const staffId = "00000000-0000-4000-8000-000000000017",
  grant = 10000;
const request = z
  .object({
    passcode: z.string().min(1).max(200).optional(),
    credential: z.string().min(1).max(2000).optional(),
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();
const sha = (value: string) => createHash("sha256").update(value).digest();

@Controller("v1/preview")
@UseFilters(GameplayProblemFilter)
export class PreviewController {
  private rates = new GameplayRates();
  constructor(
    readonly runtime: GameplayRuntime,
    readonly database: DatabaseService,
  ) {}
  /** Creates this browser's preview host, or renews the one it already holds. */
  @Post("sessions")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  async session(@Req() req: Request, @Body() body: unknown) {
    const preview = this.runtime.options.preview;
    requireState(this.runtime.options.enabled && preview, "NOT_FOUND", 404);
    const parsed = request.safeParse(body);
    requireState(parsed.success, "INVALID_INPUT", 400);
    const { passcode, credential, displayName } = parsed.data;
    const held = credential
      ? await previewIdentity(preview)(credential)
      : undefined;
    // Passcode guessing is bounded per client address: five tries, then one
    // per 12 s. Renewals with a held credential only need a loose bound.
    if (held) this.rates.take(`renew:${held.accountId}`, 1, 10);
    else this.rates.take(`passcode:${clientAddress(req)}`, 1 / 12, 5);
    requireState(
      held ||
        (passcode && timingSafeEqual(sha(passcode), sha(preview.passcode))),
      "UNAUTHENTICATED",
      401,
    );
    const accountId = await this.database.transaction(async (db) => {
      if (held) {
        const renewed = await db
          .update(s.accounts)
          .set({ displayName })
          .where(
            and(
              eq(s.accounts.id, held.accountId),
              eq(s.accounts.state, "active"),
            ),
          )
          .returning({ id: s.accounts.id });
        requireState(renewed.length, "UNAUTHENTICATED", 401);
        invariant(renewed.length === 1, "PREVIEW_RENEW_SINGLE_ACCOUNT");
        return held.accountId;
      }
      const id = randomUUID(),
        audit = randomUUID();
      // Ledger credits require an active granting staff account; "disabled" is
      // not a password hash, so this account can never sign in to AdminJS.
      await writtenAtMost(
        db
          .insert(s.staffAccounts)
          .values({
            id: staffId,
            role: "admin",
            normalizedEmail: "preview@sahsah.invalid",
            passwordHash: "disabled",
          })
          .onConflictDoNothing()
          .returning(),
        1,
        "STAFFACCOUNTS_WRITE_COUNT",
      );
      // +2000… is outside every Egyptian numbering range, so it cannot be a real phone.
      single(
        await db
          .insert(s.accounts)
          .values({
            id,
            displayName,
            phoneE164: `+2000${String(randomInt(1e10)).padStart(10, "0")}`,
            // Preview verification uses database wall time in the insert.
            phoneVerifiedAt: sql<string>`clock_timestamp()`,
          })
          .returning(),
        "ACCOUNTS_WRITE_ROW",
      );
      single(
        await db
          .insert(s.staffAuditEvents)
          .values({
            id: audit,
            staffAccountId: staffId,
            actionCode: "token_grant",
            targetKind: "account",
            targetKey: id,
            requestKey: randomUUID(),
            reason: "Preview host grant (ADR 0017)",
          })
          .returning(),
        "STAFFAUDITEVENTS_WRITE_ROW",
      );
      single(
        await db
          .insert(s.tokenLedgerEntries)
          .values({
            id: randomUUID(),
            accountId: id,
            entryKind: "credit",
            amount: grant,
            idempotencyKey: `preview:${id}`,
            staffAuditEventId: audit,
            reasonText: "Preview host grant",
          })
          .returning(),
        "TOKENLEDGERENTRIES_WRITE_ROW",
      );
      return id;
    });
    return {
      ...(await previewCredential(preview, accountId)),
      accountId,
      displayName,
    };
  }
}
