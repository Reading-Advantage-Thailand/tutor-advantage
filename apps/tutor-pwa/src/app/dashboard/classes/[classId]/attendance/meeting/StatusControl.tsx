"use client";

import { t, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "../attendanceModel";

const OPTIONS: { status: AttendanceStatus; short: I18nKey; full: I18nKey; selected: string }[] = [
  {
    status: "PRESENT",
    short: "tutorClass.attendance.presentShort",
    full: "tutorClass.attendance.present",
    selected: "border-success-fg bg-success-bg font-semibold text-success-fg",
  },
  {
    status: "LATE",
    short: "tutorClass.attendance.lateShort",
    full: "tutorClass.attendance.late",
    selected: "border-warning-fg bg-warning-bg font-semibold text-warning-fg",
  },
  {
    status: "ABSENT",
    short: "tutorClass.attendance.absentShort",
    full: "tutorClass.attendance.absent",
    selected: "border-danger-fg bg-danger-bg font-semibold text-danger-fg",
  },
];

/**
 * มา / สาย / ขาด. Toggle buttons rather than a radio group, because "no mark"
 * is a valid state and tapping the selected status clears it.
 */
export function StatusControl({
  name,
  value,
  disabled,
  onSelect,
}: {
  name: string;
  value: AttendanceStatus | null;
  disabled?: boolean;
  onSelect: (status: AttendanceStatus) => void;
}) {
  return (
    <div role="group" aria-label={`${t("tutorClass.attendance.statusLabel")} ${name}`} className="inline-flex gap-1">
      {OPTIONS.map((option) => {
        const selected = value === option.status;
        return (
          <button
            key={option.status}
            type="button"
            aria-pressed={selected}
            aria-label={t(option.full)}
            disabled={disabled}
            onClick={() => onSelect(option.status)}
            className={cn(
              "h-9 w-10 rounded-lg border text-[0.8125rem] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50 pointer-coarse:h-11",
              selected ? option.selected : "border-hairline-strong bg-surface font-medium text-fg-muted hover:bg-surface-muted",
            )}
          >
            {t(option.short)}
          </button>
        );
      })}
    </div>
  );
}
