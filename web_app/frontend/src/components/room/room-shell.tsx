"use client";

import Link from "next/link";
import Logo from "@/components/brand/logo";
import PosterWall from "@/components/room/poster-wall";
import type { ChannelStatus } from "@/lib/realtime/use-room-channel";
import { cn } from "@/lib/utils";

type RoomShellProps = {
  covers: string[];
  status?: ChannelStatus;
  /** Right-hand slot of the header (start side in RTL). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Let the content use the full width, as the board does on a TV. */
  wide?: boolean;
  /** Visually hidden page heading, for screens that have no visible one. */
  heading?: string;
};

/** The room frame: poster wall behind a red header bar with the logo, the connection light and actions. */
export default function RoomShell({ covers, status, actions, children, wide, heading }: RoomShellProps) {
  return (
    <div className="relative min-h-dvh">
      <PosterWall covers={covers} />
      <div className={cn("mx-auto flex min-h-dvh flex-col px-3 pb-6 pt-3 sm:px-5", wide ? "max-w-[1760px]" : "max-w-[1200px]")}>
        <header className="relative z-10 mb-4 flex items-center justify-between gap-3 rounded-2xl border-4 border-ink bg-press px-3 py-2 text-white shadow-[0_6px_0_var(--color-ink)] sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">{actions}</div>
          <Link href="/" aria-label="صحصح، الصفحة الرئيسية" className="shrink-0 rounded-lg">
            <Logo variant="retro" className="-my-3 w-14 -rotate-3 sm:w-16" />
          </Link>
          <div className="flex min-w-0 flex-1 justify-end">
            <ConnectionLight status={status} />
          </div>
        </header>
        <main className="relative z-10 flex flex-1 flex-col">
          {heading && (
            <h1 id="page-heading" tabIndex={-1} className="sr-only focus:outline-none">
              {heading}
            </h1>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function ConnectionLight({ status }: { status?: ChannelStatus }) {
  if (!status || status === "connecting") return null;
  const live = status === "live";
  const label = live ? "متصل" : status === "reconnecting" ? "بنعيد الاتصال…" : null;
  if (!label) return null;
  return (
    <p role="status" className="flex items-center gap-2 rounded-full bg-ink/85 px-3 py-1 text-sm font-semibold text-cream">
      <span aria-hidden className={cn("size-2.5 rounded-full", live ? "bg-green" : "bg-amber")} />
      {label}
    </p>
  );
}
