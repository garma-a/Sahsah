"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Logo from "@/components/brand/logo";
import Hero from "@/components/home/hero";
import SelectionBar from "@/components/home/selection-bar";
import { DisplayLedge, GutterDecor } from "@/components/home/shelf-decor";
import CinemaWall from "@/components/room/cinema-wall";
import Shelves from "@/components/home/shelves";
import SessionDialog from "@/components/setup/session-dialog";
import Button from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { currentOwnedRoom } from "@/lib/api/endpoints";
import { isIdentityRejected } from "@/lib/api/problems";
import type { Category, CurrentRoom } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { useCategories } from "@/lib/use-categories";
import { useDraft, useDraftApi, useIdentity, useIdentityApi } from "@/providers/game-store-provider";
import { BOARD_SIZE } from "@/stores/draft-store";

export default function HomeView() {
  const router = useRouter();
  const { state, retry } = useCategories();
  const selected = useDraft((s) => s.selected);
  const draft = useDraftApi();
  const identity = useIdentityApi();
  const host = useIdentity((s) => s.host);
  const identityReady = useIdentity((s) => s.hydrated);
  const shelvesRef = useRef<HTMLElement>(null);
  const [dialog, setDialog] = useState<"play" | "start" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openRoom, setOpenRoom] = useState<CurrentRoom | null>(null);

  const categories = state.status === "ready" ? state.categories : [];

  // Drop remembered picks that are no longer on the shelves (archived, or no playable pack).
  useEffect(() => {
    if (state.status !== "ready") return;
    const playable = new Set(state.categories.filter((c) => c.publishedPackCount > 0).map((c) => c.id));
    const current = draft.getState().selected;
    if (current.some((id) => !playable.has(id))) draft.setState({ selected: current.filter((id) => playable.has(id)) });
  }, [state, draft]);

  // A host who left a room open can pick it up again.
  const hostCredential = host?.credential;
  useEffect(() => {
    if (!identityReady || !hostCredential) return;
    let cancelled = false;
    currentOwnedRoom({ kind: "account", credential: hostCredential })
      .then((result) => !cancelled && setOpenRoom(result.room ?? null))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && isIdentityRejected(error.code)) identity.getState().setHost(null);
      });
    return () => {
      cancelled = true;
    };
  }, [identityReady, hostCredential, identity]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  const scrollToShelves = useCallback(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    shelvesRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    shelvesRef.current?.focus({ preventScroll: true });
  }, []);

  const play = useCallback(() => {
    if (!identity.getState().host) setDialog("play");
    else scrollToShelves();
  }, [identity, scrollToShelves]);

  const toggle = useCallback(
    (category: Category) => {
      const result = draft.getState().toggleCategory(category.id);
      if (result === "full") setNotice(`وصلت لـ ${formatDigits(BOARD_SIZE)} فئات. شيل واحدة الأول عشان تختار غيرها.`);
    },
    [draft],
  );

  const start = useCallback(() => {
    if (!identity.getState().host) setDialog("start");
    else router.push("/new");
  }, [identity, router]);

  const closeDialog = useCallback(() => setDialog(null), []);
  const dialogDone = useCallback(() => {
    const was = dialog;
    setDialog(null);
    if (was === "start") router.push("/new");
    else setTimeout(scrollToShelves, 50);
  }, [dialog, router, scrollToShelves]);

  return (
    <div className="min-h-dvh bg-cream">
      <Hero categories={categories} onPlay={play} />

      <main
        id="shelves"
        ref={shelvesRef}
        tabIndex={-1}
        className={cn("arch paper relative z-10 scroll-mt-4 outline-none lg:-mt-32", selected.length > 0 ? "pb-56 sm:pb-40" : "pb-24")}
      >
        <CinemaWall variant="home" shift={7} />
        <GutterDecor />
        <div className="absolute inset-x-0 top-0 z-20 hidden justify-center lg:flex">
          <Button onClick={play} size="xl" className="h-[4.75rem] min-w-[19rem] -translate-y-[58%] text-5xl ring-[5px] active:translate-y-[calc(-58%+3px)]">
            العب!
          </Button>
        </div>

        <div className="relative mx-auto max-w-[1200px] px-3 pt-10 sm:px-8 lg:px-12 lg:pt-28">
          {/* The shelves are the lobby's display case: crimson velvet behind brass trim in a walnut frame, screwed to the poster wall. */}
          <div className="relative rounded-xl bg-[#3b2414] bg-[url(/cinema/walnut.webp)] bg-[length:900px_auto] p-2.5 shadow-[0_0_0_2px_#140b06,0_30px_60px_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_235_200/0.25)] sm:p-4">
          <div className="relative rounded-[5px] bg-[#4d0f16] bg-[url(/cinema/velvet.webp)] bg-[length:1100px_auto] px-4 pt-8 pb-0 shadow-[inset_0_0_0_2px_rgb(201_150_60/0.7),inset_0_14px_40px_rgb(0_0_0/0.75),inset_0_0_140px_rgb(0_0_0/0.55)] sm:px-6 md:px-10 md:pt-12">
            {["start-2 top-2", "end-2 top-2", "start-2 bottom-2", "end-2 bottom-2"].map((spot) => (
              <span
                key={spot}
                aria-hidden
                className={`absolute ${spot} z-10 size-3 rounded-full border border-ink/60 bg-[radial-gradient(circle_at_35%_35%,#f3d68a,#a8782a_60%,#5a3d12)] after:absolute after:inset-x-0.5 after:top-1/2 after:h-px after:-rotate-45 after:bg-ink/60`}
              />
            ))}
            {openRoom && (
              <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-[3px] border-ink bg-sun px-5 py-4 shadow-[0_5px_0_var(--color-ink)]">
                <p className="font-heading text-2xl">عندك غرفة مفتوحة</p>
                <Button asChild variant="dark" size="sm">
                  <Link href={`/room/${openRoom.roomId}`}>كمّل الغرفة</Link>
                </Button>
              </div>
            )}
            <Shelves state={state} selected={selected} onToggle={toggle} onRetry={retry} />
            <DisplayLedge />
          </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 bg-night text-cream">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8 lg:px-12">
          <Logo variant="mono" className="w-14 text-sun" />
          <p className="font-heading text-2xl">ذكريات .. أسئلة .. متعة</p>
        </div>
      </footer>

      <SelectionBar count={selected.length} notice={notice} onStart={start} />
      <SessionDialog open={dialog !== null} onClose={closeDialog} onDone={dialogDone} />
    </div>
  );
}
