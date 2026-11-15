import { LANGUAGE, request, type Auth } from "./client";
import type {
  Category,
  ControlStatus,
  CurrentRoom,
  GameCommand,
  Id,
  Invitation,
  InvitationPreview,
  MediaLinks,
  MediaRef,
  Pack,
  Page,
  PreviewSession,
  Receipt,
  Selection,
  Snapshot,
  TeamNumber,
} from "./types";

export async function listCategories(signal?: AbortSignal): Promise<Category[]> {
  const items: Category[] = [];
  let cursor: string | undefined;
  do {
    const page = await request<Page<Category>>("/categories", {
      query: { language: LANGUAGE, limit: 50, cursor },
      signal,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && items.length < 500);
  return items;
}

/** The first playable pack this host has not played before, or undefined when none is left. */
export async function firstFreshPack(categoryId: Id, auth: Auth): Promise<Pack | undefined> {
  const page = await request<Page<Pack>>(`/categories/${categoryId}/packs`, {
    auth,
    query: { language: LANGUAGE, freshOnly: true, limit: 1 },
  });
  return page.items[0];
}

export function previewSession(input: {
  passcode?: string;
  credential?: string;
  displayName: string;
}): Promise<PreviewSession> {
  return request<PreviewSession>("/preview/sessions", { method: "POST", body: input });
}

export function currentOwnedRoom(auth: Auth): Promise<{ room?: CurrentRoom }> {
  return request("/rooms/current", { auth });
}

export function createRoom(
  auth: Auth,
  operationId: string,
  body: {
    teamOneName: string;
    teamTwoName: string;
    hostTeamNumber: TeamNumber | null;
    selections: Omit<Selection, "repeatConsentBasis">[];
    proposedControlSecret: string;
  },
): Promise<Receipt> {
  return request("/rooms", { method: "POST", auth, operationId, body });
}

export function getRoom(roomId: Id, auth: Auth, signal?: AbortSignal): Promise<Snapshot> {
  return request(`/rooms/${roomId}`, { auth, query: { language: LANGUAGE }, signal });
}

export function getInvitation(roomId: Id, auth: Auth): Promise<Invitation> {
  return request(`/rooms/${roomId}/invitation`, { auth });
}

export function previewInvitation(code: string, signal?: AbortSignal): Promise<InvitationPreview> {
  return request(`/room-invitations/${code}`, { signal });
}

export function joinRoom(
  code: string,
  operationId: string,
  body: { displayName: string; teamNumber: TeamNumber; reconnectSecret: string },
): Promise<Receipt> {
  return request(`/room-invitations/${code}/memberships`, {
    method: "POST",
    operationId,
    body: { identity: "anonymous", ...body },
  });
}

// Every mutating call below takes its Idempotency-Key from the caller, which creates and keeps one key per
// intent (see use-intent-keys.ts), so a retry after a lost response recovers the same outcome.

export function setReadiness(
  roomId: Id,
  auth: Auth,
  operationId: string,
  input: { expectedMembershipVersion: string; expectedReadyGeneration: number; ready: boolean },
): Promise<Receipt> {
  return request(`/rooms/${roomId}/memberships/me/readiness`, { method: "PUT", auth, operationId, body: input });
}

export function updateOwnMembership(
  roomId: Id,
  auth: Auth,
  operationId: string,
  input: {
    expectedMembershipVersion: string;
    expectedReadyGeneration: number;
    teamNumber?: TeamNumber;
    displayName?: string;
  },
): Promise<Receipt> {
  return request(`/rooms/${roomId}/memberships/me`, { method: "PATCH", auth, operationId, body: input });
}

export function startGame(
  roomId: Id,
  auth: Auth,
  operationId: string,
  input: { expectedRoomVersion: string; expectedReadyGeneration: number },
): Promise<Receipt> {
  return request(`/rooms/${roomId}/games`, { method: "POST", auth, operationId, body: input });
}

export function executeCommand(gameId: Id, auth: Auth, operationId: string, command: GameCommand): Promise<Receipt> {
  return request(`/games/${gameId}/commands`, { method: "POST", auth, operationId, body: command });
}

/** Short-lived signed links for the images and sounds of the current view. Never log or store the URLs. */
export function mediaAccess(gameId: Id, auth: Auth, refs: MediaRef[], signal?: AbortSignal): Promise<MediaLinks> {
  return request(`/games/${gameId}/media-access`, { method: "POST", auth, body: { refs }, signal });
}

/** Host: move the room from the finished game's result back to the lobby to play again. */
export function returnToLobby(roomId: Id, auth: Auth, operationId: string, expectedRoomVersion: string): Promise<Receipt> {
  return request(`/rooms/${roomId}/lobby`, { method: "POST", auth, operationId, body: { expectedRoomVersion } });
}

export function closeRoom(roomId: Id, auth: Auth, operationId: string, expectedRoomVersion: string): Promise<Receipt> {
  return request(`/rooms/${roomId}/closure`, { method: "POST", auth, operationId, body: { expectedRoomVersion } });
}

export function getControlStatus(roomId: Id, auth: Auth): Promise<ControlStatus> {
  return request(`/rooms/${roomId}/control`, { auth });
}

export function takeControl(
  roomId: Id,
  auth: Auth,
  operationId: string,
  input: { expectedControllerGeneration: string; proposedControlSecret: string },
): Promise<Receipt> {
  return request(`/rooms/${roomId}/control`, { method: "POST", auth, operationId, body: input });
}
