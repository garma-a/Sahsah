"use client";

import { useCallback, useEffect, useState } from "react";
import JoinShell from "@/components/join/join-shell";
import MediaImage from "@/components/game/media-image";
import ErrorBanner from "@/components/ui/error-banner";
import { charadesCard } from "@/lib/api/endpoints";
import { asApiError } from "@/lib/api/errors";
import type { CharadesCard } from "@/lib/api/types";

type State = { status: "loading" } | { status: "closed" } | { status: "missing" } | { status: "error" } | { status: "ready"; card: CharadesCard };

/**
 * The private charades card on whoever scanned the code (ADR 0019). It only opens while the question is
 * on the board, so a closed or answered question explains that instead of showing the card.
 */
export default function CharadesCardView({ gameId, board, question, token }: { gameId: string; board: number; question: number; token: string }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(
    (signal?: AbortSignal) =>
      charadesCard(gameId, board, question, token, signal)
        .then((card) => setState({ status: "ready", card }))
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          const status = asApiError(error).status;
          setState({ status: status === 409 || status === 410 ? "closed" : status === 404 || status === 400 ? "missing" : "error" });
        }),
    [gameId, board, question, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <JoinShell>
      <h1 className="text-center font-heading text-3xl leading-snug">مثّل اللي في الكارت</h1>
      <p className="mt-2 text-center text-lg font-semibold text-charcoal/80">من غير ولا كلمة! متورّيش الكارت لحد.</p>
      <div className="mt-5">
        {state.status === "loading" && <MediaImage alt="كارت التمثيل" />}
        {state.status === "ready" && (
          <MediaImage url={state.card.url} alt="كارت التمثيل" onRetry={() => void load()} />
        )}
        {state.status === "closed" && <ErrorBanner>السؤال ده اتقفل أو الإجابة ظهرت خلاص.</ErrorBanner>}
        {state.status === "missing" && <ErrorBanner>الكود ده مش شغال. امسح الكود اللي على الشاشة تاني.</ErrorBanner>}
        {state.status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <ErrorBanner>مش قادرين نجيب الكارت دلوقتي.</ErrorBanner>
            <button type="button" onClick={() => void load()} className="rounded-full border-[3px] border-ink bg-cream px-5 py-1 font-heading text-xl hover:bg-sun">
              جرّب تاني
            </button>
          </div>
        )}
      </div>
    </JoinShell>
  );
}
