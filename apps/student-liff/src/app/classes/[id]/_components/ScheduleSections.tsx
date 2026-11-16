"use client";

import { Fragment } from "react";
import type { Liff } from "@line/liff";
import { CalendarClock, CalendarDays, CalendarPlus, CalendarRange, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, IconTile, ListGroup, ListRow, Surface } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { buildClassIcs, buildGoogleCalendarUrl, downloadIcsFile, icsFileName } from "@/lib/classCalendar";
import { formatThaiDate, keepTimesTogether } from "@/lib/format";
import { t } from "@/lib/i18n";
import { keepThaiWords } from "@/lib/thaiText";
import type { ClassDetail } from "./types";

/** ["เปิดคลาส: 28 ก.ย. 2569", "ปิดคลาส: 12 ต.ค. 2569"] (only the dates the class has). */
function classDateParts(cls: ClassDetail): string[] {
  return [
    cls.startsAt ? `${t("classes.detail.classStartsPrefix")} ${formatThaiDate(cls.startsAt)}` : null,
    cls.endsAt ? `${t("classes.detail.classEndsPrefix")} ${formatThaiDate(cls.endsAt)}` : null,
  ].filter((part): part is string => Boolean(part));
}

/**
 * The class dates on one line, "เปิดคลาส: … · ปิดคลาส: …". Each part stays
 * whole, so the line can only break at the separator (ICU splits "ปิด / คลาส"
 * on a 320px phone otherwise).
 */
function ClassDatesLine({ parts }: { parts: string[] }) {
  return parts.map((part, index) => (
    <Fragment key={part}>
      {index > 0 ? " · " : null}
      <span className="whitespace-nowrap">{part}</span>
    </Fragment>
  ));
}

/**
 * Sales layout: weekly schedule, next lesson, class dates and "add to
 * calendar", as one card (it is the first card under the hero, so its title
 * sits inside it).
 */
export function ScheduleSection({ cls, onAddToCalendar }: { cls: ClassDetail; onAddToCalendar: () => void }) {
  const [firstDate, secondDate] = classDateParts(cls);
  return (
    <Surface as="section" padding="lg">
      <div className="flex items-start gap-3.5">
        <IconTile icon={CalendarDays} tone="purple" size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm leading-[1.6] font-medium text-fg-muted">{t("classes.detail.schedule")}</h3>
          <p className="t-title-s mt-0.5 text-pretty text-fg">{keepTimesTogether(cls.schedule)}</p>
          <p className="mt-1 text-sm leading-[1.6] text-pretty text-fg-muted">
            {`${t("classes.detail.nextLessonPrefix")} ${keepTimesTogether(cls.nextSession) || t("classes.detail.tba")}`}
          </p>
        </div>
      </div>
      {firstDate ? (
        <div className="well mt-4 flex items-start gap-3 px-3.5 py-3">
          <CalendarRange aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-icon-blue" strokeWidth={2.2} />
          <div className="min-w-0 text-sm leading-[1.6]">
            <p className="font-semibold text-fg">{firstDate}</p>
            {secondDate ? <p className="text-fg-muted">{secondDate}</p> : null}
          </div>
        </div>
      ) : null}
      <Button variant="brandSoft" size="touch" className="mt-4 w-full" onClick={onAddToCalendar}>
        <CalendarPlus aria-hidden="true" />
        {t("classes.detail.addToCalendar")}
      </Button>
    </Surface>
  );
}

/**
 * Enrolled layout: the next lesson, front and centre (patterns.md S5.2). It is
 * the first card under the hero and overlaps its rounded bottom.
 */
export function NextSessionCard({ cls, onAddToCalendar }: { cls: ClassDetail; onAddToCalendar: () => void }) {
  const dates = classDateParts(cls);
  const nextSession = cls.nextSession || t("classes.detail.tba");
  return (
    <Surface padding="lg">
      <div className="flex items-start gap-3.5">
        <IconTile icon={CalendarClock} tone="purple" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-[1.6] font-medium text-fg-muted">{t("classes.detail.nextSessionTitle")}</p>
          <p className="t-title-s mt-0.5 text-pretty text-fg">{keepTimesTogether(nextSession)}</p>
          {cls.schedule && cls.schedule !== cls.nextSession ? (
            <p className="mt-1 text-sm leading-[1.6] text-pretty text-fg-muted">{keepTimesTogether(cls.schedule)}</p>
          ) : null}
          {dates.length ? (
            <p className="mt-1 text-sm leading-[1.6] text-fg-muted">
              <ClassDatesLine parts={dates} />
            </p>
          ) : null}
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
          subtitle={keepThaiWords(t("classes.detail.calendarIcsHint"))}
          chevron
        />
        <ListRow
          onClick={handleGoogle}
          leading={<IconTile icon={ExternalLink} tone="blue" />}
          title={t("classes.detail.addToCalendarGoogle")}
          subtitle={keepThaiWords(t("classes.detail.calendarGoogleHint"))}
          chevron
        />
      </ListGroup>
    </BottomSheet>
  );
}
