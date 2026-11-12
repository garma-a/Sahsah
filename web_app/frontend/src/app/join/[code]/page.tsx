import type { Metadata } from "next";
import JoinView from "@/components/join/join-view";
import CodeEntry from "@/components/join/code-entry";
import { toLatinDigits } from "@/lib/format";

export const metadata: Metadata = { title: "ادخل اللعبة | صحصح" };

export default async function JoinCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const clean = toLatinDigits(decodeURIComponent(code)).trim();
  // A malformed code goes back to manual entry instead of hitting the API.
  if (!/^[0-9]{6}$/.test(clean)) return <CodeEntry />;
  return <JoinView code={clean} />;
}
