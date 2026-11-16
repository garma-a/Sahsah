import type { Metadata } from "next";
import CharadesCardView from "@/components/game/charades-card-view";

export const metadata: Metadata = { title: "مثّل من غير ولا كلمة | صحصح", robots: { index: false } };

/** /act/<game>/<board>/<question>?t=<token>: the page a charades code opens on the actor's phone. */
export default async function ActPage({ params, searchParams }: PageProps<"/act/[gameId]/[board]/[question]">) {
  const { gameId, board, question } = await params;
  const { t } = await searchParams;
  return <CharadesCardView gameId={gameId} board={Number(board)} question={Number(question)} token={typeof t === "string" ? t : ""} />;
}
