"use client";

import { Music2, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Playback } from "@/lib/api/types";
import { formatDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

const BARS = [0.5, 0.9, 0.65, 1, 0.55, 0.8, 0.45];

function Equalizer({ playing, tint }: { playing: boolean; tint: string }) {
  return (
    <div aria-hidden className="flex h-16 items-end justify-center gap-1.5">
      {BARS.map((height, i) => (
        <span
          key={i}
          className={cn("w-3 origin-bottom rounded-full border-2 border-ink", tint, playing && "animate-[eq_0.9s_ease-in-out_infinite]")}
          style={{ height: `${height * 100}%`, animationDelay: `${i * 0.11}s`, transform: playing ? undefined : "scaleY(0.45)" }}
        />
      ))}
    </div>
  );
}

function seconds(ms: number): string {
  return `${formatDigits(Math.max(1, Math.round(ms / 1000)))} ثانية`;
}

type FrameProps = { children?: React.ReactNode; durationMs: number; caption: string };

function Frame({ children, durationMs, caption }: FrameProps) {
  return (
    <figure className="flex w-full max-w-sm shrink-0 flex-col items-center gap-4 rounded-[1.6rem] border-4 border-ink bg-white p-6 shadow-[0_8px_0_var(--color-ink)] lg:w-[24rem]">
      <div className="flex items-center gap-2 font-heading text-2xl leading-none">
        <Music2 aria-hidden className="size-6" strokeWidth={2.5} />
        {caption}
      </div>
      {children}
      <figcaption className="rounded-full border-[3px] border-ink bg-cream px-4 py-0.5 text-base font-bold">مدة المقطع {seconds(durationMs)}</figcaption>
    </figure>
  );
}

type HostSoundProps = {
  /** Signed link; undefined while it is being issued. */
  url?: string;
  failed: boolean;
  onRetry: () => void;
  durationMs: number;
  caption: string;
  /** An actual play, pause, seek or end, for the viewers' visual. Never audio, never the link. */
  onReport: (playing: boolean, positionMs: number) => void;
};

/**
 * The host's clip: real audio, on this device only. Playback needs a tap (browsers block autoplay) and can be
 * repeated without limit. Starting, pausing, seeking and ending are reported once each so viewers can mirror
 * the clip as a picture; the bytes and the link never leave this device.
 */
export function HostSound({ url, failed, onRetry, durationMs, caption, onReport }: HostSoundProps) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [broken, setBroken] = useState(false);
  const report = useRef(onReport);
  useEffect(() => {
    report.current = onReport;
  });
  // Leaving the question (or the reveal) unmounts this card: the sound stops with it.
  useEffect(() => {
    const element = audio.current;
    return () => {
      element?.pause();
    };
  }, []);

  const position = () => Math.round((audio.current?.currentTime ?? 0) * 1000);
  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    if (ended) element.currentTime = 0;
    setBroken(false);
    try {
      await element.play();
    } catch {
      setBroken(true);
    }
  }

  const unavailable = failed || broken;
  return (
    <Frame durationMs={durationMs} caption={caption}>
      <Equalizer playing={playing} tint="bg-cyan" />
      <audio
        ref={audio}
        src={url}
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          setEnded(false);
          report.current(true, position());
        }}
        onPause={() => {
          setPlaying(false);
          if (!audio.current?.ended) report.current(false, position());
        }}
        onSeeked={() => report.current(!audio.current?.paused, position())}
        onTimeUpdate={() => setPositionMs(position())}
        onEnded={() => {
          setPlaying(false);
          setEnded(true);
          report.current(false, position());
        }}
        onError={() => setBroken(true)}
      />
      <div className="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-cream" aria-hidden>
        <div className="h-full bg-cyan" style={{ width: `${Math.min(100, (positionMs / Math.max(1, durationMs)) * 100)}%` }} />
      </div>
      {unavailable ? (
        <button
          type="button"
          onClick={() => {
            setBroken(false);
            onRetry();
          }}
          className="flex h-14 cursor-pointer items-center gap-2 rounded-full border-[3px] border-ink bg-cream px-6 font-heading text-2xl hover:bg-sun"
        >
          <TriangleAlert aria-hidden className="size-6" />
          الصوت مش شغال، جرّب تاني
        </button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={!url}
          aria-busy={!url || undefined}
          className="flex h-16 cursor-pointer items-center gap-3 rounded-full bg-press px-8 font-heading text-3xl leading-none text-white shadow-chunk ring-4 ring-cyan transition-transform active:translate-y-[3px] disabled:opacity-60"
        >
          {playing ? <Pause aria-hidden className="size-7" /> : ended ? <RotateCcw aria-hidden className="size-7" /> : <Play aria-hidden className="size-7" />}
          {!url ? "بنجهّز الصوت…" : playing ? "وقّف الصوت" : ended ? "شغّله تاني" : "شغّل الصوت"}
        </button>
      )}
    </Frame>
  );
}

type ViewerSoundProps = {
  durationMs: number;
  caption: string;
  playback: Playback | null;
  clockOffsetMs: number;
};

/** What a viewer sees of the host's clip: the same card and a moving picture while it plays. No sound. */
export function ViewerSound({ durationMs, caption, playback, clockOffsetMs }: ViewerSoundProps) {
  const playing = playback?.playing ?? false;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [playing]);
  const base = playback?.positionMs ?? 0;
  const sinceUpdate = playing && playback ? Math.max(0, now + clockOffsetMs - Date.parse(playback.updatedAt)) : 0;
  const position = Math.min(durationMs, base + (Number.isFinite(sinceUpdate) ? sinceUpdate : 0));
  return (
    <Frame durationMs={durationMs} caption={caption}>
      <Equalizer playing={playing} tint="bg-sun" />
      <div className="h-3 w-full overflow-hidden rounded-full border-2 border-ink bg-cream" aria-hidden>
        <div className="h-full bg-sun" style={{ width: `${Math.min(100, (position / Math.max(1, durationMs)) * 100)}%` }} />
      </div>
      <p role="status" className="font-heading text-2xl leading-none">
        {playing ? "المقطع شغّال" : "المضيف بيشغّل المقطع على جهازه"}
      </p>
    </Frame>
  );
}
