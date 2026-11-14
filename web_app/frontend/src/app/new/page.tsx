import type { Metadata } from "next";
import TeamSetup from "@/components/setup/team-setup";

export const metadata: Metadata = { title: "سمّوا الفريقين | صحصح" };

export default function NewRoomPage() {
  return <TeamSetup />;
}
