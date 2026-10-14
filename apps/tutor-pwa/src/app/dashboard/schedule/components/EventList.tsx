import { Chip, ListGroup, ListRow } from "@/components/app";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ScheduledEvent } from "../lib/schedule-events";

/** Start/end time column on the left of an agenda row. */
function TimeBlock({ event }: { event: ScheduledEvent }) {
  if (!event.start) {
    return (
      <span className="flex w-14 flex-col text-[0.8125rem] leading-tight font-medium text-fg-muted">
        {event.isDemo ? t("dashboardSchedule.allDay") : t("dashboardSchedule.byAppointment")}
      </span>
    );
  }
  return (
    <span className="flex w-14 flex-col leading-tight tabular">
      <span className="text-[0.9375rem] font-semibold text-fg">{event.start}</span>
      {event.end ? <span className="text-xs text-fg-subtle">{event.end}</span> : null}
    </span>
  );
}

export function EventRow({ event }: { event: ScheduledEvent }) {
  const details = [event.book, `${formatNumber(event.students)} ${t("dashboardSchedule.peopleUnit")}`].filter(Boolean).join(" · ");
  return (
    <ListRow
      href={`/dashboard/classes/${event.classId}`}
      leading={<TimeBlock event={event} />}
      title={event.title}
      subtitle={details}
      meta={event.isDemo ? <Chip tone="warning" size="sm">{t("dashboardSchedule.demoChip")}</Chip> : undefined}
      lines={1}
    />
  );
}

/** One day's sessions as a list group, or a quiet "no classes" line. */
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
      <p className={cn("rounded-xl border border-dashed border-hairline-strong px-4 py-3 text-sm text-fg-subtle", className)}>
        {t("dashboardSchedule.noClassesDay")}
      </p>
    );
  }
  return (
    <ListGroup aria-label={label} className={className}>
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </ListGroup>
  );
}
