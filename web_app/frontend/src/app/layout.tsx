import type { Metadata } from "next";
import GameStoreProvider from "@/providers/game-store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "صحصح | Sahsah",
  description: "Sahsah web application starter",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <GameStoreProvider>{children}</GameStoreProvider>
      </body>
    </html>
  );
}
