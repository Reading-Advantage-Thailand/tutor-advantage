import { memo } from "react";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../_lib/tickets";

/** One thread bubble: the student on the right, the team on the left (with "ทีมงาน" above a run). */
export const TicketBubble = memo(function TicketBubble({
  own,
  body,
  createdAt,
  isFirstInGroup,
  pending = false,
}: {
  own: boolean;
  body: string;
  createdAt: string;
  isFirstInGroup: boolean;
  pending?: boolean;
}) {
  return (
    <div className={cn("flex", own ? "justify-end pl-12" : "justify-start pr-12", isFirstInGroup ? "mt-3" : "mt-1")}>
      <div className={cn("flex max-w-[34rem] min-w-0 flex-col", own ? "items-end" : "items-start")}>
        {!own && isFirstInGroup ? (
          <span className="mb-1 px-3 text-xs leading-[1.5] font-semibold text-fg-muted">{t("support.supportTeam")}</span>
        ) : null}
        <div
          className={cn(
            "max-w-full rounded-[20px] px-3.5 py-2 text-[15px] leading-[1.55] whitespace-pre-wrap [overflow-wrap:anywhere]",
            own ? "rounded-br-md bg-brand-solid text-white" : "rounded-bl-md border border-hairline bg-surface text-fg",
            pending && "opacity-70",
          )}
        >
          {body}
        </div>
        <span className="mt-1 px-1 text-xs leading-[1.5] text-fg-muted tabular-nums">
          {pending ? t("support.sending") : formatThaiTime(createdAt)}
        </span>
      </div>
    </div>
  );
});

/** Day separators, bubbles and the small centered status lines. */
export function TicketThread({ items }: { items: ThreadItem[] }) {
  return (
    <>
      {items.map((item) => {
        if (item.kind === "date") {
          return (
            <div key={item.key} className="flex justify-center pt-4 pb-1">
              <span className="rounded-full bg-fill-muted px-3 py-1 text-xs leading-[1.5] font-semibold text-fg-muted">
                {item.label}
              </span>
            </div>
          );
        }
        if (item.kind === "status") {
          const status = item.copy.statusLabelKey ? ` “${t(item.copy.statusLabelKey)}”` : "";
          return (
            <p key={item.key} className="mt-3 px-6 text-center text-xs leading-[1.6] text-fg-muted">
              {t(item.copy.labelKey)}
              {status}
              <span className="tabular-nums"> · {formatThaiTime(item.message.createdAt)}</span>
            </p>
          );
        }
        return (
          <TicketBubble
            key={item.key}
            own={item.own}
            body={item.message.body ?? ""}
            createdAt={item.message.createdAt}
            isFirstInGroup={item.isFirstInGroup}
          />
        );
      })}
    </>
  );
}
