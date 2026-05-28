/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";
import { ChatListClient } from "./chat-list-client";

async function getConversations() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) return [];

  try {
    const res = await fetch(`${LEARNING_URL}/v1/chat/conversations`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { tags: ['chat'] }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.conversations || [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export default async function ChatPage() {
  const conversations = await getConversations();

  return (
    <PageTransition variant="slide-up" stagger className="space-y-6 max-w-2xl mx-auto w-full pb-24 sm:pb-12">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardChat.title")}</h1>
        <p className="text-sm font-medium text-muted-foreground mt-1">
          {t("dashboardChat.subtitle")}
        </p>
      </div>
      <ChatListClient conversations={conversations} />
    </PageTransition>
  );
}
