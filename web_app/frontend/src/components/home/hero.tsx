"use client";

import Link from "next/link";
import Logo from "@/components/brand/logo";
import { toneAt } from "@/components/brand/tones";
import Cover from "@/components/brand/cover";
import Ticker from "@/components/home/ticker";
import CinemaWall from "@/components/room/cinema-wall";
import Button from "@/components/ui/button";
import { formatDigits, formatNumber } from "@/lib/format";
import type { Category } from "@/lib/api/types";
import { BOARD_SIZE } from "@/stores/draft-store";

// Where each poster of the fan sits, as % of the stage, and how far it is turned (degrees).
const fan = [
  { left: "0%", top: "34%", turn: -26 },
  { left: "15%", top: "17%", turn: -13 },
  { left: "31%", top: "7%", turn: -2 },
  { left: "46%", top: "6%", turn: 8 },
  { left: "59%", top: "14%", turn: 17 },
];

function delay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

function Fan({ categories }: { categories: Category[] }) {
  const shown = categories.filter((c) => c.coverUrl).slice(0, fan.length);
  return (
    <div aria-hidden className="relative mx-auto aspect-[6/5] w-full max-w-[30rem] lg:max-w-[40rem]">
      {/* Collage scraps behind the posters: mobile only, as in the paper-cut mockup. */}
      <span className="absolute inset-x-[8%] top-[14%] h-[74%] bg-green [clip-path:polygon(4%_8%,96%_0,100%_86%,12%_100%)] lg:hidden" />
      <span className="absolute end-[4%] top-[2%] size-[34%] rounded-full bg-sun lg:hidden" />
      {fan.map((slot, i) => {
        const category = shown[i];
        return (
          <span
            key={category?.id ?? i}
            className={`absolute w-[38%] animate-rise border-[3px] bg-[#fff8ea] shadow-poster ${toneAt(i).border}`}
            style={{ left: slot.left, top: slot.top, zIndex: i, ["--r" as string]: `${slot.turn}deg`, ...delay(250 + i * 90) }}
          >
            {category ? (
              <Cover src={category.coverUrl} name={category.name} tone={i} eager sizes="(min-width: 1024px) 12vw, 28vw" />
            ) : (
              <span className="block aspect-[4/5] bg-charcoal/70" />
            )}
          </span>
        );
      })}
      <span className="absolute end-[8%] bottom-[4%] z-10 grid size-14 -rotate-6 place-items-center rounded-full border-[3px] border-ink bg-sun font-heading text-3xl text-ink shadow-[0_3px_0_var(--color-ink)] lg:hidden">
        ؟
      </span>
    </div>
  );
}

type HeroProps = { categories: Category[]; onPlay: () => void };

export default function Hero({ categories, onPlay }: HeroProps) {
  return (
    <header className="relative isolate overflow-hidden bg-cream lg:bg-night">
      <Ticker />
      <div aria-hidden className="paper pointer-events-none absolute inset-0 -z-10 opacity-90 lg:hidden" />
      {/* Desktop: the lobby at night. The poster wall in the dark, one warm spotlight on the logo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
        <CinemaWall variant="home" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_42%_62%_at_50%_42%,rgb(255_214_140/0.18)_0%,rgb(20_12_8/0.72)_55%,rgb(10_7_5/0.94)_100%)]" />
        <div className="absolute inset-x-[30%] -top-10 bottom-0 bg-[linear-gradient(180deg,rgb(255_226_170/0.22),transparent_75%)] [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
      </div>

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 pt-4 sm:px-8 lg:px-12 lg:pt-8">
        <Logo variant="retro" eager className="w-14 lg:hidden" />
        {/* The lobby's marquee board, ringed with bulbs. */}
        <p
          aria-hidden
          className="relative hidden rounded-xl border-[3px] border-[#f6d64a] bg-[#8b1e2d] px-8 py-2 font-poster text-3xl text-[#f6e7c4] shadow-[0_0_24px_rgb(246_214_74/0.35),inset_0_0_14px_rgb(0_0_0/0.5)] [text-shadow:2px_2px_0_#1d2321] lg:block"
        >
          <span className="absolute inset-1 rounded-lg [background:radial-gradient(circle,#fff6c9_0_2px,transparent_3px)_0_0/14px_100%_repeat-x,radial-gradient(circle,#fff6c9_0_2px,transparent_3px)_0_100%/14px_6px_repeat-x] opacity-90" />
          سينما صحصح
        </p>
        <Link
          href="/join"
          className="rounded-full border-[3px] border-ink bg-cyan px-4 py-1.5 font-heading text-lg text-ink shadow-[0_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 lg:border-cream/0 lg:bg-transparent lg:text-cyan lg:shadow-none lg:underline lg:decoration-2 lg:underline-offset-8"
        >
          عندك كود؟ انضم للعبة
        </Link>
      </div>

      <div className="mx-auto grid max-w-[1400px] items-center gap-x-6 gap-y-6 px-5 pb-12 pt-6 sm:grid-cols-[1fr_1fr] sm:px-8 lg:grid-cols-[1fr_minmax(0,31rem)_1fr] lg:gap-x-4 lg:px-8 lg:pb-36 lg:pt-0">
        <div className="space-y-4 sm:order-2 lg:order-1 lg:space-y-0 lg:ps-6">
          <h1 className="flex flex-col items-start gap-3 font-heading lg:gap-1">
            <span
              className="animate-rise inline-block -rotate-3 bg-press px-4 py-1 text-[2rem] leading-tight text-white shadow-[4px_4px_0_var(--color-ink)] [--r:-3deg] lg:block lg:rotate-0 lg:bg-transparent lg:p-0 lg:text-[2.6rem] lg:text-cyan lg:shadow-none lg:[--r:0deg]"
              style={delay(60)}
            >
              اختار <span className="lg:block lg:text-[7.5rem] lg:leading-[0.95]">{formatDigits(BOARD_SIZE)} فئات</span>
            </span>
            <span
              className="animate-rise inline-block rotate-[1.5deg] bg-cyan px-4 py-1 text-[2rem] leading-tight text-ink shadow-[4px_4px_0_var(--color-ink)] [--r:1.5deg] lg:block lg:rotate-0 lg:bg-transparent lg:p-0 lg:text-[3.2rem] lg:text-cream lg:shadow-none lg:[--r:0deg]"
              style={delay(160)}
            >
              من {formatNumber(15000)} سؤال
            </span>
            <span
              className="animate-rise inline-block -rotate-2 bg-sun px-4 py-1 text-[2rem] leading-tight text-ink shadow-[4px_4px_0_var(--color-ink)] [--r:-2deg] lg:block lg:rotate-0 lg:bg-transparent lg:p-0 lg:text-[3.2rem] lg:text-cream lg:shadow-none lg:[--r:0deg]"
              style={delay(260)}
            >
              مستني مين؟
            </span>
          </h1>
          <div aria-hidden className="hidden h-[3px] w-full bg-cyan lg:mt-7 lg:block" />
          <Button onClick={onPlay} size="lg" className="mt-3 lg:hidden">
            العب!
          </Button>
        </div>

        <div className="hidden w-full lg:order-2 lg:block">
          <Logo variant="retro" eager className="mx-auto w-full max-w-[28rem] -rotate-2 drop-shadow-[0_18px_30px_rgb(0_0_0/0.35)]" />
        </div>

        <div className="sm:order-1 lg:order-3">
          <Fan categories={categories} />
        </div>
      </div>
    </header>
  );
}
