"use client";

import AwardPanel from "@/components/game/award-panel";
import HintStages from "@/components/game/hint-stages";
import HostBar, { type QuestionAction } from "@/components/game/host-bar";
import MediaImage from "@/components/game/media-image";
import { HostSound, ViewerSound } from "@/components/game/sound-card";
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
  const refs: MediaRef[] = [shown, audio].filter((ref): ref is MediaRef => ref !== undefined);
  const media = useMediaLinks(gameId, auth, refs);
  const controls = view.controls ?? [];
  const stages = "stageSuggestions" in question ? question : undefined;
  const hint = question.format === "AUDIO_VOICE" ? question.hint : undefined;
  const swatch = answer?.colorHex && /^#[0-9a-f]{3,8}$/i.test(answer.colorHex) ? answer.colorHex : undefined;
  const prompt = promptOf(question);
  const short = prompt.length <= 40 && !shown && !hasSound;

  return (
    <section aria-labelledby="question-title" className="flex flex-1 flex-col gap-4">
      <div className="paper-card flex flex-1 flex-col rounded-[2rem] border-4 border-ink p-4 shadow-[0_12px_0_var(--color-ink)] sm:p-6 lg:px-10 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {categoryName && (
              <p className={cn("max-w-full truncate rounded-xl border-[3px] border-ink px-4 py-1 font-heading text-2xl leading-tight lg:text-3xl", tone.ribbon)}>{categoryName}</p>
            )}
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
          {answering && (
            <TimerDial timer={view.timer} clockOffsetMs={clockOffsetMs} note={clockWaits(question) ? "الوقت بيبدأ لما الصورة تختفي" : undefined} />
          )}
        </header>

        <div className={cn("flex flex-1 items-center gap-8 py-6 lg:py-8", shown || hasSound ? "flex-col lg:flex-row" : "flex-col justify-center")}>
          <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-6 text-center">
            <h1
              id="question-title"
              tabIndex={-1}
              className={cn(
                "text-balance break-words font-heading focus:outline-none",
                answering
                  ? short
                    ? "text-5xl leading-[1.4] sm:text-6xl lg:text-8xl lg:leading-[1.3]"
                    : "text-4xl leading-[1.4] sm:text-5xl lg:text-6xl lg:leading-[1.35]"
                  : "text-2xl leading-snug text-charcoal/70 sm:text-3xl lg:text-4xl",
              )}
            >
              {prompt}
            </h1>
            {hint && answering && <p className="rounded-full border-[3px] border-ink bg-white px-5 py-1 font-heading text-2xl">تلميح: {hint}</p>}
            {stages && answering && <HintStages stageIndex={stages.stageIndex} suggestions={stages.stageSuggestions} />}
            {answer && (
              <div
                className="w-full max-w-4xl origin-top animate-[reveal_0.65s_ease-out_both] rounded-[1.6rem] border-4 border-ink bg-sun px-6 py-5 shadow-[0_8px_0_var(--color-ink)]"
                role="status"
              >
                <p className="font-heading text-xl leading-none text-ink/70">الإجابة</p>
                <p className="mt-2 flex items-center justify-center gap-4 text-balance font-heading text-5xl leading-[1.35] lg:text-7xl">
                  {swatch && <span aria-hidden className="size-14 shrink-0 rounded-full border-4 border-ink lg:size-20" style={{ backgroundColor: swatch }} />}
                  {answer.text}
                </p>
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
    </section>
  );
}
