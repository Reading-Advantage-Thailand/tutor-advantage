"use client";

import { BottomNav } from "@/components/layout/BottomNav";
import { usePathname } from "next/navigation";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Hide BottomNav when inside a conversation room /chat/[conversationId]
  const isConversationPage = pathname.split("/").length > 2;

  return (
    <div className="page-shell">
      <div className="page-content">{children}</div>
      {!isConversationPage && <BottomNav />}
    </div>
  );
}
