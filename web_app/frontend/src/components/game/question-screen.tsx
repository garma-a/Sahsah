"use client";

import AwardPanel from "@/components/game/award-panel";
import HostBar, { type QuestionAction } from "@/components/game/host-bar";
import MediaImage from "@/components/game/media-image";
import TimerDial from "@/components/game/timer-dial";
import type { Tone } from "@/components/brand/tones";
import ErrorBanner from "@/components/ui/error-banner";
import type { Auth } from "@/lib/api/client";
import type { ImageRef, MediaRef, QuestionContent, QuestionView, TeamNumber } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { useMediaLinks, mediaKey } from "@/lib/use-media-links";
import { useRemainingMs } from "@/lib/use-remaining-ms";
import { cn } from "@/lib/utils";

type QuestionScreenProps = {
  view: QuestionView;
  /** Unknown when this device opened the room mid-question: the question view itself names no category. */
  categoryName?: string;
  tone: Tone;
  /** This device runs the game: it gets the controls (and, in later formats, the audio). */
  isHost: boolean;
  gameId: string;
  auth: Auth;
  clockOffsetMs: number;
  /** Name of the command in flight, if any. */
  pending: string | null;
  problem: string | null;
  onAct: (name: QuestionAction) => void;
  onResolve: (winner: TeamNumber | null, points: number | undefined) => void;
};

function promptOf(question: QuestionContent): string {
  return "prompt" in question ? question.prompt : question.instruction;
}

function imageOf(question: QuestionContent): ImageRef | undefined {
  return "image" in question ? question.image : undefined;
}

/**
 * The open question and, after the reveal, its answer. Viewers and the host read the same screen; only the
 * host also gets the controls bar (question) or the award step (answer). The projection decides what each
 * audience may see: this component never asks for what the view does not carry.
 */
export default function QuestionScreen({
  view,
  categoryName,
  tone,
  isHost,
  gameId,
  auth,
  clockOffsetMs,
  pending,
  problem,
  onAct,
  onResolve,
}: QuestionScreenProps) {
  const answering = view.phase === "question";
  const remainingMs = useRemainingMs(view.timer, clockOffsetMs);
  const promptImage = imageOf(view.question);
  const answerImage = view.answer?.image;

  // Pictures come over short-lived signed links, asked for only while this view carries them.
  const refs: MediaRef[] = [promptImage, answerImage].filter((ref): ref is ImageRef => ref !== undefined);
  const media = useMediaLinks(gameId, auth, refs);
  const shown = answerImage ?? promptImage;
  const controls = view.controls ?? [];
  const stages = "stageSuggestions" in view.question ? view.question.stageSuggestions : undefined;

  return (
    <section aria-labelledby="question-title" className="flex flex-1 flex-col gap-4">
      <div className="paper-card flex flex-1 flex-col rounded-[2rem] border-4 border-ink p-4 shadow-[0_12px_0_var(--color-ink)] sm:p-6 lg:px-10 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {categoryName && <p className={cn("max-w-full truncate rounded-xl border-[3px] border-ink px-4 py-1 font-heading text-2xl leading-tight lg:text-3xl", tone.ribbon)}>{categoryName}</p>}
            <p className="tabular flex items-center gap-2 rounded-full border-[3px] border-ink bg-sun px-4 py-1 font-heading text-2xl leading-tight shadow-[0_3px_0_var(--color-ink)] lg:text-3xl">
              <span className="sr-only">قيمة السؤال</span>
              {formatNumber(view.suggestedPoints)}
              <span className="text-base font-bold">نقطة</span>
              {view.suggestedPoints < view.basePoints && (
                <span className="text-base font-bold text-ink/70">
                  <span className="sr-only">من</span> {formatNumber(view.basePoints)}
                </span>
              )}
            </p>
          </div>
          {answering && <TimerDial state={view.timer.state} remainingMs={remainingMs} />}
        </header>

        <div className={cn("flex flex-1 items-center gap-8 py-6 lg:py-8", shown ? "flex-col lg:flex-row" : "flex-col justify-center")}>
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-6 text-center">
            <h1
              id="question-title"
              className={cn(
                "text-balance font-heading",
                answering
                  ? promptOf(view.question).length <= 40
                    ? "text-5xl leading-[1.4] sm:text-6xl lg:text-8xl lg:leading-[1.3]"
                    : "text-4xl leading-[1.4] sm:text-5xl lg:text-6xl lg:leading-[1.35]"
                  : "text-2xl leading-snug text-charcoal/70 sm:text-3xl lg:text-4xl",
              )}
            >
              {promptOf(view.question)}
            </h1>
            {view.answer && (
              <div
                className="w-full max-w-4xl origin-top animate-[reveal_0.65s_ease-out_both] rounded-[1.6rem] border-4 border-ink bg-sun px-6 py-5 shadow-[0_8px_0_var(--color-ink)]"
                role="status"
              >
                <p className="font-heading text-xl leading-none text-ink/70">الإجابة</p>
                <p className="mt-2 text-balance font-heading text-5xl leading-[1.35] lg:text-7xl">{view.answer.text}</p>
              </div>
            )}
          </div>
          {shown && (
            <MediaImage
              url={media.urls.get(mediaKey(shown))}
              failed={media.failed}
              onRetry={media.retry}
              alt={answerImage ? "صورة الإجابة" : "صورة السؤال"}
              className="w-full max-w-md shrink-0 lg:w-[26rem] lg:rotate-[-2deg]"
            />
          )}
        </div>
      </div>

      {problem && <ErrorBanner>{problem}</ErrorBanner>}
      {isHost && view.audience === "host" ? (
        answering ? (
          <HostBar controls={controls} pending={pending} onAct={onAct} />
        ) : (
          <AwardPanel
            key={`${view.boardPosition}:${view.questionPosition}`}
            teams={view.teams}
            basePoints={view.basePoints}
            suggestedPoints={view.suggestedPoints}
            stageSuggestions={stages}
            busy={pending !== null}
            canReturn={controls.includes("return_to_board")}
            onResolve={onResolve}
            onReturn={() => onAct("return_to_board")}
          />
        )
      ) : (
        !answering && <p className="text-center font-heading text-2xl text-cream">المضيف بيختار مين كسب السؤال…</p>
      )}
    </section>
  );
}
