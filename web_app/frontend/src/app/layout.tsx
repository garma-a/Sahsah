import type { Metadata, Viewport } from "next";
import { Alexandria, Lalezar, Rakkas } from "next/font/google";
import SessionKeeper from "@/components/setup/session-keeper";
import GameStoreProvider from "@/providers/game-store-provider";
import "./globals.css";

// Lalezar stands in for the client's "Beirut" heading face, which has no web licence.
// Swap the face here and in --font-heading (globals.css) and nothing else changes.
const heading = Lalezar({ subsets: ["arabic", "latin"], weight: "400", variable: "--font-lalezar", display: "swap" });
// Rakkas letters the poster titles: a 1960s Egyptian cinema hand-lettering style.
const poster = Rakkas({ subsets: ["arabic", "latin"], weight: "400", variable: "--font-rakkas", display: "swap" });
const body = Alexandria({ subsets: ["arabic", "latin"], variable: "--font-alexandria", display: "swap" });

export const metadata: Metadata = {
  title: "صحصح | لعبة الأسئلة",
  description: "اختار ٦ فئات من ١٥٬٠٠٠ سؤال، وانقسموا فريقين، وصحصحوا.",
};

export const viewport: Viewport = {
  themeColor: "#2b3230",
  width: "device-width",
  initialScale: 1,
  // The game is laid out to fill one screen; pinch and double-tap zoom only push controls out of view.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${heading.variable} ${poster.variable} ${body.variable}`}>
      <body>
        <GameStoreProvider>
          <SessionKeeper />
          {children}
        </GameStoreProvider>
      </body>
    </html>
  );
}
