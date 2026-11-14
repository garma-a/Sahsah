import type { Metadata } from "next";
import RoomView from "@/components/room/room-view";

export const metadata: Metadata = { title: "الغرفة | صحصح" };

export default async function RoomPage({ params }: PageProps<"/room/[roomId]">) {
  const { roomId } = await params;
  return <RoomView roomId={roomId} />;
}
