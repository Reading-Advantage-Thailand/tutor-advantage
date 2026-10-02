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
 */
export function CalendarSync({ classes }: { classes: CalendarExportInput[] }) {
  if (classes.length === 0) return null;
  return (
    <Surface padding="none">
      <div className="px-4 pt-4 pb-2">
        <CardHeader
          title={t("dashboardSchedule.calendarSyncTitle")}
          description={t("dashboardSchedule.calendarSyncDescription")}
          icon={<IconTile icon={CalendarPlus} tone="blue" size="sm" />}
        />
      </div>
      <ul className="divide-y divide-hairline">
        {classes.map((cls) => (
          <li key={cls.classId} className="flex flex-col gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{cls.title}</p>
              {cls.schedule ? (
                <p className="text-[0.8125rem] text-fg-muted">{keepTimesTogether(cls.schedule)}</p>
              ) : null}
            </div>
            <div
              role="group"
              aria-label={t("dashboardSchedule.calendarActions").replace("{name}", cls.title)}
              className="flex flex-wrap gap-2"
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadTextFile(buildICSContent(cls), icsFileName(cls.title))}
              >
                <Download aria-hidden="true" />
                {t("dashboardSchedule.addToCalendarICS")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                render={<a href={googleCalUrl(cls)} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <CalendarPlus aria-hidden="true" />
                {t("dashboardSchedule.addToCalendarGoogle")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger-fg hover:text-danger-fg"
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
