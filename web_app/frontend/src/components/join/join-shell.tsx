import Link from "next/link";
import Logo from "@/components/brand/logo";

/** The player-side frame, drawn phone-first: a paper card on the charcoal wall with the logo on top. */
export default function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain-dark min-h-dvh bg-charcoal px-4 pb-10 pt-6">
      <div className="mx-auto flex max-w-md flex-col items-center">
        <Link href="/" aria-label="صحصح، الصفحة الرئيسية" className="mb-5 rounded-xl">
          <Logo variant="retro" eager className="w-24 -rotate-3 drop-shadow-[0_10px_16px_rgb(0_0_0/0.4)]" />
        </Link>
        <main className="paper w-full rounded-[2rem] border-4 border-ink p-5 shadow-[0_10px_0_var(--color-ink)] sm:p-7">{children}</main>
      </div>
    </div>
  );
}
