import type { ReactNode } from "react";
import { ChatInitialData } from "./components/ChatInitialData";
import { ChatList } from "./components/ChatList";
import { fetchConversations, getTutorToken } from "./lib/chat-server";
import type { ChatConversation } from "./lib/chat-types";

async function loadConversations(): Promise<ChatConversation[] | undefined> {
  const token = await getTutorToken();
  if (!token) return [];
  const result = await fetchConversations(token);
  // On error leave it undefined: the client list shows its own error/retry state.
  return result.ok ? result.data : undefined;
}

/**
 * Chat section layout. It persists while moving between the list and rooms,
 * so on desktop (≥1024px) the conversation list stays mounted in the left
 * pane and only the room on the right changes. Below 1024px the list page and
 * each room are full screens.
 */
export default async function ChatLayout({ children }: { children: ReactNode }) {
  const conversations = await loadConversations();
  return (
    <ChatInitialData conversations={conversations}>
      <div className="lg:grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:gap-6">
        <aside className="hidden lg:sticky lg:top-6 lg:block lg:h-[calc(100dvh-64px)] xl:top-7 xl:h-[calc(100dvh-76px)]">
          <ChatList variant="pane" />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </ChatInitialData>
  );
}
