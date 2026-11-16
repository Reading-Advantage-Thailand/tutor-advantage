import Link from "next/link";
import { AlertTriangle, CalendarPlus, Presentation } from "lucide-react";
import { Chip, IconTile, NextClassCard } from "@/components/app";
import { Button } from "@/components/ui/button";
import { ReedyMini } from "@/components/mascot/ReedyMini";
import { formatNumber, formatRelativeDay } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import { fillTemplate } from "../_shared/text";
import { keyToDate } from "../schedule/lib/schedule-events";
import type { NextSession } from "./home-schedule";
import { RetryButton } from "./LoadErrorLine";

/** "ถึง 18:00 · อีก 35 นาที" / "ถึง 18:00 · กำลังสอนอยู่" / "อีก 2 ชม." */
export function nextTimeNote(next: NextSession): string {
  const parts: string[] = [];
  if (next.end) parts.push(fillTemplate(t("dashboardHome.endsAt"), { end: next.end }));
  if (next.inProgress) {
    parts.push(t("dashboardHome.inProgress"));
  } else if (next.minutesUntil !== null) {
    parts.push(
      next.minutesUntil < 60
        ? fillTemplate(t("dashboardHome.startsInMinutes"), { n: next.minutesUntil })
        : fillTemplate(t("dashboardHome.startsInHours"), { n: Math.floor(next.minutesUntil / 60) }),
    );
  }
  return parts.join(" · ");
}

/** "Primary Origins 2 (A0)"; adds the band when the book title does not carry it. */
function bookLine(book: string, level: string | null): string | null {
  const title = book && book !== "Unknown Book" ? book : "";
  if (!title) return level;
  return level && !title.includes(level) ? `${title} (${level})` : title;
}

/**
 * Next-class card (patterns.md T1.4): the page's one primary "เริ่มสอนสด"
 * (opens the lesson flow, /lesson/[classId], like the class page's
 * "เริ่มสอน") + secondary "ดูคลาส". With no upcoming timed session: an empty
 * card with Reedy calm (the screen's one Reedy), one line and a tonal
 * "สร้างตารางสอน". When the class list failed to load: a 56px tone tile, the
 * cause and a retry instead (patterns.md "Error (load)"), so a failed fetch
 * never reads as "no next class". Server component.
 */
export function NextClass({
  next,
  hasClasses,
  unavailable,
  className,
}: {
  next: NextSession | null;
  /** The tutor has at least one class (the empty action then edits classes instead of creating one). */
  hasClasses: boolean;
  /** `GET /v1/classes` failed, so the next session is unknown. */
  unavailable?: boolean;
  className?: string;
}) {
  if (!next && unavailable) {
    return (
      <section aria-labelledby="home-next-label" className={cn("ds-card flex flex-col gap-2 px-[18px] pt-4 pb-[18px]", className)}>
        <p id="home-next-label" className="type-label text-fg-muted">
          {t("dashboardHome.nextClass")}
        </p>
        <div className="flex flex-1 flex-col items-center justify-center pb-1 text-center">
          <IconTile icon={AlertTriangle} tone="amber" size="xl" />
          <p className="mt-3 type-section text-balance-th text-fg">{t("dashboardHome.scheduleUnavailable")}</p>
          <p className="mt-0.5 max-w-xs type-body-s text-fg-muted">{t("dashboardHome.scheduleUnavailableHint")}</p>
          <div className="mt-4">
            <RetryButton size="lg" />
          </div>
        </div>
      </section>
    );
  }

  if (!next) {
    return (
      <section aria-labelledby="home-next-label" className={cn("ds-card flex flex-col gap-2 px-[18px] pt-4 pb-[18px]", className)}>
        <p id="home-next-label" className="type-label text-fg-muted">
          {t("dashboardHome.nextClass")}
        </p>
        <div className="flex flex-1 flex-col items-center justify-center pb-1 text-center">
          <ReedyMini mood="calm" size={72} decorative />
          <p className="mt-3 type-section text-balance-th text-fg">{t("dashboardHome.noNextClass")}</p>
          <p className="mt-0.5 max-w-xs type-body-s text-fg-muted">
            {thaiCopy(hasClasses ? t("dashboardHome.noNextClassHint") : t("dashboardHome.noNextClassNoClassesHint"))}
          </p>
          <Button
            variant="tonal"
            size="lg"
            className="mt-4"
            render={<Link href={hasClasses ? "/dashboard/classes" : "/dashboard/classes/new"} />}
            nativeButton={false}
          >
            <CalendarPlus aria-hidden="true" />
            {t("dashboardHome.createSchedule")}
          </Button>
        </div>
      </section>
    );
  }

  const book = bookLine(next.book, next.level);
  return (
    <NextClassCard
      className={className}
      label={t("dashboardHome.nextClass")}
      chip={
        <Chip tone={next.dayOffset === 0 ? "brand" : "neutral"} dot>
          {formatRelativeDay(keyToDate(next.dateKey))}
        </Chip>
      }
      time={next.start}
      timeNote={nextTimeNote(next)}
      title={next.title}
      lines={book ? [book] : undefined}
      studentsLabel={fillTemplate(t("dashboardHome.studentsCount"), { n: formatNumber(next.students) })}
      primaryAction={
        <Button size="xl" className="w-full" render={<Link href={`/lesson/${next.classId}`} />} nativeButton={false}>
          <Presentation aria-hidden="true" />
          {t("dashboardHome.startLive")}
        </Button>
      }
      secondaryAction={
        <Button size="xl" variant="outline" render={<Link href={`/dashboard/classes/${next.classId}`} />} nativeButton={false}>
          {t("dashboardHome.viewClass")}
        </Button>
      }
    />
  );
}
