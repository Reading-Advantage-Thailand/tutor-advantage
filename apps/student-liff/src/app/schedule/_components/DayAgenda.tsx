import Link from "next/link";
import { BookOpen, CalendarCheck, CalendarPlus } from "lucide-react";
import { EmptyState, IconTile, ListGroup, ListRow, SectionHeader, Surface } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatStartMinutes, type ScheduledEvent } from "@/lib/schedule";

function StartTime({ event }: { event: ScheduledEvent }) {
  if (event.startMinutes === null) return <IconTile icon={BookOpen} tone="brand" className="w-14" />;
  return (
    <span className="flex h-10 w-14 items-center justify-center rounded-xl bg-tile-brand text-sm leading-none font-bold text-icon-brand tabular-nums">
      {formatStartMinutes(event.startMinutes)}
    </span>
  );
}

interface DayAgendaProps {
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
    : `${t("schedule.dateTitlePrefix")} ${formatThaiDate(date, "long")}`;

  return (
    <section className="flex flex-col gap-1" aria-live="polite">
      <SectionHeader title={title} count={hasClasses ? events.length : undefined} className="px-1" />
      {!hasClasses ? (
        <Surface padding="none">
          <EmptyState
            icon={CalendarPlus}
            title={t("schedule.noClassesTitle")}
            description={t("schedule.noClassesDescription")}
            action={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                {t("schedule.findClass")}
              </Link>
            }
          />
        </Surface>
      ) : events.length > 0 ? (
        <ListGroup aria-label={title}>
          {events.map((event) => (
            <ListRow
              key={event.id}
              href={`/lesson/${event.classId}`}
              className="[--row-divider-inset:84px]"
              leading={<StartTime event={event} />}
              title={event.title}
              subtitle={`${event.time} · ${t("schedule.tutorPrefix")} ${event.tutor}`}
            />
          ))}
        </ListGroup>
      ) : (
        <Surface padding="none">
          <EmptyState
            icon={CalendarCheck}
            tone="neutral"
            title={isToday ? t("schedule.emptyDay") : t("schedule.emptyDate")}
            description={t("schedule.emptyDayHint")}
            className="py-8"
          />
        </Surface>
      )}
    </section>
  );
}
