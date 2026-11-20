"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { listAnnouncements } from "@/lib/api/endpoints";
import type { Announcement } from "@/lib/api/types";
import { linkKind } from "@/lib/safe-link";

const DISMISSED_KEY = "sahsah.announcements.dismissed.v1";
const REMEMBERED = 20;

function readDismissed(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id: string) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed().filter((known) => known !== id), id].slice(-REMEMBERED)));
  } catch {
    // Storage is blocked: the banner is gone for this visit only.
  }
}

/** The newest live announcement, dismissible. Nothing is shown while loading, on a failure, or after it was dismissed. */
export default function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listAnnouncements(controller.signal)
      .then(({ items }) => {
        const newest = items[0];
        if (newest && !readDismissed().includes(newest.id)) setAnnouncement(newest);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (!announcement) return null;
  const kind = linkKind(announcement.linkUrl);
  const dismiss = () => {
    rememberDismissed(announcement.id);
    setAnnouncement(null);
  };
  return (
    <aside aria-label="إعلان" className="relative z-30 border-b-[3px] border-ink bg-sun text-ink">
      <div className="mx-auto flex max-w-[1200px] items-start gap-3 px-4 py-2.5 sm:px-8 lg:px-12">
        <div className="min-w-0 flex-1 text-base font-medium leading-snug">
          <strong className="font-heading text-xl">{announcement.title}</strong>
          <span className="mx-2 hidden sm:inline" aria-hidden>
            ·
          </span>
          <span className="block sm:inline">{announcement.body}</span>
          {kind && announcement.linkLabel && announcement.linkUrl && (
            <>
              {" "}
              {kind === "internal" ? (
                <Link href={announcement.linkUrl} className="font-bold underline decoration-2 underline-offset-4">
                  {announcement.linkLabel}
                </Link>
              ) : (
                <a href={announcement.linkUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline decoration-2 underline-offset-4">
                  {announcement.linkLabel}
                </a>
              )}
            </>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="إخفاء الإعلان" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-ink/10">
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
