import Link from "next/link";
import { MessageSquareOff } from "lucide-react";
import { EmptyState, ShellTitle } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { fetchRoom, getTutorToken } from "../lib/chat-server";
import ChatRoomClient from "./chat-room-client";

export default async function ChatRoomPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const token = await getTutorToken();
  const result = token ? await fetchRoom(token, conversationId) : null;

  // Not a participant / unknown room / signed out: same "not found" screen as before.
  if (!result || (!result.ok && result.status < 500) || (result.ok && !result.data.metadata)) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center rounded-xl md:h-[calc(100dvh-64px)] md:border md:border-hairline md:bg-surface md:shadow-card xl:h-[calc(100dvh-76px)]">
        <ShellTitle title={t("dashboardChat.title")} backHref="/dashboard/chat" />
        <h1 className="sr-only">{t("dashboardChat.roomNotFound")}</h1>
        <EmptyState
          icon={MessageSquareOff}
          tone="neutral"
          title={t("dashboardChat.roomNotFound")}
          description={t("dashboardChat.roomNotFoundDescription")}
          action={
            <Button variant="outline" render={<Link href="/dashboard/chat" />} nativeButton={false}>
              {t("dashboardChat.backToList")}
            </Button>
          }
          compact
        />
      </div>
    );
  }

  // A server error (5xx) renders the room without data: the client fetch shows retry.
  return (
    <ChatRoomClient
      key={conversationId}
      conversationId={conversationId}
      initial={result.ok ? result.data : undefined}
    />
  );
}
