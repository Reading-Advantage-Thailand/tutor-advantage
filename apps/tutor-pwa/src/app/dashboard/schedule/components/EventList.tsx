import { CalendarOff } from "lucide-react";
import { Chip, SessionList, SessionRow } from "@/components/app";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ScheduledEvent } from "../lib/schedule-events";

/** CEFR band named in the book title ("Primary Origins 2 (A0)" → "A0"), for the level dot colour. */
export function eventLevel(book: string | null | undefined): string | null {
  const match = (book ?? "").match(/\b([ABC][0-2])\b/i);
  return match ? match[1].toUpperCase() : null;
}

/** Time column: start over end (tabular), or "ตามนัดหมาย" / "ตลอดวัน" for untimed sessions. */
function timeCell(event: ScheduledEvent) {
  if (!event.start) {
    return (
      <span className={cn("block text-[0.8125rem] leading-[1.35] font-medium text-fg-muted", event.isDemo ? "text-balance" : "whitespace-nowrap")}>
        {event.isDemo ? t("dashboardSchedule.allDay") : t("dashboardSchedule.byAppointment")}
      </span>
    );
  }
  return event.start;
}

/** One session (patterns.md T1.6 row, also used on the schedule page): time column, level dot + class, book · seats. */
export function EventRow({ event }: { event: ScheduledEvent }) {
  const details = [event.book, `${formatNumber(event.students)} ${t("dashboardSchedule.peopleUnit")}`].filter(Boolean).join(" · ");
  return (
    <SessionRow
      time={timeCell(event)}
      duration={event.start ? event.end : undefined}
      title={event.title}
      level={eventLevel(event.book)}
      meta={details}
      href={`/dashboard/classes/${event.classId}`}
      trailing={
        event.isDemo ? (
          <Chip tone="warning" size="sm" dot>
            {t("dashboardSchedule.demoChip")}
          </Chip>
        ) : undefined
      }
    />
  );
}

/** One day's sessions as a card of rows, or a quiet one-line "no classes" well (no Reedy). */
export function DayAgenda({
  events,
  label,
  className,
}: {
  events: ScheduledEvent[];
  label: string;
  className?: string;
}) {
  if (events.length === 0) {
    return (
      <p className={cn("flex items-center gap-2 rounded-(--radius-card) bg-surface-muted px-4 py-3 text-sm text-fg-muted", className)}>
        <CalendarOff aria-hidden="true" className="size-4 shrink-0" />
        {t("dashboardSchedule.noClassesDay")}
      </p>
    );
  }
  // Untimed sessions ("ตามนัดหมาย") need a slightly wider time column; the whole list keeps one width.
  const wideTime = events.some((event) => !event.start);
  return (
    <SessionList aria-label={label} timeColumn={wideTime ? "wide" : "default"} className={className}>
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </SessionList>
  );
}
