import Link from "next/link";
import Logo from "@/components/brand/logo";
import CinemaWall from "@/components/room/cinema-wall";
import FitBox from "@/components/ui/fit-box";
import RotateNotice from "@/components/ui/rotate-notice";

/**
 * The player-side frame: a ticket-stock card on the cinema wall with the logo beside it. It fills the window and
 * never scrolls; held sideways on a phone the logo moves beside the card.
 */
export default function JoinShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-dvh flex-col overflow-hidden px-4 py-4">
      <RotateNotice />
      <CinemaWall />
      <FitBox innerClassName="items-center justify-center">
        <div className="flex w-full max-w-md flex-col items-center short:max-w-3xl short:flex-row short:items-center short:gap-6">
          <Link href="/" aria-label="صحصح، الصفحة الرئيسية" className="mb-5 shrink-0 rounded-xl short:mb-0">
            <Logo variant="retro" eager className="w-24 -rotate-3 drop-shadow-[0_10px_16px_rgb(0_0_0/0.4)] short:w-28" />
          </Link>
          <main className="paper ticket w-full rounded-[2rem] border-4 border-ink p-5 pt-9 shadow-[0_10px_0_var(--color-ink),0_24px_50px_rgb(0_0_0/0.5)] sm:p-7 sm:pt-10 short:p-5 short:pt-7">{children}</main>
        </div>
      </FitBox>
    </div>
  );
}
