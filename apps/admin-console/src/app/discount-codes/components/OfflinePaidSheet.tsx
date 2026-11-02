"use client";

import { useState } from "react";
import { DescriptionList, Money, Sheet, TextField } from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, ApiError, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  offlinePaidAttempt,
  offlinePaidEditDefault,
  offlinePaidOf,
  parseOfflinePaidBaht,
  type DiscountCode,
} from "../discountCodeForm";
import "@/locales/th/discountCodes";

export interface OfflinePaidSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The code to change (ACTIVE and not used yet). */
  code: DiscountCode;
  /** After a save, or when the API says the code can no longer change (refresh the list). */
  onChanged: () => void;
}

/**
 * "แก้ยอดที่รับ": the amount the student paid outside the app, per code
 * (PATCH /v1/discount-codes/:id/offline-amount). Only while nobody used the
 * code; the API refuses anything else with OFFLINE_AMOUNT_LOCKED. Mounted with
 * a `key` per opening so the field starts from the code's current amount.
 */
export function OfflinePaidSheet({ open, onOpenChange, code, onChanged }: OfflinePaidSheetProps) {
  const [value, setValue] = useState(() => offlinePaidEditDefault(code));
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A retry of the same amount reuses its Idempotency-Key; another amount gets a new one.
  const [attempt, setAttempt] = useState<{ satang: number; key: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const satang = parseOfflinePaidBaht(value);
    if (satang === null) {
      setError(t("discountCodes.validation.offlinePaid"));
      return;
    }
    const next = offlinePaidAttempt(attempt, satang, newIdempotencyKey);
    setAttempt(next);
    setSaving(true);
    setSubmitError(null);
    try {
      await api.patch<{ discountCode: DiscountCode }>(
        `/v1/discount-codes/${code.discountCodeId}/offline-amount`,
        { offlinePaidSatang: satang },
        { idempotencyKey: next.key },
      );
      toast.success(t("discountCodes.editOfflinePaidSuccess", { code: code.code }));
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(errorMessage(err));
      // Someone used or voided the code meanwhile: show the list as it is now.
      if (err instanceof ApiError && err.code === "OFFLINE_AMOUNT_LOCKED") onChanged();
    } finally {
      setSaving(false);
    }
  };

  const current = offlinePaidOf(code);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      dismissible={!saving}
      width={480}
      title={t("discountCodes.editOfflinePaidTitle", { code: code.code })}
      description={t("discountCodes.editOfflinePaidDescription")}
      footer={
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
            {/* "ปิด", not "ยกเลิก": on this page ยกเลิก means voiding the code. */}
            {t("discountCodes.close")}
          </Button>
          <Button type="submit" form="offline-paid-form" loading={saving}>
            {t("discountCodes.editOfflinePaidSave")}
          </Button>
        </div>
      }
    >
      <form id="offline-paid-form" noValidate onSubmit={save} className="flex flex-col gap-4">
        <div className="rounded-xl border border-hairline bg-surface-muted p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: t("discountCodes.detailClass"), value: code.classTitle ?? t("discountCodes.classUnknown"), wide: true },
              { label: t("discountCodes.detailClassPrice"), value: <Money satang={code.packagePriceSatang} /> },
              {
                label: t("discountCodes.editOfflinePaidCurrent"),
                value:
                  current > 0
                    ? t("discountCodes.offlinePaidValue", { amount: formatSatang(current) })
                    : t("discountCodes.offlinePaidNone"),
              },
            ]}
          />
        </div>
        <TextField
          label={t("discountCodes.offlinePaidLabel")}
          required
          inputMode="decimal"
          autoComplete="off"
          disabled={saving}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          endAddon={t("discountCodes.offlinePaidUnit")}
          hint={t("discountCodes.offlinePaidHint")}
          error={error ?? undefined}
        />
        {submitError ? (
          <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">
            {submitError}
          </p>
        ) : null}
      </form>
    </Sheet>
  );
}
