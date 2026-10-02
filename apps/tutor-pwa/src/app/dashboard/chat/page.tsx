import { MessagesSquare } from "lucide-react";
import { EmptyState, Page, PageHeader } from "@/components/app";
import { t } from "@/lib/i18n";
import { ChatList } from "./components/ChatList";

/**
 * /dashboard/chat. Phones/tablets: the conversation list. Desktop (≥1024px):
 * the layout's left pane already shows the list, so the right side shows a
 * "pick a conversation" placeholder.
 */
export default function ChatPage() {
  return (
    <>
      <Page width="medium" className="lg:hidden">
        <PageHeader title={t("dashboardChat.title")} description={t("dashboardChat.subtitle")} />
        <ChatList variant="page" />
      </Page>
      <div className="hidden h-[calc(100dvh-64px)] items-center justify-center rounded-xl border border-hairline bg-surface shadow-card lg:flex xl:h-[calc(100dvh-76px)]">
        <h1 className="sr-only">{t("dashboardChat.title")}</h1>
        <EmptyState
          icon={MessagesSquare}
          title={t("dashboardChat.selectTitle")}
          description={t("dashboardChat.selectDescription")}
          compact
        />
      </div>
    </>
  );
}
