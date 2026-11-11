import { requireState } from "../../problem.js";

import { revision } from "../../contract.js";
import type { StartState } from "./types.js";
export async function validateStart(state: StartState) {
  const {
    operations,
    db,
    room,
    now,
    accounts,
    body,
    roster,
    selections,
    content: { packs, categories },
  } = state;
  await operations.rooms.lobby(db, room, now);
  requireState(room.presentationMode === "lobby", "LOBBY_NOT_OPEN");
  requireState(
    revision(body.expectedRoomVersion) === room.stateVersion &&
      body.expectedReadyGeneration === room.lobbyGeneration,
    "STALE_ROOM_VERSION",
  );
  requireState(
    accounts.every((a) => a.state === "active" && !a.activeGameId),
    "ACCOUNT_ALREADY_PLAYING",
  );
  requireState(
    accounts.find((a) => a.id === room.ownerAccountId)!.tokenBalance >= 1,
    "INSUFFICIENT_TOKENS",
  );
  const eligibility = await operations.catalog.eligibilities(db, packs, roster);
  for (const choice of selections) {
    const pack = packs.find((p) => p.id === choice.packId),
      category = categories.find((c) => c.id === choice.categoryId);
    requireState(
      category &&
        !category.archivedAt &&
        pack &&
        !pack.archivedAt &&
        pack.publicationState === "published" &&
        pack.categoryId === category.id &&
        pack.contentRevision === choice.observedRevision,
      "SELECTION_CHANGED",
    );
    requireState(
      category.nameAr.trim().length > 0 &&
        category.nameAr.length <= 160 &&
        (!category.nameFranco || category.nameFranco.length <= 160),
      "CONTENT_NOT_READY",
    );
    const e = eligibility.get(pack.id)!;
    requireState(e.questions.length === 6, "CONTENT_NOT_READY");
    requireState(
      e.fresh ||
        (choice.repeatAcceptedAt &&
          choice.repeatConsentBasis?.toString("hex") === e.basis),
      "REPEAT_CONSENT_REQUIRED",
      409,
      { packId: pack.id, eligibilityBasis: e.basis },
    );
  }
}
