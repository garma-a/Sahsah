"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import GameScreen from "@/components/room/game-screen";
import HostLobby from "@/components/room/host-lobby";
import PlayerLobby from "@/components/room/player-lobby";
import RoomShell from "@/components/room/room-shell";
import Button from "@/components/ui/button";
import ErrorBanner from "@/components/ui/error-banner";
import StatusCard from "@/components/ui/status-card";
import { type Auth } from "@/lib/api/client";
import { closeRoom, getControlStatus, previewSession, takeControl } from "@/lib/api/endpoints";
import { isConflict, messageOf, requireField } from "@/lib/api/errors";
import type { Category, LobbyView } from "@/lib/api/types";
import { newOperationId, newSecret } from "@/lib/ids";
import { saveRoster } from "@/lib/roster";
import { useRoomChannel } from "@/lib/realtime/use-room-channel";
import { useCategories } from "@/lib/use-categories";
import { useIntentKeys } from "@/lib/use-intent-keys";
import { useIdentity, useIdentityApi } from "@/providers/game-store-provider";

type CategoryIndex = ReadonlyMap<string, { category: Category; index: number }>;

export default function RoomView({ roomId }: { roomId: string }) {
  const hydrated = useIdentity((s) => s.hydrated);
  const host = useIdentity((s) => s.host);
  const hostRoom = useIdentity((s) => s.hostRooms[roomId]);
  const seat = useIdentity((s) => s.guestSeats[roomId]);
  const { state: catalog } = useCategories();

  const categories: CategoryIndex = useMemo(
    () => new Map((catalog.status === "ready" ? catalog.categories : []).map((category, index) => [category.id, { category, index }])),
    [catalog],
  );
  const covers = useMemo(
    () => (catalog.status === "ready" ? catalog.categories.flatMap((c) => (c.coverUrl ? [c.coverUrl] : [])) : []),
    [catalog],
  );

  if (!hydrated) {
    return (
      <RoomShell covers={covers}>
        <StatusCard title="ثانية…" busy />
      </RoomShell>
    );
  }
  if (host && hostRoom) {
    const auth: Auth = { kind: "host", credential: host.credential, controlSecret: hostRoom.controlSecret, generation: hostRoom.generation };
    return <LiveRoom key={`${roomId}:${hostRoom.controlSecret}`} roomId={roomId} auth={auth} role="host" covers={covers} categories={categories} />;
  }
  if (seat) {
    const auth: Auth = { kind: "guest", membershipId: seat.membershipId, secret: seat.secret };
    return <LiveRoom key={roomId} roomId={roomId} auth={auth} role="guest" membershipId={seat.membershipId} covers={covers} categories={categories} />;
  }
  return <Claim roomId={roomId} covers={covers} signedIn={Boolean(host)} />;
}

/** A signed-in host opening a room this browser holds no control proof for: take control explicitly. */
function Claim({ roomId, covers, signedIn }: { roomId: string; covers: string[]; signedIn: boolean }) {
  const identity = useIdentityApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    const host = identity.getState().host;
    if (!host) return;
    setBusy(true);
    setError(null);
    try {
      const account: Auth = { kind: "account", credential: host.credential };
      // The takeover (key, new secret and the generation it replaces) is saved before sending, so a lost
      // response is retried with the same values instead of installing a second secret.
      let pending = identity.getState().pendingTakeover;
      if (pending?.roomId !== roomId) {
        const status = await getControlStatus(roomId, account);
        pending = { roomId, operationId: newOperationId(), controlSecret: newSecret(), expectedGeneration: status.roomControllerGeneration };
        identity.getState().setPendingTakeover(pending);
      }
      try {
        const receipt = await takeControl(roomId, account, pending.operationId, {
          expectedControllerGeneration: pending.expectedGeneration,
          proposedControlSecret: pending.controlSecret,
        });
        identity.getState().setHostRoom(roomId, { controlSecret: pending.controlSecret, generation: requireField(receipt.controllerGeneration) });
        identity.getState().setPendingTakeover(null);
      } catch (cause) {
        // A conflict means the generation moved: the saved intent is stale, so the next try reads it again.
        if (isConflict(cause)) identity.getState().setPendingTakeover(null);
        throw cause;
      }
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoomShell covers={covers}>
      {signedIn ? (
        <StatusCard title="الغرفة دي مفتوحة من جهاز تاني" text="لو دي غرفتك، كمّل منها هنا. الجهاز التاني هيفقد التحكم.">
          <Button onClick={claim} disabled={busy}>
            {busy ? "ثانية…" : "كمّل من هنا"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/join">ادخل بكود</Link>
          </Button>
          {error && <ErrorBanner className="w-full">{error}</ErrorBanner>}
        </StatusCard>
      ) : (
        <StatusCard title="إنت مش في الغرفة دي" text="ادخل الغرفة بالكود اللي مع المضيف.">
          <Button asChild>
            <Link href="/join">ادخل بكود</Link>
          </Button>
        </StatusCard>
      )}
    </RoomShell>
  );
}

type LiveRoomProps = {
  roomId: string;
  auth: Auth;
  role: "host" | "guest";
  membershipId?: string;
  covers: string[];
  categories: CategoryIndex;
};

function LiveRoom({ roomId, auth, role, membershipId, covers, categories }: LiveRoomProps) {
  const router = useRouter();
  const identity = useIdentityApi();
  const isHost = role === "host";
  const intents = useIntentKeys();

  // A host credential the API is about to retire is renewed in place, then the stream re-authenticates.
  const renew = useCallback(async () => {
    const held = identity.getState().host;
    if (!held) return null;
    const session = await previewSession({ credential: held.credential, displayName: held.displayName });
    identity.getState().setHost({ credential: session.credential, expiresAt: session.expiresAt, accountId: session.accountId, displayName: session.displayName });
    return `Bearer ${session.credential}`;
  }, [identity]);

  const channel = useRoomChannel({ roomId, auth, renew: isHost ? renew : undefined });
  const { snapshot, status, error } = channel;

  // Once the room is gone, or this browser's proof is no longer accepted, forget it. A host whose control
  // secret is out of date then falls through to the explicit takeover; a guest returns to joining.
  const fenced = status === "failed" && (error?.code === "CONTROLLER_FENCED" || error?.code === "FRESH_CONTROL_SECRET_REQUIRED");
  const gone = status === "closed" || status === "revoked" || (status === "failed" && !isHost && [401, 403, 404, 410].includes(error?.status ?? 0));
  useEffect(() => {
    if (fenced) identity.getState().forgetRoom(roomId); // the view falls through to the takeover at once
  }, [fenced, roomId, identity]);
  useEffect(() => {
    // The "room closed" message stays on screen; its proofs are dropped when the player leaves the page.
    if (!gone) return;
    return () => identity.getState().forgetRoom(roomId);
  }, [gone, roomId, identity]);

  // Keep the lobby roster: the fallback for team players when an older API sends none in game views.
  const lobby = snapshot?.view.phase === "lobby" ? snapshot.view : null;
  useEffect(() => {
    if (lobby) saveRoster(roomId, lobby.members);
  }, [lobby, roomId]);

  const [closing, setClosing] = useState<"idle" | "confirm" | "busy">("idle");
  const [closeError, setCloseError] = useState<string | null>(null);
  useEffect(() => {
    if (closing !== "confirm") return;
    const timer = setTimeout(() => setClosing("idle"), 5000);
    return () => clearTimeout(timer);
  }, [closing]);

  async function closeThisRoom() {
    if (!snapshot) return;
    if (closing === "idle") {
      setClosing("confirm");
      return;
    }
    setClosing("busy");
    setCloseError(null);
    const signature = `close:${snapshot.source.roomVersion}`;
    try {
      await closeRoom(roomId, auth, intents.key(signature), snapshot.source.roomVersion);
      intents.done(signature);
      identity.getState().forgetRoom(roomId);
      router.replace("/");
    } catch (cause) {
      setCloseError(messageOf(cause));
      setClosing("idle");
    }
  }

  const actions = isHost && snapshot ? (
    <Button variant="dark" size="sm" onClick={closeThisRoom} disabled={closing === "busy"} className="shrink-0">
      {closing === "confirm" ? "متأكد؟ اقفل الغرفة" : "إنهاء الغرفة"}
    </Button>
  ) : null;

  const shell = (children: React.ReactNode, wide?: boolean, heading?: string) => (
    <RoomShell covers={covers} status={status} actions={actions} wide={wide} heading={heading}>
      {closeError && <ErrorBanner className="mb-3">{closeError}</ErrorBanner>}
      {children}
    </RoomShell>
  );

  if (status === "replaced")
    return shell(
      <StatusCard title="الغرفة اتفتحت على جهاز تاني" text="بنوقف العرض هنا عشان مكانك مفتوح في مكان تاني.">
        <Button onClick={() => window.location.reload()}>افتحها هنا تاني</Button>
      </StatusCard>,
    );
  if (status === "control-lost")
    return shell(
      <StatusCard title="جهاز تاني خد التحكم" text="الغرفة بتتدار من جهاز تاني دلوقتي.">
        <Button onClick={() => identity.getState().forgetRoom(roomId)}>خد التحكم تاني</Button>
      </StatusCard>,
    );
  if (status === "revoked")
    return shell(
      <StatusCard title="المضيف شالك من الغرفة" text="تقدر تدخل بكود جديد لو عايز.">
        <Button asChild>
          <Link href="/join">ادخل بكود</Link>
        </Button>
      </StatusCard>,
    );
  if (status === "closed")
    return shell(
      <StatusCard title="الغرفة اتقفلت" text="المضيف أنهى الغرفة.">
        <Button asChild>
          <Link href="/">الرئيسية</Link>
        </Button>
      </StatusCard>,
    );
  if (status === "failed")
    return shell(
      <StatusCard title="مش قادرين نفتح الغرفة" text={error?.message ?? messageOf(null)}>
        <Button onClick={() => window.location.reload()}>جرّب تاني</Button>
        <Button asChild variant="outline">
          <Link href="/">الرئيسية</Link>
        </Button>
      </StatusCard>,
    );
  if (!snapshot) return shell(<StatusCard title="بنفتح الغرفة…" busy />);

  const { view, source } = snapshot;
  if (view.phase === "lobby") {
    return shell(
      isHost ? (
        <HostLobby roomId={roomId} view={view as LobbyView} roomVersion={source.roomVersion} auth={auth} categories={categories} connected={channel.connected} onRefresh={channel.refresh} />
      ) : membershipId ? (
        <PlayerLobby roomId={roomId} view={view as LobbyView} auth={auth} membershipId={membershipId} connected={channel.connected} onRefresh={channel.refresh} />
      ) : null,
      false,
      isHost ? "غرفة اللعب" : undefined,
    );
  }
  return shell(<GameScreen channel={channel} roomId={roomId} auth={auth} isHost={isHost} categories={categories} />, true, view.phase === "board" ? "لوحة اللعبة" : undefined);
}

