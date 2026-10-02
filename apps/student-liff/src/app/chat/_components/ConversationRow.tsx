import { Users } from "lucide-react";
import { ListRow, UserAvatar } from "@/components/mobile";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getConversationPreview, type Conversation } from "../_lib/conversations";

const PREVIEW_LABELS = {
  you: t("chat.you"),
  youPrefix: t("chat.youPrefix"),
  noMessages: t("chat.noMessages"),
};

/** One conversation in the chat list: avatar, title, last-message preview, time and unread count. */
export function ConversationRow({ conversation, now }: { conversation: Conversation; now: Date }) {
  const unread = conversation.unreadCount > 0 ? conversation.unreadCount : 0;
  const isGroup = conversation.type !== "DIRECT";

  return (
    <ListRow
      href={`/chat/${conversation.id}`}
      chevron={false}
      lines={1}
      className="min-h-[72px] [--row-divider-inset:76px]"
      leading={
        <span className="relative">
          <UserAvatar src={conversation.image} name={conversation.title} size="lg" className="size-12" decorative />
          {isGroup ? (
            <span className="absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full bg-tile-purple text-icon-purple ring-2 ring-surface">
              <Users aria-hidden="true" className="size-3" strokeWidth={2.4} />
              <span className="sr-only">{t("chat.groupAria")}</span>
            </span>
          ) : null}
        </span>
      }
      title={<span className={cn(unread && "font-bold")}>{conversation.title}</span>}
      subtitle={
        <span className={cn(unread ? "font-semibold text-fg" : undefined)}>
          {getConversationPreview(conversation, PREVIEW_LABELS)}
        </span>
      }
      trailing={
        <span className="flex flex-col items-end gap-1.5 self-stretch py-0.5">
          <span className={cn("text-xs leading-[1.5] tabular-nums", unread ? "font-semibold text-brand-fg" : "text-fg-muted")}>
            {formatListTimestamp(conversation.updatedAt, now)}
          </span>
          {unread ? (
            <>
              <span
                aria-hidden="true"
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-solid px-1.5 text-xs leading-none font-bold text-white tabular-nums"
              >
                {unread > 99 ? "99+" : unread}
              </span>
              <span className="sr-only">
                {unread} {t("chat.unreadSuffix")}
              </span>
            </>
          ) : null}
        </span>
      }
    />
  );
}
