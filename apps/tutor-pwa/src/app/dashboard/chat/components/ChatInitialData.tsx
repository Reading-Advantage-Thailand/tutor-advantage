"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ChatConversation } from "../lib/chat-types";

const InitialConversationsContext = createContext<ChatConversation[] | undefined>(undefined);

/** Server-rendered conversation list from the chat layout, for every ChatList below it. */
export function ChatInitialData({ conversations, children }: { conversations: ChatConversation[] | undefined; children: ReactNode }) {
  return <InitialConversationsContext.Provider value={conversations}>{children}</InitialConversationsContext.Provider>;
}

export function useInitialConversations(): ChatConversation[] | undefined {
  return useContext(InitialConversationsContext);
}
