import Link from "next/link";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { Chip, EmptyState, IconTile, levelTone, ListGroup, ListRow, Section } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatNumber, keepTimesTogether } from "@/lib/format";
import { t } from "@/lib/i18n";
import { fillTemplate } from "../_shared/text";
import { classStatusTone, type RecentClass } from "./home-data";
import type { HomeClass } from "./home-schedule";
import { LoadErrorLine } from "./LoadErrorLine";

const statusLabel = {
  open: t("tutorClass.classes.statusOpen"),
  full: t("tutorClass.classes.statusFull"),
  closed: t("tutorClass.classes.statusClosed"),
} as const;

/**
 * "คลาสเรียนล่าสุด" (patterns.md T1.7): rows with a tile in the class's CEFR
 * tone, the name, "seats · schedule" and a status chip (dot + word). Seats
 * and level come from the class list when it loaded; otherwise the row keeps
 * the summary's own "schedule · N คน" line. Empty: a tone-tile card with the
 * create action, only when the tutor really has no classes; if the summary
 * failed and classes exist (or are unknown), the cause and a retry instead.
 * Server component.
 */
export function RecentClasses({
  recentClasses,
  classes,
  summaryFailed,
  className,
}: {
  recentClasses: RecentClass[];
  /** `GET /v1/classes` (null when it failed). */
  classes: HomeClass[] | null;
  /** The learning summary (source of these rows) failed to load. */
  summaryFailed?: boolean;
  className?: string;
}) {
  const byId = new Map((classes ?? []).map((cls) => [cls.id, cls]));
  // With the summary down, "no classes" is only true when the class list loaded empty.
  const knownNoClasses = !summaryFailed || (classes !== null && classes.length === 0);
  return (
    <Section
      id="home-recent"
      title={t("dashboardHome.recentClasses")}
      action={
        <Button variant="ghost-brand" render={<Link href="/dashboard/classes" />} nativeButton={false}>
          {t("dashboardHome.viewAll")}
          <ChevronRight aria-hidden="true" />
        </Button>
      }
      className={className}
    >
      {recentClasses.length === 0 && !knownNoClasses ? (
        <LoadErrorLine text={t("dashboardHome.recentClassesUnavailable")} />
      ) : recentClasses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="blue"
          title={t("dashboardHome.emptyClasses")}
          description={t("dashboardHome.emptyClassesHint")}
          action={
            <Button size="xl" render={<Link href="/dashboard/classes/new" />} nativeButton={false}>
              <Plus aria-hidden="true" />
              {t("tutorClass.classes.create")}
            </Button>
          }
        />
      ) : (
        <ListGroup aria-label={t("dashboardHome.recentClasses")}>
          {recentClasses.map((cls) => {
            const status = classStatusTone(cls.status);
            const full = byId.get(cls.id);
            const capacity = full?.capacity ?? full?.maxStudents ?? null;
            const students = cls.students ?? 0;
            const schedule = keepTimesTogether(cls.nextSession);
            return (
              <ListRow
                key={cls.id}
                href={`/dashboard/classes/${cls.id}`}
                leading={<IconTile icon={BookOpen} tone={levelTone(full?.cefrLevel)} />}
                // Clamped at two lines in a narrow column: the full name stays in `title`.
                title={<span title={cls.name}>{cls.name}</span>}
                subtitle={
                  capacity ? (
                    <>
                      <span className="tabular">
                        {fillTemplate(t("dashboardHome.seatsOf"), { n: formatNumber(students), max: formatNumber(capacity) })}
                      </span>
                      {schedule ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          {schedule}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {schedule}
                      <span aria-hidden="true"> · </span>
                      {formatNumber(students)} {t("dashboardHome.studentsUnit")}
                    </>
                  )
                }
                // Status chip: trailing from 375px; on narrower phones it moves under
                // the subtitle so the name gets the row's width. Only one of the two
                // slots is displayed (the other's wrapper is display:none, so it is
                // not read twice).
                meta={
                  <Chip tone={status.tone} size="sm" dot className="home-status-meta">
                    {statusLabel[status.key]}
                  </Chip>
                }
                trailing={
                  <Chip tone={status.tone} size="sm" dot className="home-status-trailing">
                    {statusLabel[status.key]}
                  </Chip>
                }
                className="max-[375px]:[&>span:has(>.home-status-trailing)]:hidden min-[375px]:[&_span:has(>.home-status-meta)]:hidden"
                chevron={false}
              />
            );
          })}
        </ListGroup>
      )}
    </Section>
  );
}
