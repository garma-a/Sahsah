import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UseFilters,
} from "@nestjs/common";
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { clientAddress } from "./http.js";
import { previewCredential, previewIdentity } from "./preview.js";
import { GameplayProblemFilter, requireState } from "./problem.js";
import { GameplayRates } from "./rates.js";
import { GameplayService } from "./service.js";

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
  constructor(private core: GameplayService) {}
  /** Creates this browser's preview host, or renews the one it already holds. */
  @Post("sessions")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  async session(@Req() req: Request, @Body() body: unknown) {
    const preview = this.core.options.preview;
    requireState(this.core.options.enabled && preview, "NOT_FOUND", 404);
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
    const accountId = await this.core.database.transaction(async (db) => {
      if (held) {
        const renewed = await db.execute(
          sql`UPDATE accounts SET display_name=${displayName} WHERE id=${held.accountId} AND state='active' RETURNING id`,
        );
        requireState(renewed.rows.length, "UNAUTHENTICATED", 401);
        return held.accountId;
      }
      const id = randomUUID(),
        audit = randomUUID();
      await db.execute(
        sql`INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES(${staffId},'admin','preview@sahsah.invalid','disabled') ON CONFLICT DO NOTHING`,
      );
      // +2000… is outside every Egyptian numbering range, so it cannot be a real phone.
      await db.execute(
        sql`INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES(${id},${displayName},${`+2000${String(randomInt(1e10)).padStart(10, "0")}`},clock_timestamp())`,
      );
      await db.execute(
        sql`INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES(${audit},${staffId},'token_grant','account',${id},${randomUUID()},'Preview host grant (ADR 0017)')`,
      );
      await db.execute(
        sql`INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text) VALUES(${randomUUID()},${id},'credit',${grant},${`preview:${id}`},${audit},'Preview host grant')`,
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
