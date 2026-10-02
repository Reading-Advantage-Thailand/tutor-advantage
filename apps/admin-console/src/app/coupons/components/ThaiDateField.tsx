"use client";

import { Field, SelectField } from "@/components/app";
import { cn } from "@/lib/utils";
import { formatThaiDate, toBuddhistYear } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  EMPTY_DATE,
  addDaysKey,
  dateKeyToParts,
  daysInMonth,
  isEmptyDate,
  partsToDateKey,
  type ThaiDateParts,
} from "../couponForm";
import "@/locales/th/coupons";

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const PRESETS = [
  { days: 7, label: () => t("coupons.expiryPreset7") },
  { days: 30, label: () => t("coupons.expiryPreset30") },
  { days: 90, label: () => t("coupons.expiryPreset90") },
] as const;

export interface ThaiDateFieldProps {
  label: string;
  value: ThaiDateParts;
  onChange: (value: ThaiDateParts) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Date picker in the Thai calendar: day / Thai month / Buddhist-era year
 * selects (native, so phones get the OS wheel) + quick presets. Replaces
 * <input type="date">, which shows Gregorian "mm/dd/yyyy" to Thai admins.
 */
export function ThaiDateField({ label, value, onChange, error, disabled }: ThaiDateFieldProps) {
  const currentYearBE = toBuddhistYear(Number(addDaysKey(0).slice(0, 4)));
  const years = Array.from({ length: 6 }, (_, index) => currentYearBE + index);
  if (value.yearBE && !years.includes(Number(value.yearBE))) years.unshift(Number(value.yearBE));

  const maxDay =
    value.month && value.yearBE ? daysInMonth(Number(value.month), Number(value.yearBE) - 543) : 31;
  const key = partsToDateKey(value);
  const none = isEmptyDate(value);
  const hint = none
    ? t("coupons.expiryHintNone")
    : key
      ? t("coupons.expiryHintDate", { date: formatThaiDate(`${key}T12:00:00+07:00`, "long") })
      : undefined;

  const set = (patch: Partial<ThaiDateParts>) => {
    const next = { ...value, ...patch };
    // Keep the day valid when the month/year shrinks (31 → 30/28).
    if (next.day && next.month && next.yearBE) {
      const max = daysInMonth(Number(next.month), Number(next.yearBE) - 543);
      if (Number(next.day) > max) next.day = String(max);
    }
    onChange(next);
  };

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition-colors pointer-coarse:h-10",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-solid disabled:opacity-50",
      active
        ? "border-brand-solid bg-brand-soft text-brand-fg"
        : "border-hairline bg-surface text-fg-muted hover:bg-surface-muted hover:text-fg",
    );

  return (
    <Field label={label} optional hint={hint} error={error}>
      {({ id, describedBy }) => (
        <div role="group" aria-label={label} aria-describedby={describedBy} className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={disabled} className={chip(none)} aria-pressed={none} onClick={() => onChange(EMPTY_DATE)}>
              {t("coupons.expiryNone")}
            </button>
            {PRESETS.map((preset) => {
              const presetKey = addDaysKey(preset.days);
              const active = key === presetKey;
              return (
                <button
                  key={preset.days}
                  type="button"
                  disabled={disabled}
                  className={chip(active)}
                  aria-pressed={active}
                  onClick={() => onChange(dateKeyToParts(presetKey))}
                >
                  {preset.label()}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-2">
            <SelectField
              id={id}
              aria-label={t("coupons.expiryDay")}
              placeholder={t("coupons.expiryDay")}
              value={value.day}
              disabled={disabled}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => set({ day: event.target.value })}
              options={Array.from({ length: maxDay }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))}
            />
            <SelectField
              aria-label={t("coupons.expiryMonth")}
              placeholder={t("coupons.expiryMonth")}
              value={value.month}
              disabled={disabled}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => set({ month: event.target.value })}
              options={THAI_MONTHS.map((name, index) => ({ value: String(index + 1), label: name }))}
            />
            <SelectField
              aria-label={t("coupons.expiryYear")}
              placeholder={t("coupons.expiryYear")}
              value={value.yearBE}
              disabled={disabled}
              aria-invalid={Boolean(error) || undefined}
              onChange={(event) => set({ yearBE: event.target.value })}
              options={years.map((year) => ({ value: String(year), label: String(year) }))}
            />
          </div>
        </div>
      )}
    </Field>
  );
}
