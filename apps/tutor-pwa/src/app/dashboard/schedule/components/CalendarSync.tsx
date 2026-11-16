"use client";

import { CalendarPlus, CalendarX2, Download } from "lucide-react";
import { CardHeader, IconTile, Surface } from "@/components/app";
import { Button } from "@/components/ui/button";
import { keepTimesTogether } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  buildCancelICSContent,
  buildICSContent,
  downloadTextFile,
  googleCalUrl,
  icsFileName,
  type CalendarExportInput,
} from "../lib/calendar-export";

/**
 * "Add to your calendar": per class (the export is the class's weekly
 * recurrence, so it lives here once instead of on every session row).
 * A card with flat divided rows: class + schedule line, then the two
 * calendar actions side by side and the quiet remove action.
 */
export function CalendarSync({ classes }: { classes: CalendarExportInput[] }) {
  if (classes.length === 0) return null;
  return (
    <Surface padding="none" as="section" aria-labelledby="calendar-sync-title" className="overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        <CardHeader
          className="mb-0"
          id="calendar-sync-title"
          title={t("dashboardSchedule.calendarSyncTitle")}
          description={t("dashboardSchedule.calendarSyncDescription")}
          icon={<IconTile icon={CalendarPlus} tone="purple" />}
        />
      </div>
      <ul className="divide-y divide-hairline border-t border-hairline">
        {classes.map((cls) => (
          <li key={cls.classId} className="flex flex-col gap-2.5 px-4 py-3.5">
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-semibold text-fg" title={cls.title}>
                {cls.title}
              </p>
              {cls.schedule ? (
                <p className="type-body-s text-fg-muted">{keepTimesTogether(cls.schedule)}</p>
              ) : null}
            </div>
            <div
              role="group"
              aria-label={t("dashboardSchedule.calendarActions").replace("{name}", cls.title)}
              className="flex flex-wrap gap-2 lg:gap-1.5"
            >
              <Button
                size="sm"
                variant="outline"
                className="lg:px-2.5"
                onClick={() => downloadTextFile(buildICSContent(cls), icsFileName(cls.title))}
              >
                <Download aria-hidden="true" />
                {t("dashboardSchedule.addToCalendarICS")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="lg:px-2.5"
                render={<a href={googleCalUrl(cls)} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <CalendarPlus aria-hidden="true" />
                {t("dashboardSchedule.addToCalendarGoogle")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger-fg hover:text-danger-fg lg:px-2.5"
                onClick={() => downloadTextFile(buildCancelICSContent(cls), icsFileName(cls.title, true))}
              >
                <CalendarX2 aria-hidden="true" />
                {t("dashboardSchedule.removeFromCalendar")}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
