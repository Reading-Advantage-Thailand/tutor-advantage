"use client";

import type { Liff } from "@line/liff";
import { CalendarClock, CalendarDays, CalendarPlus, CalendarRange, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, IconTile, ListGroup, ListRow, SectionHeader, Surface } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { buildClassIcs, buildGoogleCalendarUrl, downloadIcsFile, icsFileName } from "@/lib/classCalendar";
import { formatThaiDate, keepTimesTogether } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { ClassDetail } from "./types";

/** ["เปิดคลาส: 28 ก.ย. 2569", "ปิดคลาส: 12 ต.ค. 2569"] (only the dates the class has). */
function classDateParts(cls: ClassDetail): string[] {
  return [
    cls.startsAt ? `${t("classes.detail.classStartsPrefix")} ${formatThaiDate(cls.startsAt)}` : null,
    cls.endsAt ? `${t("classes.detail.classEndsPrefix")} ${formatThaiDate(cls.endsAt)}` : null,
  ].filter((part): part is string => Boolean(part));
}

function classDatesLine(cls: ClassDetail): string | null {
  const parts = classDateParts(cls);
  return parts.length ? parts.join(" · ") : null;
}

/** Sales layout: weekly schedule, next lesson, class dates and "add to calendar". */
export function ScheduleSection({ cls, onAddToCalendar }: { cls: ClassDetail; onAddToCalendar: () => void }) {
  const [firstDate, secondDate] = classDateParts(cls);
  return (
    <section>
      <SectionHeader as="h3" title={t("classes.detail.schedule")} />
      <ListGroup className="mt-1">
        <ListRow
          leading={<IconTile icon={CalendarDays} tone="purple" />}
          title={keepTimesTogether(cls.schedule)}
          subtitle={`${t("classes.detail.nextLessonPrefix")} ${keepTimesTogether(cls.nextSession) || t("classes.detail.tba")}`}
        />
        {firstDate ? (
          <ListRow leading={<IconTile icon={CalendarRange} tone="blue" />} title={firstDate} subtitle={secondDate} />
        ) : null}
        <ListRow
          onClick={onAddToCalendar}
          leading={<IconTile icon={CalendarPlus} tone="teal" />}
          title={t("classes.detail.addToCalendar")}
          chevron
        />
      </ListGroup>
    </section>
  );
}

/** Enrolled layout: the next lesson, front and centre. */
export function NextSessionCard({ cls, onAddToCalendar }: { cls: ClassDetail; onAddToCalendar: () => void }) {
  const dates = classDatesLine(cls);
  const nextSession = cls.nextSession || t("classes.detail.tba");
  return (
    <Surface>
      <div className="flex items-start gap-3">
        <IconTile icon={CalendarClock} tone="purple" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.5] font-semibold text-fg-muted">{t("classes.detail.nextSessionTitle")}</p>
          <p className="mt-0.5 text-base leading-[1.5] font-bold text-pretty text-fg">{keepTimesTogether(nextSession)}</p>
          {cls.schedule && cls.schedule !== cls.nextSession ? (
            <p className="mt-1 text-[13px] leading-[1.5] text-pretty text-fg-muted">{keepTimesTogether(cls.schedule)}</p>
          ) : null}
          {dates ? <p className="mt-1 text-[13px] leading-[1.5] text-fg-muted">{dates}</p> : null}
        </div>
      </div>
      <Button variant="brandSoft" size="touch" className="mt-4 w-full" onClick={onAddToCalendar}>
        <CalendarPlus aria-hidden="true" />
        {t("classes.detail.addToCalendar")}
      </Button>
    </Surface>
  );
}

/**
 * One "add to calendar" entry point → choose phone calendar (.ics download)
 * or Google Calendar. Inside LINE, Google Calendar opens in the external
 * browser (the in-app browser cannot hand the event to the calendar app).
 */
export function CalendarSheet({
  cls,
  liff,
  open,
  onOpenChange,
}: {
  cls: ClassDetail;
  liff: Liff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const calendarClass = { id: cls.id, name: cls.name, schedule: cls.schedule, startsAt: cls.startsAt, endsAt: cls.endsAt };

  const handleIcs = () => {
    downloadIcsFile(buildClassIcs(calendarClass), icsFileName(cls.name));
    onOpenChange(false);
    toast.success(t("classes.detail.calendarIcsDone"));
  };

  const handleGoogle = () => {
    const url = buildGoogleCalendarUrl(calendarClass);
    onOpenChange(false);
    try {
      if (liff?.isInClient()) {
        liff.openWindow({ url, external: true });
        return;
      }
    } catch {
      // Fall through to a normal new tab.
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("classes.detail.calendarSheetTitle")}
      description={t("classes.detail.calendarSheetDescription")}
    >
      <ListGroup>
        <ListRow
          onClick={handleIcs}
          leading={<IconTile icon={CalendarPlus} tone="teal" />}
          title={t("classes.detail.calendarIcs")}
          subtitle={t("classes.detail.calendarIcsHint")}
          chevron
        />
        <ListRow
          onClick={handleGoogle}
          leading={<IconTile icon={ExternalLink} tone="blue" />}
          title={t("classes.detail.addToCalendarGoogle")}
          subtitle={t("classes.detail.calendarGoogleHint")}
          chevron
        />
      </ListGroup>
    </BottomSheet>
  );
}
