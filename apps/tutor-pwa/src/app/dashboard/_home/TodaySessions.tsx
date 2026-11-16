import Link from "next/link";
import { CalendarDays, ChevronRight, Presentation } from "lucide-react";
import { Chip, IconTile, Section, SessionList, SessionRow } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { fillTemplate } from "../_shared/text";
import { canStartNow, type HomeSchedule } from "./home-schedule";
import { LoadErrorLine } from "./LoadErrorLine";

/** "ตารางสอน ›" section link (44px on touch). */
export function ScheduleLink() {
  return (
    <Button variant="ghost-brand" render={<Link href="/dashboard/schedule" />} nativeButton={false}>
      {t("dashboardSchedule.title")}
      <ChevronRight aria-hidden="true" />
    </Button>
  );
}

/** A quiet one-line card for an empty day/week (no Reedy: the next-class card owns it). */
export function EmptyLine({ text }: { text: string }) {
  return (
    <div className="ds-card flex min-h-16 items-center gap-3 px-4 py-3">
      <IconTile icon={CalendarDays} tone="purple" />
      <p className="type-body-s text-fg-muted">{text}</p>
    </div>
  );
}

/**
 * "คาบสอนวันนี้" (patterns.md T1.6): one row per timed session today. The
 * session already in the next-class card gets a "ถัดไป" chip (the start
 * action is never duplicated); any other session that can start now (from
 * 15 minutes before) gets a tonal "เริ่มสอน"; the rest a chevron. When the
 * class list failed to load: the cause and a retry, not "no classes today".
 * Server component.
 */
export function TodaySessions({
  schedule,
  unavailable,
  className,
}: {
  schedule: HomeSchedule;
  /** `GET /v1/classes` failed, so the schedule is unknown (not empty). */
  unavailable?: boolean;
  className?: string;
}) {
  const { today, next } = schedule;
  return (
    <Section id="home-today" title={t("dashboardHome.todaySessions")} action={<ScheduleLink />} className={className}>
      {unavailable ? (
        <LoadErrorLine text={t("dashboardHome.scheduleUnavailable")} />
      ) : today.length === 0 ? (
        <EmptyLine text={t("dashboardSchedule.emptyDay")} />
      ) : (
        <SessionList aria-label={t("dashboardHome.todaySessions")}>
          {today.map((session) => {
            const isNext = next?.id === session.id;
            const trailing = isNext ? (
              <Chip tone="brand" dot>
                {t("dashboardHome.nextChip")}
              </Chip>
            ) : canStartNow(session, schedule) ? (
              <Button variant="tonal" size="sm" render={<Link href={`/lesson/${session.classId}`} />} nativeButton={false}>
                <Presentation aria-hidden="true" />
                {t("tutorClass.view.startTeaching")}
              </Button>
            ) : undefined;
            return (
              <SessionRow
                key={session.id}
                time={session.start}
                duration={
                  session.durationMin !== null
                    ? fillTemplate(t("dashboardHome.durationMinutes"), { n: session.durationMin })
                    : undefined
                }
                title={session.title}
                level={session.level}
                meta={
                  <>
                    {formatNumber(session.students)} {t("dashboardHome.studentsUnit")}
                    {session.level ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        {session.level}
                      </>
                    ) : null}
                  </>
                }
                href={`/dashboard/classes/${session.classId}`}
                trailing={trailing}
              />
            );
          })}
        </SessionList>
      )}
    </Section>
  );
}
