import Link from "next/link";
import { BookOpen, CalendarCheck, CalendarPlus } from "lucide-react";
import { EmptyState, IconTile, ListGroup, ListRow, SectionHeader, Surface } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { formatThaiDate, localDayToBangkokNoon } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatStartMinutes, type ScheduledEvent } from "@/lib/schedule";

/** Time column (patterns.md S11): 52px, start time in the reading face with tabular figures; a book tile when there is no time. */
function StartTime({ event }: { event: ScheduledEvent }) {
  if (event.startMinutes === null) {
    return (
      <span className="flex w-[52px] justify-start">
        <IconTile icon={BookOpen} tone="brand" size="sm" />
      </span>
    );
  }
  return (
    <span className="flex w-[52px] flex-col items-start">
      <span className="text-[17px] leading-[1.3] font-semibold text-fg tabular-nums">{formatStartMinutes(event.startMinutes)}</span>
      <span className="text-xs leading-[1.5] font-medium text-fg-muted">{t("schedule.timeSuffix")}</span>
    </span>
  );
}

interface DayAgendaProps {
  /** The selected day as a device-local date (a calendar grid cell). */
  date: Date;
  isToday: boolean;
  /** Already sorted by start time. */
  events: ScheduledEvent[];
  /** The student has at least one enrolled class. */
  hasClasses: boolean;
}

/** Classes of the selected day; each row opens the class lesson (/lesson/[classId]). */
export function DayAgenda({ date, isToday, events, hasClasses }: DayAgendaProps) {
  const title = isToday
    ? t("schedule.todayTitle")
    : `${t("schedule.dateTitlePrefix")} ${formatThaiDate(localDayToBangkokNoon(date), "long")}`;

  return (
    <section className="flex flex-col gap-1" aria-live="polite">
      <SectionHeader title={title} count={hasClasses ? events.length : undefined} />
      {!hasClasses ? (
        <EmptyState
          card
          headingLevel="h3"
          icon={CalendarPlus}
          title={t("schedule.noClassesTitle")}
          description={t("schedule.noClassesDescription")}
          action={
            <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
              {t("schedule.findClass")}
            </Link>
          }
        />
      ) : events.length > 0 ? (
        <ListGroup aria-label={title}>
          {events.map((event) => (
            <ListRow
              key={event.id}
              href={`/lesson/${event.classId}`}
              className="[--row-divider-inset:82px]"
              leading={<StartTime event={event} />}
              title={event.title}
              subtitle={`${event.time} · ${t("schedule.tutorPrefix")} ${event.tutor}`}
            />
          ))}
        </ListGroup>
      ) : (
        // An empty day is one quiet line, no Reedy (patterns.md S11).
        <Surface padding="none" className="flex items-center gap-3.5 px-4 py-3.5">
          <IconTile icon={CalendarCheck} tone="neutral" size="sm" />
          <div className="min-w-0">
            <h3 className="text-[15px] leading-[1.5] font-semibold text-fg">
              {isToday ? t("schedule.emptyDay") : t("schedule.emptyDate")}
            </h3>
            <p className="text-sm leading-[1.6] text-fg-muted">{t("schedule.emptyDayHint")}</p>
          </div>
        </Surface>
      )}
    </section>
  );
}
