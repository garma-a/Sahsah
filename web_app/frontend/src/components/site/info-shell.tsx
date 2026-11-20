import Link from "next/link";
import Logo from "@/components/brand/logo";
import AnnouncementBanner from "@/components/site/announcement-banner";
import SiteFooter from "@/components/site/site-footer";

/** The frame of the written pages: banner, a small header with the logo, a paper sheet for the text and the footer. */
export default function InfoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <AnnouncementBanner />
      <header className="bg-night px-5 py-4 text-cream sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" aria-label="صحصح، الصفحة الرئيسية" className="rounded-xl">
            <Logo variant="mono" className="w-12 text-sun" />
          </Link>
          <Link href="/" className="font-heading text-xl underline-offset-4 hover:text-sun hover:underline">
            ارجع للعبة
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-3 py-8 sm:px-6 sm:py-12">
        <div className="paper-card rounded-[2rem] border-4 border-ink p-6 shadow-[0_10px_0_var(--color-ink)] sm:p-10">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
