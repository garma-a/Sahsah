"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, LANGUAGE, REALTIME_URL, bearer, type Auth } from "@/lib/api/client";
import { getRoom } from "@/lib/api/endpoints";
import type { Id, Snapshot } from "@/lib/api/types";
import { isStale } from "./ordering";

export type ChannelStatus =
  | "connecting" // first load
  | "live"
  | "reconnecting" // the socket dropped; the last state stays on screen
  | "replaced" // the same seat opened on another tab or device
  | "control-lost" // another device took over hosting
  | "revoked" // removed from the room
  | "closed" // the room was closed
  | "failed"; // the room could not be loaded at all

export type RoomChannel = {
  snapshot: Snapshot | null;
  status: ChannelStatus;
  error: ApiError | null;
  /** Membership ids with a live socket (presence is a separate, disposable channel). */
  connected: ReadonlySet<Id>;
  /** Reload the current projection over HTTP, e.g. after a command or a conflict. */
  refresh: () => void;
};

type Frame = { event: string; data: Record<string, unknown> };

const FIRST_DELAY_MS = 500;
const MAX_DELAY_MS = 30000;

/**
 * The room's live view. It renders only what the server projects: an HTTP snapshot for first paint, then
 * complete states pushed over the native WebSocket. Frames from an old stream, duplicates and states older than
 * what is on screen are discarded; after a drop it reconnects with full jitter and resyncs from a fresh state.
 */
export function useRoomChannel(input: {
  roomId: Id;
  auth: Auth | null;
  /** Host only: returns a fresh bearer value when the API says the credential is about to expire. */
  renew?: () => Promise<string | null>;
}): RoomChannel {
  const { roomId, auth, renew } = input;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<ChannelStatus>("connecting");
  const [error, setError] = useState<ApiError | null>(null);
  const [connected, setConnected] = useState<ReadonlySet<Id>>(new Set());
  const [reloads, setReloads] = useState(0);

  const snapshotRef = useRef<Snapshot | null>(null);
  const authRef = useRef<Auth | null>(auth);
  const renewRef = useRef(renew);
  useEffect(() => {
    authRef.current = auth;
    renewRef.current = renew;
  });

  const accept = useCallback((next: Snapshot) => {
    if (isStale(snapshotRef.current, next.source)) return;
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  const hasAuth = auth !== null;

  // HTTP snapshot: first paint and every explicit refresh.
  useEffect(() => {
    const current = authRef.current;
    if (!current) return;
    const controller = new AbortController();
    getRoom(roomId, current, controller.signal)
      .then((next) => {
        accept(next);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        // A failed refresh keeps the last good state; only a room that never loaded is a hard failure.
        if (!snapshotRef.current) {
          setError(cause instanceof ApiError ? cause : new ApiError(0, "NETWORK"));
          setStatus("failed");
        }
      });
    return () => controller.abort();
  }, [roomId, hasAuth, reloads, accept]);

  // WebSocket with reconnect.
  useEffect(() => {
    if (!hasAuth) return;
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    let streamId: string | null = null;
    let lastSequence = BigInt(-1);

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
    };

    const stop = (next: ChannelStatus) => {
      stopped = true;
      clearTimer();
      setStatus(next);
      socket?.close(1000);
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      setStatus((current) => (current === "connecting" && !snapshotRef.current ? current : "reconnecting"));
      const ceiling = Math.min(MAX_DELAY_MS, FIRST_DELAY_MS * 2 ** attempt);
      const delay = Math.max(FIRST_DELAY_MS, Math.random() * ceiling);
      attempt += 1;
      clearTimer();
      timer = setTimeout(connect, delay);
    };

    const authorize = (): { authorization: string; controllerSecret?: string } | null => {
      const current = authRef.current;
      const authorization = current && bearer(current);
      if (!current || !authorization) return null;
      return current.kind === "host" ? { authorization, controllerSecret: current.controlSecret } : { authorization };
    };

    function handle(frame: Frame) {
      const data = frame.data;
      if (frame.event === "authenticated") {
        streamId = String(data.streamId);
        lastSequence = BigInt(String(data.sequence));
        attempt = 0;
        setStatus("live");
        return;
      }
      if (String(data.streamId) !== streamId) return; // frame from a replaced stream
      const sequence = BigInt(String(data.sequence));
      if (sequence <= lastSequence) return; // duplicate or reordered
      lastSequence = sequence;

      switch (frame.event) {
        case "state":
          accept({ source: data.source, serverTime: String(data.serverTime), language: LANGUAGE, view: data.view } as Snapshot);
          break;
        case "presence":
          setConnected(new Set((data.members as { membershipId: string; connected: boolean }[]).filter((m) => m.connected).map((m) => m.membershipId)));
          break;
        case "resync_required":
          socket?.send(JSON.stringify({ event: "resync", data: {} }));
          setReloads((n) => n + 1);
          break;
        case "credential_expiring":
          void renewRef.current?.().then((authorization) => {
            const secret = authRef.current?.kind === "host" ? authRef.current.controlSecret : undefined;
            if (authorization && socket?.readyState === WebSocket.OPEN)
              socket.send(JSON.stringify({ event: "reauthenticate", data: { authorization, ...(secret ? { controllerSecret: secret } : {}) } }));
          });
          break;
        case "stream_replaced":
          stop("replaced");
          break;
        case "control_revoked":
          stop("control-lost");
          break;
        case "membership_revoked":
          stop("revoked");
          break;
        case "room_closed":
          stop("closed");
          break;
        case "protocol_error":
          // The server closes the stream; the normal reconnect path starts a fresh one.
          break;
      }
    }

    function connect() {
      if (stopped) return;
      const credentials = authorize();
      if (!credentials) return;
      streamId = null;
      const ws = new WebSocket(REALTIME_URL);
      socket = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            event: "authenticate",
            data: { protocolVersion: 1, roomId, language: LANGUAGE, ...credentials },
          }),
        );
      };
      ws.onmessage = (message) => {
        try {
          handle(JSON.parse(String(message.data)) as Frame);
        } catch {
          // A frame this client cannot read is dropped; the next complete state replaces it.
        }
      };
      ws.onclose = () => {
        if (socket === ws) {
          socket = null;
          setConnected(new Set());
          scheduleReconnect();
        }
      };
      ws.onerror = () => ws.close();
    }

    const wake = () => {
      if (stopped || socket) return;
      attempt = 0;
      clearTimer();
      connect();
    };
    const onVisible = () => document.visibilityState === "visible" && wake();
    window.addEventListener("online", wake);
    document.addEventListener("visibilitychange", onVisible);

    connect();
    return () => {
      stopped = true;
      clearTimer();
      window.removeEventListener("online", wake);
      document.removeEventListener("visibilitychange", onVisible);
      if (socket) {
        const closing = socket;
        socket = null;
        closing.close(1000);
      }
    };
  }, [roomId, hasAuth, accept]);

  return { snapshot, status, error, connected, refresh };
}
