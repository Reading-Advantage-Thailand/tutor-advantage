"use client";

import type { ComponentProps } from "react";
import { th } from "date-fns/locale/th";
import { getDefaultClassNames } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { formatThaiMonthYear } from "@/lib/format";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** Mid-month so the Bangkok-based formatter lands in the same month in any timezone. */
function captionDate(month: Date) {
  return new Date(month.getFullYear(), month.getMonth(), 15, 12);
}

/**
 * Thai calendar (Thai weekday/month names, Buddhist-era caption such as
 * "ตุลาคม 2569"). Loaded with next/dynamic by the schedule editor so the
 * day-picker code is not in the page's first load.
 */
export default function ThaiCalendar({ className, classNames, formatters, ...props }: ComponentProps<typeof Calendar>) {
  const defaults = getDefaultClassNames();
  return (
    <Calendar
      locale={th}
      className={cn("w-full bg-transparent p-0 [--cell-size:2.5rem] sm:[--cell-size:2.75rem]", className)}
      classNames={{
        root: cn("w-full", defaults.root),
        month: cn("flex w-full flex-col gap-3", defaults.month),
        caption_label: cn("text-[0.9375rem] font-semibold text-fg select-none", defaults.caption_label),
        weekday: cn("flex-1 text-[0.8125rem] font-normal text-fg-muted select-none", defaults.weekday),
        ...classNames,
      }}
      formatters={{
        formatCaption: (month) => formatThaiMonthYear(captionDate(month)),
        ...formatters,
      }}
      labels={{
        labelPrevious: () => t("tutorClass.schedule.prevMonth"),
        labelNext: () => t("tutorClass.schedule.nextMonth"),
      }}
      {...props}
    />
  );
}
