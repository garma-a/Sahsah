"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Board from "@/components/room/board";
import HostLobby from "@/components/room/host-lobby";
import { QuestionHolding, ResultHolding } from "@/components/room/holding-panel";
import PlayerLobby from "@/components/room/player-lobby";
import RoomShell from "@/components/room/room-shell";
import Scoreboard from "@/components/room/scoreboard";
import Button from "@/components/ui/button";
import { ApiError, type Auth } from "@/lib/api/client";
import { closeRoom, executeCommand, getControlStatus, previewSession, takeControl } from "@/lib/api/endpoints";
import type { BoardView, Category, LobbyView, QuestionView } from "@/lib/api/types";
import { newSecret } from "@/lib/ids";
import { loadRoster, saveRoster } from "@/lib/roster";
import { useRoomChannel, type RoomChannel } from "@/lib/realtime/use-room-channel";
import { useCategories } from "@/lib/use-categories";
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
        <Centered>ثانية…</Centered>
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

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="paper-card m-auto rounded-3xl border-4 border-ink px-10 py-8 text-center font-heading text-4xl shadow-[0_8px_0_var(--color-ink)]">
      {children}
    </div>
  );
}

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="paper-card m-auto flex max-w-lg flex-col items-center gap-3 rounded-[2rem] border-4 border-ink p-8 text-center shadow-[0_10px_0_var(--color-ink)]">
      <h1 className="font-heading text-4xl">{title}</h1>
      <p className="text-lg font-medium">{text}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
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
      const status = await getControlStatus(roomId, account);
      const controlSecret = newSecret();
      const receipt = await takeControl(roomId, account, {
        expectedControllerGeneration: status.roomControllerGeneration,
        proposedControlSecret: controlSecret,
      });
      identity.getState().setHostRoom(roomId, {
        controlSecret,
        generation: receipt.controllerGeneration ?? status.roomControllerGeneration,
        membershipId: receipt.membershipId ?? "",
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "حصلت مشكلة. جرّب تاني.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <RoomShell covers={covers}>
      {signedIn ? (
        <Message title="الغرفة دي مفتوحة من جهاز تاني" text="لو دي غرفتك، كمّل منها هنا. الجهاز التاني هيفقد التحكم.">
          <Button onClick={claim} disabled={busy}>
            {busy ? "ثانية…" : "كمّل من هنا"}
          </Button>
          <Button asChild variant="outline">
            <Link href="/join">ادخل بكود</Link>
          </Button>
          {error && (
            <p role="alert" className="w-full rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-2 font-semibold text-[#8c1c15]">
              {error}
            </p>
          )}
        </Message>
      ) : (
        <Message title="إنت مش في الغرفة دي" text="ادخل الغرفة بالكود اللي مع المضيف.">
          <Button asChild>
            <Link href="/join">ادخل بكود</Link>
          </Button>
        </Message>
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

  // Once the room is gone for this browser, forget its proofs.
  useEffect(() => {
    if (status === "closed" || status === "revoked") identity.getState().forgetRoom(roomId);
    if (status === "failed" && error && [401, 403, 404, 410].includes(error.status) && !isHost) identity.getState().forgetRoom(roomId);
  }, [status, error, isHost, roomId, identity]);

  // Game views carry no player list, so remember the lobby's roster for the board.
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
    try {
      await closeRoom(roomId, auth, snapshot.source.roomVersion);
      identity.getState().forgetRoom(roomId);
      router.replace("/");
    } catch (cause) {
      setCloseError(cause instanceof ApiError ? cause.message : "حصلت مشكلة. جرّب تاني.");
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
      {closeError && (
        <p role="alert" className="mb-3 rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-2 font-semibold text-[#8c1c15]">
          {closeError}
        </p>
      )}
      {children}
    </RoomShell>
  );

  if (status === "replaced")
    return shell(<Message title="الغرفة اتفتحت على جهاز تاني" text="بنوقف العرض هنا عشان مكانك مفتوح في مكان تاني."><Button onClick={() => window.location.reload()}>افتحها هنا تاني</Button></Message>);
  if (status === "control-lost")
    return shell(<Message title="جهاز تاني خد التحكم" text="الغرفة بتتدار من جهاز تاني دلوقتي."><Button onClick={() => identity.getState().forgetRoom(roomId)}>خد التحكم تاني</Button></Message>);
  if (status === "revoked")
    return shell(<Message title="المضيف شالك من الغرفة" text="تقدر تدخل بكود جديد لو عايز."><Button asChild><Link href="/join">ادخل بكود</Link></Button></Message>);
  if (status === "closed")
    return shell(<Message title="الغرفة اتقفلت" text="المضيف أنهى الغرفة."><Button asChild><Link href="/">الرئيسية</Link></Button></Message>);
  if (!snapshot) {
    if (status === "failed")
      return shell(
        <Message title="مش قادرين نفتح الغرفة" text={error?.message ?? "حصلت مشكلة. جرّب تاني."}>
          <Button onClick={() => window.location.reload()}>جرّب تاني</Button>
          <Button asChild variant="outline">
            <Link href="/">الرئيسية</Link>
          </Button>
        </Message>,
      );
    return shell(<Centered>بنفتح الغرفة…</Centered>);
  }

  const { view, source } = snapshot;
  if (view.phase === "lobby") {
    return shell(
      isHost ? (
        <HostLobby roomId={roomId} view={view as LobbyView} roomVersion={source.roomVersion} auth={auth} categories={categories} connected={channel.connected} onRefresh={channel.refresh} />
      ) : (
        <PlayerLobby roomId={roomId} view={view as LobbyView} auth={auth} membershipId={membershipId ?? ""} connected={channel.connected} onRefresh={channel.refresh} />
      ),
      false,
      isHost ? "غرفة اللعب" : undefined,
    );
  }
  return shell(<GameScreen channel={channel} roomId={roomId} auth={auth} isHost={isHost} categories={categories} />, true, view.phase === "board" ? "لوحة اللعبة" : undefined);
}

/** What the live game shows: the board, the holding panel for an opened tile, or the result. */
function GameScreen({ channel, roomId, auth, isHost, categories }: { channel: RoomChannel; roomId: string; auth: Auth; isHost: boolean; categories: CategoryIndex }) {
  const { snapshot } = channel;
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The last board survives while a question is open, so the holding panel can name the category.
  const [lastBoard, setLastBoard] = useState<BoardView | null>(null);
  const [roster] = useState(() => loadRoster(roomId));
  const view = snapshot?.view;
  if (view?.phase === "board" && view !== lastBoard) setLastBoard(view);

  const gameId = snapshot && "gameId" in snapshot.source ? snapshot.source.gameId : null;
  const gameVersion = snapshot && "gameVersion" in snapshot.source ? snapshot.source.gameVersion : null;

  const run = useCallback(
    async (key: string, command: Parameters<typeof executeCommand>[2]) => {
      if (!gameId) return;
      setPending(key);
      setProblem(null);
      try {
        await executeCommand(gameId, auth, command);
        channel.refresh();
      } catch (cause) {
        setProblem(cause instanceof ApiError ? cause.message : "حصلت مشكلة. جرّب تاني.");
        if (cause instanceof ApiError && cause.status === 409) channel.refresh();
      } finally {
        setPending(null);
      }
    },
    [gameId, auth, channel],
  );

  if (!snapshot || !view || !gameVersion) return null;

  if (view.phase === "result") return <ResultHolding view={view} />;

  if (view.phase === "board") {
    return (
      <div className="flex flex-1 flex-col">
        {problem && (
          <p role="alert" className="mb-3 rounded-xl border-[3px] border-[#b3261e] bg-white px-4 py-2 font-semibold text-[#8c1c15]">
            {problem}
          </p>
        )}
        <Board
          view={view}
          categories={categories}
          canOpen={isHost && view.audience === "host"}
          pending={pending}
          onOpen={(boardPosition, questionPosition) =>
            run(`${boardPosition}:${questionPosition}`, { name: "open_question", expectedGameVersion: gameVersion, boardPosition, questionPosition })
          }
        />
        <Scoreboard teams={view.teams} members={roster} connected={channel.connected} />
      </div>
    );
  }

  const question = view as QuestionView;
  const column = lastBoard?.board.find((c) => c.boardPosition === question.boardPosition);
  return (
    <QuestionHolding
      view={question}
      categoryName={column?.name ?? "فئة"}
      isHost={isHost && question.audience === "host"}
      busy={pending !== null}
      error={problem}
      onReturn={() =>
        run("return", { name: "return_to_board", expectedGameVersion: gameVersion, boardPosition: question.boardPosition, questionPosition: question.questionPosition })
      }
    />
  );
}
