"use client";

import { useParams } from "next/navigation";
import { ChatRoom } from "./_components/ChatRoom";

export default function ChatRoomPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = String(params?.conversationId ?? "");
  // Keyed so switching rooms starts with a fresh history, outbox and scroll state.
  return <ChatRoom key={conversationId} conversationId={conversationId} />;
}
