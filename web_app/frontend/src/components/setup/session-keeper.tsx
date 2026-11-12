"use client";

import { useEffect } from "react";
import { previewSession } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { isIdentityRejected } from "@/lib/api/problems";
import { useIdentity, useIdentityApi } from "@/providers/game-store-provider";

const RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Keeps the host's 30-day preview credential fresh: sending the held credential with the display name
 * renews it (ADR 0017). A credential the API no longer accepts is dropped, so the next "العب!" asks again.
 */
export default function SessionKeeper() {
  const hydrated = useIdentity((s) => s.hydrated);
  const host = useIdentity((s) => s.host);
  const identity = useIdentityApi();

  useEffect(() => {
    if (!hydrated || !host) return;
    if (new Date(host.expiresAt).getTime() - Date.now() > RENEW_WITHIN_MS) return;
    let cancelled = false;
    previewSession({ credential: host.credential, displayName: host.displayName })
      .then((session) => {
        if (cancelled) return;
        identity.getState().setHost({
          credential: session.credential,
          expiresAt: session.expiresAt,
          accountId: session.accountId,
          displayName: session.displayName,
        });
      })
      .catch((error: unknown) => {
        if (cancelled || !(error instanceof ApiError)) return;
        if (isIdentityRejected(error.code)) identity.getState().setHost(null);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, host, identity]);

  return null;
}
