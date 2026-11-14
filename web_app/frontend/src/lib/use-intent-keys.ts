"use client";

import { useMemo, useRef } from "react";
import { newOperationId } from "@/lib/ids";

/**
 * One Idempotency-Key per intent. The signature names the intent (what is being asked, against which
 * versions); the same signature keeps the same key until `done`, so a retry after a lost response is the
 * same operation, while a changed intent gets a new key.
 */
export function useIntentKeys() {
  const keys = useRef(new Map<string, string>());
  return useMemo(
    () => ({
      key(signature: string): string {
        let key = keys.current.get(signature);
        if (!key) {
          key = newOperationId();
          keys.current.set(signature, key);
        }
        return key;
      },
      done(signature: string): void {
        keys.current.delete(signature);
      },
    }),
    [],
  );
}
