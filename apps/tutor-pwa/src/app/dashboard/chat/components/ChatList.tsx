"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MessageSquare, SearchX, Users } from "lucide-react";
import {
  CountBadge,
  EmptyState,
  ErrorState,
  IconTile,
  ListSkeleton,
  SearchField,
  UserAvatar,
} from "@/components/app";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "../lib/chat-types";
import { conversationPreview, filterConversations } from "../lib/chat-utils";
import { useInitialConversations } from "./ChatInitialData";
import { TWO_PANE_QUERY, useConversations, useMediaQuery } from "../lib/use-chat";

/** Show the search box only when there is something to search through. */
const SEARCH_MIN_CONVERSATIONS = 5;

export interface ChatListProps {
  /**
   * "page": the list page on phones/tablets (document scroll).
   * "pane": the left column of the desktop two-pane layout (own scroll area).
   */
  variant: "page" | "pane";
}

export function ChatList({ variant }: ChatListProps) {
  const initial = useInitialConversations();
  const pathname = usePathname() ?? "";
  const twoPane = useMediaQuery(TWO_PANE_QUERY);
  // Only the visible instance polls: the pane on desktop, the page list below 1024px.
  const visible = variant === "pane" ? twoPane : !twoPane;
  const { data, error, isLoading, refetch } = useConversations({ initial, poll: visible });
  const [query, setQuery] = useState("");

  const activeId = pathname.match(/\/dashboard\/chat\/([^/]+)/)?.[1] ?? null;
  const conversations = data ?? [];
  const filtered = filterConversations(conversations, query);
  const showSearch = conversations.length >= SEARCH_MIN_CONVERSATIONS || query.length > 0;

  let body: React.ReactNode;
  if (isLoading && !data) {
    body = <ListSkeleton rows={5} leading className={variant === "pane" ? "rounded-none border-0" : undefined} />;
  } else if (error && !data) {
    body = (
      <ErrorState
        compact
        title={t("dashboardChat.loadErrorTitle")}
        description={t("dashboardChat.loadErrorDescription")}
        onRetry={refetch}
      />
    );
  } else if (conversations.length === 0) {
    body = (
      <EmptyState
        icon={MessageSquare}
        title={t("dashboardChat.emptyTitle")}
        description={t("dashboardChat.emptyDescription")}
        compact={variant === "pane"}
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <EmptyState
        icon={SearchX}
        tone="neutral"
        title={t("dashboardChat.searchEmptyTitle")}
        description={t("dashboardChat.searchEmptyDescription")}
        compact
      />
    );
  } else {
    body = (
      <ul
        aria-label={variant === "page" ? t("dashboardChat.listLabel") : undefined}
        className={cn(
          variant === "page" && "overflow-hidden rounded-xl border border-hairline bg-surface shadow-card",
        )}
      >
        {filtered.map((conv) => (
          <li key={conv.id} className="list-row" data-leading="">
            <ConversationRow conversation={conv} active={conv.id === activeId} />
          </li>
        ))}
      </ul>
    );
  }

  if (variant === "pane") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-hairline px-4 pt-4 pb-3">
          <p className="text-lg font-semibold text-fg">{t("dashboardChat.title")}</p>
          {showSearch ? (
            <SearchField
              value={query}
              onValueChange={setQuery}
              label={t("dashboardChat.searchLabel")}
              placeholder={t("dashboardChat.searchPlaceholder")}
            />
          ) : null}
        </div>
        <nav aria-label={t("dashboardChat.listLabel")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {body}
        </nav>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {showSearch ? (
        <SearchField
          value={query}
          onValueChange={setQuery}
          label={t("dashboardChat.searchLabel")}
          placeholder={t("dashboardChat.searchPlaceholder")}
        />
      ) : null}
      {body}
    </div>
  );
}

function ConversationRow({ conversation: conv, active }: { conversation: ChatConversation; active: boolean }) {
  const unread = conv.unreadCount > 0;
  const preview = conversationPreview(conv, t("dashboardChat.you")) ?? t("dashboardChat.noMessages");
  const timestamp = formatListTimestamp(conv.lastMessage?.createdAt ?? conv.updatedAt);
  const isGroup = conv.type === "GROUP";
  return (
    <Link
      href={`/dashboard/chat/${conv.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "pressable flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none",
        active && "bg-brand-soft hover:bg-brand-soft",
      )}
    >
      {isGroup ? (
        <IconTile icon={Users} tone="teal" className="size-11 rounded-full" />
      ) : (
        <UserAvatar name={conv.title} src={conv.image} className="size-11" />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[0.9375rem] text-fg", unread ? "font-semibold" : "font-medium")}>
            {conv.title}
          </span>
          {timestamp ? (
            <span className={cn("shrink-0 text-xs tabular", unread ? "font-semibold text-brand-fg" : "text-fg-subtle")}>
              {timestamp}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("min-w-0 flex-1 truncate text-[0.8125rem]", unread ? "font-medium text-fg" : "text-fg-muted")}>
            {isGroup ? <span className="text-fg-subtle">{t("dashboardChat.group")} · </span> : null}
            {preview}
          </span>
          {unread ? (
            <>
              <CountBadge count={conv.unreadCount} className="bg-brand-solid text-on-brand" />
              <span className="sr-only">{t("dashboardChat.unreadCount").replace("{count}", String(conv.unreadCount))}</span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
