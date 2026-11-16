import Link from "next/link";
import { Users } from "lucide-react";
import { UserAvatar } from "@/components/mobile";
import { formatListTimestamp } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getConversationPreview, type Conversation } from "../_lib/conversations";

const PREVIEW_LABELS = {
  you: t("chat.you"),
  youPrefix: t("chat.youPrefix"),
  noMessages: t("chat.noMessages"),
};

/**
 * One conversation in the chat list (patterns.md S14): avatar 48 (+ group
 * badge; initials in the reading face, as Kodchasan never sits in list rows,
 * README §4.2), name in the reading face with the time (12, tabular) beside it, the
 * last message on one line with the unread count pill beside it. A flat row:
 * the ListGroup card is the container.
 */
export function ConversationRow({ conversation, now }: { conversation: Conversation; now: Date }) {
  const unread = conversation.unreadCount > 0 ? conversation.unreadCount : 0;
  const isGroup = conversation.type !== "DIRECT";

  return (
    <Link
      href={`/chat/${conversation.id}`}
      data-leading=""
      className="list-row flex min-h-[76px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] [--row-divider-inset:78px] focus-visible:outline-offset-[-3px] active:bg-press"
    >
      <span className="relative shrink-0">
        <UserAvatar src={conversation.image} name={conversation.title} size="lg" className="size-12" decorative />
        {isGroup ? (
          <span className="absolute -right-1 -bottom-1 flex size-6 items-center justify-center rounded-full bg-tile-purple text-icon-purple ring-[2.5px] ring-surface">
            <Users aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
            <span className="sr-only">{t("chat.groupAria")}</span>
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-3">
          <span className={cn("t-row min-w-0 flex-1 truncate text-fg", unread && "font-bold")}>{conversation.title}</span>
          <span
            className={cn(
              "shrink-0 text-xs leading-[1.5] tabular-nums",
              unread ? "font-semibold text-brand-fg" : "text-fg-muted",
            )}
          >
            {formatListTimestamp(conversation.updatedAt, now)}
          </span>
        </span>
        <span className="mt-0.5 flex items-center gap-3">
          <span className={cn("min-w-0 flex-1 truncate text-sm leading-[1.6]", unread ? "font-semibold text-fg" : "text-fg-muted")}>
            {getConversationPreview(conversation, PREVIEW_LABELS)}
          </span>
          {unread ? (
            <>
              <span
                aria-hidden="true"
                className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-danger-solid px-1.5 text-xs leading-none font-semibold text-on-danger tabular-nums"
              >
                {unread > 99 ? "99+" : unread}
              </span>
              <span className="sr-only">
                {unread} {t("chat.unreadSuffix")}
              </span>
            </>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
