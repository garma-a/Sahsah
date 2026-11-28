"use client";

import { useEffect, useState } from "react";
import { getSiteSettings } from "@/lib/api/endpoints";
import type { SiteSettings } from "@/lib/api/types";

let shared: Promise<SiteSettings> | undefined;

/** The footer's settings: one request per page load however many components ask. A failure leaves the footer with its fixed links. */
export function useSiteSettings(): SiteSettings | null {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    shared ??= getSiteSettings().catch((error: unknown) => {
      shared = undefined;
      throw error;
    });
    shared.then((value) => !cancelled && setSettings(value)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return settings;
}
