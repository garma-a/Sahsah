import type { Metadata, Viewport } from "next";
import { Alexandria, Lalezar, Rakkas } from "next/font/google";
import Script from "next/script";
import SessionKeeper from "@/components/setup/session-keeper";
import GameStoreProvider from "@/providers/game-store-provider";
import "./globals.css";

// Lalezar stands in for the client's "Beirut" heading face, which has no web licence.
// Swap the face here and in --font-heading (globals.css) and nothing else changes.
const heading = Lalezar({ subsets: ["arabic", "latin"], weight: "400", variable: "--font-lalezar", display: "swap" });
// Rakkas letters the poster titles: a 1960s Egyptian cinema hand-lettering style.
const poster = Rakkas({ subsets: ["arabic", "latin"], weight: "400", variable: "--font-rakkas", display: "swap" });
const body = Alexandria({ subsets: ["arabic", "latin"], variable: "--font-alexandria", display: "swap" });

const cfAnalyticsToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN?.trim();

export const metadata: Metadata = {
  title: "صحصح | لعبة الأسئلة",
  description: "اختار ٦ فئات من ١٥٬٠٠٠ سؤال، وانقسموا فريقين، وصحصحوا.",
};

export const viewport: Viewport = {
  themeColor: "#2b3230",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${heading.variable} ${poster.variable} ${body.variable}`}>
      <body>
        <GameStoreProvider>
          <SessionKeeper />
          {children}
        </GameStoreProvider>
        {/* Cloudflare Web Analytics: only when a token is configured at build time. */}
        {cfAnalyticsToken && (
          <Script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: cfAnalyticsToken })} strategy="afterInteractive" />
        )}
      </body>
    </html>
  );
}
