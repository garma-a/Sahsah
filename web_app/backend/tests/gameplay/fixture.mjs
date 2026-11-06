import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { cluster } from "../database/cluster.mjs";
import { createApplication } from "../../dist/application.js";

export const secret = () => randomBytes(32).toString("base64url");
export async function gameplayFixture(t, { hosts = 3, tokens = 3 } = {}) {
  process.env.NODE_ENV = "test";
  process.env.ADMIN_ENABLED = "false";
  const cleanup = [];
  const pg = await cluster({ after: (fn) => cleanup.push(fn) });
  const owner = await pg.database("sahsah_gameplay_races");
  let app;
  t.after(async () => {
    await app?.close();
    await owner.end();
    for (const fn of cleanup) await fn();
  });
  const staff = randomUUID(),
    accounts = [];
  await owner.query(
    "INSERT INTO staff_accounts(id,role,normalized_email,password_hash) VALUES($1,'admin','race@example.invalid','fixture')",
    [staff],
  );
  for (let i = 0; i < hosts; i++) {
    const account = randomUUID(),
      audit = randomUUID();
    accounts.push(account);
    await owner.query(
      "INSERT INTO accounts(id,display_name,phone_e164,phone_verified_at) VALUES($1,'Player',$2,now())",
      [account, `+2012300${String(i).padStart(5, "0")}`],
    );
    await owner.query(
      "INSERT INTO staff_audit_events(id,staff_account_id,action_code,target_kind,target_key,request_key,reason) VALUES($1,$2,'token_grant','account',$3,$4,'Disposable load fixture')",
      [audit, staff, account, randomUUID()],
    );
    await owner.query(
      "INSERT INTO token_ledger_entries(id,account_id,entry_kind,amount,idempotency_key,staff_audit_event_id,reason_text) VALUES($1,$2,'credit',$3,$4,$5,'Disposable fixture')",
      [randomUUID(), account, tokens, randomUUID(), audit],
    );
  }
  const selections = [];
  for (let pos = 1; pos <= 6; pos++) {
    const categoryId = randomUUID(),
      packId = randomUUID();
    await owner.query(
      "INSERT INTO categories(id,name_ar,display_order) VALUES($1,$2,$3)",
      [categoryId, `Category ${pos}`, pos],
    );
    await owner.query(
      "INSERT INTO question_packs(id,category_id,pack_number,publication_state) VALUES($1,$2,1,'published')",
      [packId, categoryId],
    );
    for (let slot = 1; slot <= 6; slot++)
      await owner.query(
        "INSERT INTO questions(id,pack_id,slot_number,format,prompt_ar,answer_ar) VALUES($1,$2,$3,'STANDARD','Prompt','Answer')",
        [randomUUID(), packId, slot],
      );
    selections.push({
      boardPosition: pos,
      categoryId,
      packId,
      observedRevision: "1",
    });
  }
  let pressure = 0.1;
  process.env.DATABASE_URL = pg.url("sahsah_app", "sahsah_gameplay_races");
  app = await createApplication({
    gameplay: {
      enabled: true,
      verifyAccount: async (token) =>
        /^a\d+$/.test(token) && accounts[Number(token.slice(1))]
          ? {
              accountId: accounts[Number(token.slice(1))],
              expiresAt: Date.now() + 3600000,
            }
          : undefined,
      pressure: async () => ({
        api: pressure,
        database: pressure,
        sampledAt: Date.now(),
      }),
      capacity: {
        rooms: Math.max(200, hosts * 2),
        games: Math.max(200, hosts * 2),
        members: Math.max(1200, hosts * 12),
      },
    },
  });
  await app.listen(0, "127.0.0.1");
  const base = `${await app.getUrl()}/api/v1`;
  const call = async (
    method,
    path,
    body,
    {
      account = 0,
      authorization = `Bearer a${account}`,
      control,
      generation = "1",
      operationId = randomUUID(),
      guestProof,
    } = {},
  ) => {
    const started = performance.now();
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
        "Idempotency-Key": operationId,
        ...(control
          ? {
              "X-Control-Secret": control,
              "X-Controller-Generation": generation,
            }
          : {}),
        ...(guestProof ? { "X-Guest-Proof": guestProof } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: await response.json(),
      elapsedMs: performance.now() - started,
    };
  };
  const create = async (account = 0) => {
    const control = secret(),
      operationId = randomUUID(),
      body = {
        teamOneName: "A",
        teamTwoName: "B",
        hostTeamNumber: null,
        selections,
        proposedControlSecret: control,
      };
    const result = await call("POST", "/rooms", body, { account, operationId });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return { account, control, operationId, body, ...result.body };
  };
  return {
    app,
    owner,
    pg,
    base,
    accounts,
    selections,
    call,
    create,
    setPressure: (value) => {
      pressure = value;
    },
  };
}
