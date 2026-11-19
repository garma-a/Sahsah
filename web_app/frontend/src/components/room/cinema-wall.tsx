import { cn } from "@/lib/utils";

// Fictional films of the wall. The painted artwork leaves a flat band at `title` for the name, which is
// typeset here (never painted). Studios, writers and directors are invented too.
type Film = { art: string; title: string; at: "top" | "bottom"; ink: string; shade: string; credit: string };
const films: Film[] = [
  { art: "romance", title: "قلبي على الكورنيش", at: "bottom", ink: "#f6d64a", shade: "#1d2321", credit: "قصة وحوار: سامي الشربيني" },
  { art: "detective", title: "سر الشنطة الحمرا", at: "top", ink: "#f6e7c4", shade: "#d7402a", credit: "إخراج: حلمي عبد الستار" },
  { art: "comedy", title: "مصيبة يا شوقي", at: "bottom", ink: "#d7402a", shade: "#f6e7c4", credit: "تأليف: عزت أبو المجد" },
  { art: "desert", title: "فارس الصحرا", at: "top", ink: "#8b1e2d", shade: "#f6e7c4", credit: "إخراج: مراد الدمرداش" },
  { art: "boxer", title: "الضربة القاضية", at: "bottom", ink: "#f6e7c4", shade: "#d7402a", credit: "قصة وحوار: فؤاد السكري" },
  { art: "phone", title: "ألو.. مين معايا؟", at: "top", ink: "#f6d64a", shade: "#1d2321", credit: "إخراج: نبيل الشامي" },
  { art: "vespa", title: "فسحة على الفيسبا", at: "bottom", ink: "#f6d64a", shade: "#1d2321", credit: "تأليف: شريف المنياوي" },
  { art: "sailor", title: "صياد إسكندرية", at: "top", ink: "#f6e7c4", shade: "#1f8f9a", credit: "إخراج: كمال البحيري" },
  { art: "oud", title: "ليالي العود", at: "bottom", ink: "#f6d64a", shade: "#8b1e2d", credit: "ألحان: رياض الفيومي" },
  { art: "dancer", title: "رقصة الوداع", at: "top", ink: "#f6e7c4", shade: "#d13a6e", credit: "قصة وحوار: هدى الجمّال" },
  { art: "school", title: "الأستاذ والعفاريت", at: "bottom", ink: "#d7402a", shade: "#f6e7c4", credit: "إخراج: صلاح الطوخي" },
  { art: "cairo", title: "ليلة في وسط البلد", at: "top", ink: "#f6d64a", shade: "#1d2321", credit: "تأليف: منير الحلواني" },
  { art: "train", title: "آخر قطر للصعيد", at: "bottom", ink: "#f6e7c4", shade: "#d7402a", credit: "إخراج: عادل القليوبي" },
  { art: "ghost", title: "البيت المسكون", at: "top", ink: "#f6d64a", shade: "#2453a0", credit: "قصة وحوار: رشدي الفخراني" },
];

const turns = [-2.5, 1.5, -1, 3, -3.5, 1, 2.5, -2, 3.5, -3, 0.5, -1.5];
const lifts = [0, 18, -14, 8, -20, 12, -6, 22, -16, 6, 10, -8];
// A few sheets have been half torn away, showing the older paper underneath.
const torn = [
  "polygon(0 0, 100% 0, 100% 62%, 86% 67%, 72% 60%, 55% 71%, 36% 63%, 17% 73%, 0 66%)",
  "polygon(0 0, 100% 0, 100% 100%, 64% 100%, 57% 86%, 48% 94%, 39% 76%, 30% 88%, 18% 72%, 0 80%)",
  "polygon(24% 0, 100% 0, 100% 100%, 0 100%, 0 40%, 13% 31%, 7% 19%, 19% 10%)",
];
const corner = [
  "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
  "polygon(0 0, 92% 0, 100% 6%, 100% 100%, 0 100%)",
  "polygon(0 0, 100% 0, 100% 100%, 9% 100%, 0 93%)",
  "polygon(5% 0, 100% 0, 100% 100%, 0 100%, 0 4%)",
];

/** One pasted sheet: the painted artwork, the title typeset in its empty band, a credit line, and its age. */
function WallPoster({ film, index }: { film: Film; index: number }) {
  const rip = index % 6 === 4 ? torn[index % torn.length] : corner[index % corner.length];
  return (
    <div className="@container relative aspect-[2/3] overflow-hidden bg-[#3a2418]" style={{ clipPath: rip }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative wall artwork */}
      <img src={`/cinema/films/${film.art}.webp`} alt="" draggable={false} loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      <div className={cn("absolute inset-x-[5%] text-center", film.at === "top" ? "top-[3%]" : "bottom-[4%]")}>
        <p className="font-bold leading-none opacity-85" style={{ fontSize: "3.8cqw", color: film.ink }}>
          {film.credit}
        </p>
        <p
          className="mt-[2cqw] -rotate-2 font-poster leading-[1] [text-wrap:balance]"
          style={{ fontSize: "12cqw", color: film.ink, textShadow: `0.5cqw 0 0 #1d2321, -0.5cqw 0 0 #1d2321, 0 0.5cqw 0 #1d2321, 0 -0.5cqw 0 #1d2321, 1.6cqw 1.8cqw 0 ${film.shade}` }}
        >
          {film.title}
        </p>
      </div>
      {/* Age: sun-faded unevenly, creased, grained, the edges browned. */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: `linear-gradient(90deg, transparent ${44 + (index % 4) * 4}%, rgb(0 0 0 / 0.2) ${44.4 + (index % 4) * 4}%, rgb(255 255 255 / 0.16) ${45 + (index % 4) * 4}%, transparent ${45.5 + (index % 4) * 4}%), linear-gradient(0deg, transparent ${38 + (index % 3) * 6}%, rgb(0 0 0 / 0.16) ${38.4 + (index % 3) * 6}%, transparent ${39.2 + (index % 3) * 6}%), var(--grain)`,
          backgroundSize: "100% 100%, 100% 100%, 160px 160px",
          boxShadow: "inset 0 0 12cqw rgb(110 70 25 / 0.5)",
        }}
      />
      <div className="absolute inset-0 bg-[#c9a46a] mix-blend-color" style={{ opacity: 0.12 + (index % 4) * 0.05 }} />
    </div>
  );
}

type CinemaWallProps = {
  /**
   * "stage" (default) fills the window behind the game, dimmed so the screen glows in front of it.
   * "home" fills its positioned parent (the home shelves), lit warmer so it sits next to the paper.
   */
  variant?: "stage" | "home";
  className?: string;
};

/**
 * The lobby wall of an old downtown cinema: a photographed wall of layered, torn painted film posters, and
 * over it one-sheets of fictional films with their titles typeset, pasted crooked, taped, faded and sometimes
 * torn. Phones get the painted wall only. Purely decorative.
 */
export default function CinemaWall({ variant = "stage", className }: CinemaWallProps) {
  const home = variant === "home";
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none isolate overflow-hidden bg-[#3a2418] bg-[url(/cinema/wall-posters.webp)] bg-[length:1500px_auto]",
        home ? "absolute inset-0 rounded-[inherit]" : "fixed inset-0 -z-10",
        className,
      )}
    >
      <ul className="absolute -inset-x-10 -top-10 hidden grid-cols-5 gap-x-1 gap-y-2 md:grid lg:grid-cols-7 2xl:grid-cols-9">
        {Array.from({ length: home ? 45 : 36 }, (_, i) =>
          // Every other slot is left to the painted wall underneath.
          (i * 3) % 5 > 2 ? (
            <li key={i} />
          ) : (
          <li
            key={i}
            className="relative drop-shadow-[0_8px_12px_rgb(0_0_0/0.55)]"
            style={{
              transform: `translateY(${lifts[i % lifts.length]}px) rotate(${turns[i % turns.length]}deg) scale(1.14)`,
              zIndex: (i * 7) % 5,
            }}
          >
            <WallPoster film={films[(i * 5) % films.length]} index={i} />
            {i % 3 === 0 && <span className="absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 -rotate-3 bg-[#efe2c2]/60" />}
            {i % 4 === 1 && <span className="absolute end-2 top-2 size-2 rounded-full bg-[#7a6a58] shadow" />}
          </li>
          ),
        )}
      </ul>
      {home ? (
        <>
          {/* Warm lobby light pooling in the middle, the corners in shadow. */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_45%,rgb(26_14_8/0.45)_100%)]" />
          <div className="grain-dark absolute inset-0 opacity-35" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgb(20_14_10/0.2)_0%,rgb(14_10_8/0.75)_100%)]" />
          <div className="grain-dark absolute inset-0 opacity-45" />
        </>
      )}
    </div>
  );
}
