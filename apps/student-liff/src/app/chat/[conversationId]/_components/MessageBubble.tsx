import { memo } from "react";
import { UserAvatar } from "@/components/mobile";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DisplayMessage } from "../../_lib/messages";

interface MessageBubbleProps {
  message: DisplayMessage;
  /** First bubble of a sender group (sender name for others, 12px top gap). */
  isFirstInGroup: boolean;
  /** Last bubble of a sender group (time and, for others, the avatar). */
  isLastInGroup: boolean;
  /** Show the sender's name above the group (group chats). */
  showSenderName: boolean;
}

/** One chat bubble. Memoised: a poll that changes nothing re-renders no bubble. */
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
        own ? "justify-end pl-12" : "justify-start pr-10",
        isFirstInGroup ? "mt-3" : "mt-0.5",
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
      <div className={cn("flex max-w-[34rem] min-w-0 flex-col", own ? "items-end" : "items-start")}>
        {showSenderName && !own && isFirstInGroup ? (
          <span className="mb-1 px-3 text-xs leading-[1.5] font-semibold text-fg-muted">{message.senderName}</span>
        ) : null}
        <div
          className={cn(
            "max-w-full rounded-[20px] px-3.5 py-2 text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]",
            own
              ? cn("rounded-br-md bg-brand-solid text-white", !isFirstInGroup && "rounded-tr-md")
              : cn("rounded-bl-md border border-hairline bg-surface text-fg", !isFirstInGroup && "rounded-tl-md"),
            message.pending && "opacity-70",
          )}
        >
          {message.text}
        </div>
        {isLastInGroup ? (
          <span className="mt-1 px-1 text-xs leading-[1.5] text-fg-muted tabular-nums">
            {message.pending ? t("chat.sending") : formatThaiTime(message.time)}
          </span>
        ) : null}
      </div>
    </div>
  );
});
