"use client";

import { Check, Clock3, X, type LucideIcon } from "lucide-react";
import { t, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AttendanceStatus } from "../attendanceModel";

const OPTIONS: { status: AttendanceStatus; short: I18nKey; full: I18nKey; icon: LucideIcon; selected: string }[] = [
  {
    status: "PRESENT",
    short: "tutorClass.attendance.presentShort",
    full: "tutorClass.attendance.present",
    icon: Check,
    selected: "bg-success-bg font-semibold text-success-fg shadow-[inset_0_0_0_1.5px_var(--success-fg)]",
  },
  {
    status: "LATE",
    short: "tutorClass.attendance.lateShort",
    full: "tutorClass.attendance.late",
    icon: Clock3,
    selected: "bg-warning-bg font-semibold text-warning-fg shadow-[inset_0_0_0_1.5px_var(--warning-fg)]",
  },
  {
    status: "ABSENT",
    short: "tutorClass.attendance.absentShort",
    full: "tutorClass.attendance.absent",
    icon: X,
    selected: "bg-danger-bg font-semibold text-danger-fg shadow-[inset_0_0_0_1.5px_var(--danger-fg)]",
  },
];

/**
 * มา / สาย / ขาด (patterns.md T5): a segmented row of icon + word toggles,
 * full width on phones and inline from md; 44px tall on touch. Toggle
 * buttons rather than a radio group, because "no mark" is a valid state and
 * tapping the selected status clears it.
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
    <div
      role="group"
      aria-label={`${t("tutorClass.attendance.statusLabel")} ${name}`}
      className="flex w-full gap-1 rounded-(--radius-ctl) border border-clay-rim bg-surface-muted p-[3px] md:inline-flex md:w-auto"
    >
      {OPTIONS.map((option) => {
        const selected = value === option.status;
        const Icon = option.icon;
        return (
          <button
            key={option.status}
            type="button"
            aria-pressed={selected}
            aria-label={t(option.full)}
            disabled={disabled}
            onClick={() => onSelect(option.status)}
            className={cn(
              "inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[9px] px-3 text-sm transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-focus-ring disabled:opacity-50 md:flex-none pointer-coarse:h-11 pointer-coarse:min-w-11",
              selected ? option.selected : "font-medium text-fg-muted hover:bg-surface hover:text-fg",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={selected ? 2.6 : 2} />
            {t(option.short)}
          </button>
        );
      })}
    </div>
  );
}
