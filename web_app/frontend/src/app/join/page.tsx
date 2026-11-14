import type { Metadata } from "next";
import CodeEntry from "@/components/join/code-entry";

export const metadata: Metadata = { title: "ادخل كود الغرفة | صحصح" };

export default function JoinPage() {
  return <CodeEntry />;
}
