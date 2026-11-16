import { memo } from "react";
import { Headset, RefreshCw } from "lucide-react";
import { formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "../_lib/tickets";

/**
 * One thread bubble (patterns.md S13): the student on the right in soft jade,
 * the team on the left on a card with a rim ("ทีมงาน" above a run). Max 80%
 * wide, radius 18 with a 6px tail corner, time 12 tabular under the bubble.
 */
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
    <div className={cn("flex", own ? "justify-end" : "justify-start", isFirstInGroup ? "mt-4" : "mt-1.5")}>
      <div className={cn("flex max-w-[80%] min-w-0 flex-col sm:max-w-[34rem]", own ? "items-end" : "items-start")}>
        {!own && isFirstInGroup ? (
          <span className="mb-1.5 flex items-center gap-1.5 px-1 text-xs leading-[1.5] font-semibold text-fg-muted">
            <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-tile-blue text-icon-blue">
              <Headset className="size-3.5" strokeWidth={2.4} />
            </span>
            {t("support.supportTeam")}
          </span>
        ) : null}
        <div
          className={cn(
            "max-w-full rounded-[18px] px-4 py-2.5 text-base leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere]",
            own
              ? "rounded-br-[6px] bg-brand-soft text-brand-soft-fg"
              : "rounded-bl-[6px] border-[1.5px] border-clay-rim bg-surface text-fg",
            pending && "opacity-70",
          )}
        >
          {body}
        </div>
        <span className="mt-1 px-1 text-xs leading-[1.5] text-fg-subtle tabular-nums">
          {pending ? t("support.sending") : formatThaiTime(createdAt)}
        </span>
      </div>
    </div>
  );
});

/** Day separators (centred chips), bubbles and the small centred status lines. */
export function TicketThread({ items }: { items: ThreadItem[] }) {
  return (
    <>
      {items.map((item) => {
        if (item.kind === "date") {
          return (
            <div key={item.key} className="flex justify-center pt-5 pb-1">
              <span className="rounded-full border-[1.5px] border-clay-rim bg-surface-muted px-3 py-0.5 text-xs leading-[1.5] font-semibold text-fg-muted">
                {item.label}
              </span>
            </div>
          );
        }
        if (item.kind === "status") {
          const status = item.copy.statusLabelKey ? ` “${t(item.copy.statusLabelKey)}”` : "";
          return (
            <p
              key={item.key}
              className="mx-auto mt-4 flex w-fit max-w-full items-start gap-1.5 rounded-[14px] bg-surface-muted px-3 py-1.5 text-center text-xs leading-[1.6] text-fg-muted"
            >
              <RefreshCw aria-hidden="true" className="mt-[3px] size-3.5 shrink-0" strokeWidth={2.4} />
              <span>
                {t(item.copy.labelKey)}
                {status}
                <span className="tabular-nums"> · {formatThaiTime(item.message.createdAt)}</span>
              </span>
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
