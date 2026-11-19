import Link from "next/link";
import Logo from "@/components/brand/logo";
import CinemaWall from "@/components/room/cinema-wall";

/** The player-side frame, drawn phone-first: a ticket-stock card on the cinema wall with the logo on top. */
export default function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh px-4 pb-10 pt-6">
      <CinemaWall />
      <div className="mx-auto flex max-w-md flex-col items-center">
        <Link href="/" aria-label="صحصح، الصفحة الرئيسية" className="mb-5 rounded-xl">
          <Logo variant="retro" eager className="w-24 -rotate-3 drop-shadow-[0_10px_16px_rgb(0_0_0/0.4)]" />
        </Link>
        <main className="paper ticket w-full rounded-[2rem] border-4 border-ink p-5 pt-9 shadow-[0_10px_0_var(--color-ink),0_24px_50px_rgb(0_0_0/0.5)] sm:p-7 sm:pt-10">{children}</main>
      </div>
    </div>
  );
}
