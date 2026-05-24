import { cookies } from "next/headers";
import { LEARNING_URL } from "@/lib/service-urls";
import ChatRoomClient from "./chat-room-client";
import { t } from "@/lib/i18n";

async function getChatData(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;
  
  if (!token) return { metadata: null, messages: [] };

  try {
    const res = await fetch(`http://localhost:3002/v1/chat/conversations/${id}/messages`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      next: { tags: ['chat', `chat-${id}`] }
    });
    
    if (!res.ok) return { metadata: null, messages: [] };
    
    return await res.json();
  } catch (error) {
    console.error(error);
    return { metadata: null, messages: [] };
  }
}

export default async function ChatRoomPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const unwrappedParams = await params;
  const conversationId = unwrappedParams.conversationId;
  
  const chatData = await getChatData(conversationId);

  // If chat not found or unauthorized
  if (!chatData || !chatData.metadata) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-4 h-[calc(100vh-140px)]">
        <p className="text-muted-foreground">{t("dashboardChat.roomNotFound")}</p>
      </div>
    );
  }

  return (
    <ChatRoomClient 
      conversationId={conversationId} 
      initialMessages={chatData.messages || []} 
      metadata={chatData.metadata} 
    />
  );
}
