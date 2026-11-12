"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Auth } from "@/lib/api/client";
import { mediaAccess } from "@/lib/api/endpoints";
import type { Id, MediaLink, MediaRef } from "@/lib/api/types";

export function mediaKey(ref: MediaRef): string {
  return `${ref.kind}:${ref.boardPosition}:${ref.questionPosition}:${ref.role}:${ref.variantNumber}`;
}

export type MediaLinks = {
  /** Signed URL by `mediaKey`. Never log or persist these. */
  urls: ReadonlyMap<string, string>;
  /** Links could not be issued after the bounded retries. */
  failed: boolean;
  /** Ask again, e.g. after a playback error on an expired link. */
  retry: () => void;
};

const RENEW_EARLY_MS = 60000;
const MIN_WAIT_MS = 5000;
const RETRIES = 2;

/**
 * Short-lived signed links for the media of the current view. They are requested when the view needs them,
 * renewed a minute before they expire, and asked for again when the set changes. A failed request is retried
 * twice, then surfaced so the screen can offer a retry. The links are held in memory only.
 */
export function useMediaLinks(gameId: Id | null, auth: Auth, refs: MediaRef[]): MediaLinks {
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const authRef = useRef(auth);
  const refsRef = useRef(refs);
  useEffect(() => {
    authRef.current = auth;
    refsRef.current = refs;
  });
  // The refs are rebuilt on every render; their keys say whether the set really changed.
  const setKey = refs.map(mediaKey).sort().join("|");

  useEffect(() => {
    const wanted = [...new Map(refsRef.current.map((ref) => [mediaKey(ref), ref])).values()];
    if (!gameId || wanted.length === 0) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    const fetchLinks = () => {
      mediaAccess(gameId, authRef.current, wanted, controller.signal)
        .then(({ links, serverTime }) => {
          failures = 0;
          setFailed(false);
          setUrls(new Map(links.map((link: MediaLink) => [mediaKey(link.ref), link.url])));
          const soonest = Math.min(...links.map((link) => Date.parse(link.expiresAt)));
          const wait = Number.isFinite(soonest) ? soonest - Date.parse(serverTime) - RENEW_EARLY_MS : 120000;
          timer = setTimeout(fetchLinks, Math.max(MIN_WAIT_MS, wait));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          failures += 1;
          if (failures > RETRIES) {
            setFailed(true);
            return;
          }
          timer = setTimeout(fetchLinks, 1000 * failures);
        });
    };
    fetchLinks();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [gameId, setKey, attempt]);

  return useMemo(() => ({ urls, failed, retry: () => setAttempt((n) => n + 1) }), [urls, failed]);
}
