"use client";

import AwardPanel from "@/components/game/award-panel";
import HintStages from "@/components/game/hint-stages";
import HostBar, { type QuestionAction } from "@/components/game/host-bar";
import MediaImage from "@/components/game/media-image";
import { HostSound, ViewerSound } from "@/components/game/sound-card";
import { QRCodeSVG } from "qrcode.react";
import TimerDial from "@/components/game/timer-dial";
import type { Tone } from "@/components/brand/tones";
import ErrorBanner from "@/components/ui/error-banner";
import type { Auth } from "@/lib/api/client";
import type { AudioRef, ImageRef, MediaRef, Playback, QuestionContent, QuestionView, TeamNumber } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { mediaKey, useMediaLinks } from "@/lib/use-media-links";
import { cn } from "@/lib/utils";

type QuestionScreenProps = {
  view: QuestionView;
  /** Unknown when this device opened the room mid-question: the question view itself names no category. */
  categoryName?: string;
  tone: Tone;
  /** This device runs the game: it gets the controls and the audio. */
  isHost: boolean;
  gameId: string;
  auth: Auth;
  clockOffsetMs: number;
  /** The live connection is up (the host clip pauses when it is not). */
  live: boolean;
  /** The host clip's mirrored play state, for viewers. */
  playback: Playback | null;
  /** Host only: an actual play, pause, seek or end of a clip. */
  onPlayback: (media: AudioRef, playing: boolean, positionMs: number) => void;
  /** Name of the command in flight, if any. */
  pending: string | null;
  problem: string | null;
  onAct: (name: QuestionAction) => void;
  onResolve: (winner: TeamNumber | null, points: number | undefined) => void;
  /** The scores, shown at the foot of the side rail. */
  side?: React.ReactNode;
};

function promptOf(question: QuestionContent): string {
  return "prompt" in question ? question.prompt : question.instruction;
}

function imageOf(question: QuestionContent): ImageRef | undefined {
  return "image" in question ? question.image : undefined;
}

/** Memory has two quiet moments before the clock runs: the instruction, and the picture while it is shown. */
function clockWaits(question: QuestionContent): boolean {
  return question.format === "IMAGE_MEMORY" && (question.memoryPhase === "ready" || question.memoryPhase === "viewing_first");
}

function soundCaption(question: QuestionContent, forwardClip: boolean): string {
  if (question.format === "AUDIO_REVERSE") return forwardClip ? "المقطع الأصلي" : "المقطع معكوس";
  if (question.format === "AUDIO_VOICE") return "مين صاحب الصوت؟";
  return "اسمع المقطع";
}

/**
 * The open question and, after the reveal, its answer. Viewers and the host read the same screen; only the
 * host also gets the controls bar (question) or the award step (answer), and the sound. The projection
 * decides what each audience may see: this component never asks for what the view does not carry.
 */
export default function QuestionScreen({
  view,
  categoryName,
  tone,
  isHost,
  gameId,
  auth,
  clockOffsetMs,
  live,
  playback,
  onPlayback,
  pending,
  problem,
  onAct,
  onResolve,
  side,
}: QuestionScreenProps) {
  const answering = view.phase === "question";
  const hostView = isHost && view.audience === "host";
  const { question, answer } = view;
  const promptImage = imageOf(question);
  const answerImage = answer?.image;

  // The clip this device may play: the question's, or the forward answer clip after the reveal. Viewers get none.
  const audio: AudioRef | undefined = hostView
    ? (answer?.forwardAudio ?? ("audio" in question ? question.audio : undefined))
    : undefined;
  const hasSound = "durationMs" in question;
  // Only the host, and only after the reveal, has the forward (original) clip of a reversed question.
  const forwardClip = answer?.forwardAudio !== undefined && audio === answer.forwardAudio;

  // Pictures and the host's clip come over short-lived signed links, asked for only while this view carries them.
  // After the reveal only the picture on screen is needed (the answer image, else the question image).
  const shown = answerImage ?? promptImage;
  // A clue question keeps its picture and adds the latest clue card (each card repeats the earlier clues).
  const clue = answering && question.format === "IMAGE_CLUES" ? question.clue : undefined;
  const cardUrl = answering && question.format === "CHARADES" ? question.cardUrl : undefined;
  const refs: MediaRef[] = [shown, clue, audio].filter((ref): ref is MediaRef => ref !== undefined);
  const media = useMediaLinks(gameId, auth, refs);
  const controls = view.controls ?? [];
  const stages = "stageSuggestions" in question ? question : undefined;
  const hint = question.format === "AUDIO_VOICE" ? question.hint : undefined;
  const swatch = answer?.colorHex && /^#[0-9a-f]{3,8}$/i.test(answer.colorHex) ? answer.colorHex : undefined;
  const prompt = promptOf(question);
  const short = prompt.length <= 40 && !shown && !hasSound && !cardUrl;

  return (
    <section aria-labelledby="question-title" className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row">
      <div className="paper-card flex flex-1 flex-col rounded-[2rem] border-4 border-ink p-4 shadow-[0_10px_0_var(--color-ink)] sm:px-6 lg:px-8 lg:py-5 short:rounded-2xl short:px-4 short:py-2 short:shadow-[0_6px_0_var(--color-ink)]">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {categoryName && (
              <p className={cn("max-w-full truncate rounded-xl border-[3px] border-ink px-4 py-1 font-heading text-2xl leading-tight lg:text-3xl short:text-xl", tone.ribbon)}>{categoryName}</p>
            )}
            <p className="tabular flex items-center gap-2 rounded-full border-[3px] border-ink bg-sun px-4 py-1 font-heading text-2xl leading-tight shadow-[0_3px_0_var(--color-ink)] lg:text-3xl short:text-xl">
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
          {answering && (
            // On a short screen (a phone held sideways) the clock sits here instead of in the rail. Only one copy is ever displayed, so assistive tech sees one timer.
            <div className="hidden short:block">
              <TimerDial timer={view.timer} clockOffsetMs={clockOffsetMs} note={clockWaits(question) ? "الوقت بيبدأ لما الصورة تختفي" : undefined} />
            </div>
          )}
        </header>

        {/* The question reads across the top in one or two wide lines; a QR card or sound sits under it. A picture sits
            under it too, except on a phone held sideways, where it stands beside a wide text column so it stays big. */}
        <div className={cn("flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-4 short:gap-2 short:py-1.5", shown && "short:flex-row short:gap-4")}>
          <div className={cn("flex w-full min-w-0 max-w-5xl flex-col items-center gap-4 text-center short:gap-2", shown && "short:flex-1")}>
            <h1
              id="question-title"
              tabIndex={-1}
              className={cn(
                "text-balance break-words font-heading focus:outline-none",
                answering
                  ? short
                    ? "text-5xl leading-[1.35] lg:text-7xl short:text-4xl"
                    : "text-3xl leading-[1.35] lg:text-5xl short:text-2xl"
                  : "text-2xl leading-snug text-charcoal/70 lg:text-3xl short:text-xl",
                // Beside a picture on a phone, smaller type keeps the question to two wide lines.
                shown && "short:text-lg short:leading-snug",
              )}
            >
              {prompt}
            </h1>
            {hint && answering && <p className="rounded-full border-[3px] border-ink bg-white px-5 py-1 font-heading text-2xl">تلميح: {hint}</p>}
            {stages && answering && <HintStages stageIndex={stages.stageIndex} suggestions={stages.stageSuggestions} />}
            {answer && (
              <div
                className="w-full max-w-4xl origin-top animate-[reveal_0.65s_ease-out_both] rounded-[1.6rem] border-4 border-ink bg-sun px-6 py-4 shadow-[0_8px_0_var(--color-ink)] short:rounded-2xl short:py-2"
                role="status"
              >
                <p className="font-heading text-xl leading-none text-ink/70">الإجابة</p>
                <p className="mt-2 flex items-center justify-center gap-4 text-balance font-heading text-4xl leading-[1.3] lg:text-6xl short:text-3xl">
                  {swatch && <span aria-hidden className="size-14 shrink-0 rounded-full border-4 border-ink lg:size-20" style={{ backgroundColor: swatch }} />}
                  {answer.text}
                </p>
              </div>
            )}
          </div>
          {shown && (
            <div
              className={cn(
                "min-h-0 shrink short:max-w-[45%]",
                clue ? "grid w-full max-w-3xl grid-cols-[2fr_3fr] items-center gap-4" : "flex max-w-full flex-col items-center",
              )}
            >
              <MediaImage
                url={media.urls.get(mediaKey(shown))}
                failed={media.failed}
                onRetry={media.retry}
                alt={answerImage ? "صورة الإجابة" : "صورة السؤال"}
                className={cn(clue ? "w-full" : "w-fit max-w-full", !clue && "lg:rotate-[-1.5deg]")}
              />
              {clue && (
                <MediaImage
                  url={media.urls.get(mediaKey(clue))}
                  failed={media.failed}
                  onRetry={media.retry}
                  alt="كارت التلميحات"
                  className="w-full lg:rotate-[1.5deg]"
                />
              )}
            </div>
          )}
          {cardUrl && (
            <div className="flex max-w-xl shrink-0 items-center gap-5 rounded-[1.6rem] border-4 border-ink bg-white p-4 shadow-[0_8px_0_var(--color-ink)] short:gap-3 short:rounded-2xl short:p-2">
              <div className="w-40 shrink-0 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full lg:w-44 short:w-24">
                <QRCodeSVG value={cardUrl} size={176} level="M" marginSize={1} fgColor="#1d2321" bgColor="#ffffff" role="img" title="كود كارت التمثيل" />
              </div>
              <div className="flex flex-col items-center gap-3 short:gap-2">
              <p className="text-center font-heading text-2xl leading-snug text-balance short:text-base">اللي هيمثّل يمسح الكود ويشوف الكارت لوحده</p>
              {hostView && (
                <a
                  href={cardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border-[3px] border-ink bg-sun px-5 py-1 font-heading text-xl shadow-[0_3px_0_var(--color-ink)] hover:bg-cream short:px-3 short:text-base"
                >
                  افتح الكارت هنا
                </a>
              )}
              </div>
            </div>
          )}
          {hasSound &&
            (audio ? (
              <HostSound
                key={`${view.phase}:${mediaKey(audio)}`}
                url={media.urls.get(mediaKey(audio))}
                failed={media.failed}
                onRetry={media.retry}
                live={live}
                durationMs={(question as { durationMs: number }).durationMs}
                caption={soundCaption(question, forwardClip)}
                onReport={(playing, positionMs) => onPlayback(audio, playing, positionMs)}
              />
            ) : (
              <ViewerSound
                durationMs={(question as { durationMs: number }).durationMs}
                caption={soundCaption(question, forwardClip)}
                playback={playback}
                clockOffsetMs={clockOffsetMs}
              />
            ))}
        </div>
      </div>

      {/* The side rail: the clock, the host's controls or award step, and the scores. */}
      <aside className="flex shrink-0 flex-col gap-3 sm:w-72 lg:w-80 short:w-60 short:gap-2">
      {answering && (
        <div className="flex justify-center rounded-[1.4rem] border-4 border-ink bg-cream p-2 shadow-[0_6px_0_var(--color-ink)] short:hidden">
          <TimerDial timer={view.timer} clockOffsetMs={clockOffsetMs} note={clockWaits(question) ? "الوقت بيبدأ لما الصورة تختفي" : undefined} />
        </div>
      )}
      {problem && <ErrorBanner>{problem}</ErrorBanner>}
      {hostView ? (
        answering ? (
          <HostBar controls={controls} pending={pending} onAct={onAct} />
        ) : (
          <AwardPanel
            key={`${view.boardPosition}:${view.questionPosition}`}
            teams={view.teams}
            basePoints={view.basePoints}
            suggestedPoints={view.suggestedPoints}
            stageSuggestions={stages?.stageSuggestions}
            busy={pending !== null}
            canReturn={controls.includes("return_to_board")}
            onResolve={onResolve}
            onReturn={() => onAct("return_to_board")}
          />
        )
      ) : (
        !answering && <p className="text-center font-heading text-2xl text-cream">المضيف بيختار مين كسب السؤال…</p>
      )}
      <div className={cn("mt-auto", !answering && hostView && "short:hidden")}>{side}</div>
      </aside>
    </section>
  );
}
