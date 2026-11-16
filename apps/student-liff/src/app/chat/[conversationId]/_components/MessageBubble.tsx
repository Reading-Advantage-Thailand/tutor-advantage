import { memo } from "react";
import { UserAvatar } from "@/components/mobile";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "../../_lib/messages";

interface MessageBubbleProps {
  message: DisplayMessage;
  /** First bubble of a sender group (sender name for others, larger top gap). */
  isFirstInGroup: boolean;
  /** Last bubble of a sender group (time and, for others, the avatar). */
  isLastInGroup: boolean;
  /** Show the sender's name above the group (group chats). */
  showSenderName: boolean;
}

/**
 * One chat bubble (patterns.md S14): max 80% wide, radius 18 with a 6px tail
 * corner; own messages in soft jade (never white text on a brand fill), theirs
 * on a card with a rim; time 12 tabular in the tertiary text colour.
 * Memoised: a poll that changes nothing re-renders no bubble.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  isFirstInGroup,
  isLastInGroup,
  showSenderName,
}: MessageBubbleProps) {
  const own = message.isOwn;
  return (
    <div
      className={cn(
        "flex items-end gap-2",
        own ? "justify-end" : "justify-start",
        isFirstInGroup ? "mt-4" : "mt-1",
      )}
    >
      {own ? null : (
        // The avatar sits next to the last bubble, above its time line (mt-1 + 18px = 22px).
        <div className={cn("w-8 shrink-0", isLastInGroup && "mb-[22px]")}>
          {isLastInGroup ? (
            <UserAvatar src={message.senderImage} name={message.senderName} size="sm" decorative />
          ) : null}
        </div>
      )}
      <div className={cn("flex max-w-[80%] min-w-0 flex-col sm:max-w-[34rem]", own ? "items-end" : "items-start")}>
        {showSenderName && !own && isFirstInGroup ? (
          <span className="mb-1 px-1 text-xs leading-[1.5] font-semibold text-fg-muted">{message.senderName}</span>
        ) : null}
        <div
          className={cn(
            "max-w-full rounded-[18px] px-4 py-2.5 text-base leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]",
            own
              ? cn("bg-brand-soft text-brand-soft-fg", isLastInGroup && "rounded-br-[6px]")
              : cn("border-[1.5px] border-clay-rim bg-surface text-fg", isLastInGroup && "rounded-bl-[6px]"),
            message.pending && "opacity-70",
          )}
        >
          {message.text}
        </div>
        {isLastInGroup ? (
          <span className="mt-1 px-1 text-xs leading-[1.5] text-fg-subtle tabular-nums">
            {message.pending ? t("chat.sending") : formatThaiTime(message.time)}
          </span>
        ) : null}
      </div>
    </div>
  );
});
