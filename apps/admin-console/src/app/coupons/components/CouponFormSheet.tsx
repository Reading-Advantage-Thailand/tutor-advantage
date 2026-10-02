"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { CopyButton, DescriptionList, Sheet, TextAreaField, TextField } from "@/components/app";
import { Button } from "@/components/ui/button";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  EMPTY_DATE,
  HOURS_MAX,
  NOTE_MAX,
  dateKeyToParts,
  expiryIsoToDateKey,
  validateCouponForm,
  type Coupon,
  type CouponFormErrors,
  type CouponFormValues,
} from "../couponForm";
import { ThaiDateField } from "./ThaiDateField";
import { TutorPicker } from "./TutorPicker";

export interface CouponFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new coupon. */
  coupon: Coupon | null;
  /** Called after a successful create/update (refresh the list). */
  onSaved: (coupon: Coupon) => void;
}

const BLANK: CouponFormValues = { hours: "", note: "", tutor: null, expiry: EMPTY_DATE };

function initialValues(coupon: Coupon | null): CouponFormValues {
  if (!coupon) return BLANK;
  return {
    hours: String(coupon.hours),
    note: coupon.note ?? "",
    tutor: coupon.assignedTutorId
      ? { userId: coupon.assignedTutorId, displayName: coupon.assignedTutorName }
      : null,
    expiry: dateKeyToParts(expiryIsoToDateKey(coupon.expiresAt)),
  };
}

const MESSAGES = {
  hoursInteger: t("coupons.validation.hoursInteger"),
  noteTooLong: t("coupons.validation.noteTooLong", { max: NOTE_MAX }),
  expiryIncomplete: t("coupons.validation.expiryIncomplete"),
  expiryInvalid: t("coupons.validation.expiryInvalid"),
  expiryPast: t("coupons.validation.expiryPast"),
};

/**
 * Create / edit a coupon in a Sheet (bottom sheet on phones). Mounted with a
 * `key` per coupon so the form state resets between openings. After a create
 * the sheet shows the new code with a copy button instead of a toast-only code.
 */
export function CouponFormSheet({ open, onOpenChange, coupon, onSaved }: CouponFormSheetProps) {
  const mode = coupon ? "edit" : "create";
  const [values, setValues] = useState<CouponFormValues>(() => initialValues(coupon));
  const [errors, setErrors] = useState<CouponFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Coupon | null>(null);
  // Create is a two-step flow: form → review (confirm hours/tutor/expiry) → created.
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  // One key per form opening: a retry after a network error is the same request.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const set = <K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async (body: Record<string, unknown>) => {
    setSaving(true);
    setSubmitError(null);
    try {
      if (coupon) {
        const data = await api.patch<{ coupon: Coupon }>(`/v1/coupons/${coupon.couponId}`, body, { idempotencyKey });
        onSaved(data.coupon);
        onOpenChange(false);
      } else {
        const data = await api.post<{ coupon: Coupon }>("/v1/coupons", body, { idempotencyKey });
        setReview(null);
        setCreated(data.coupon);
        onSaved(data.coupon);
      }
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateCouponForm(values, MESSAGES, { mode });
    setErrors(result.errors);
    if (!result.body) return;
    setSubmitError(null);
    if (coupon) void save(result.body);
    else setReview(result.body);
  };

  const createAnother = () => {
    setCreated(null);
    setValues(BLANK);
    setErrors({});
    setIdempotencyKey(newIdempotencyKey());
  };

  const footerRow = "flex flex-col-reverse gap-2 md:flex-row md:justify-end";
  const errorBox = submitError ? (
    <p role="alert" className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">
      {submitError}
    </p>
  ) : null;

  // One Sheet for all steps (form → review → created) so it never closes/reopens between them.
  let title: string;
  let description: string;
  let footer: React.ReactNode;
  let body: React.ReactNode;

  if (created) {
    title = t("coupons.createdTitle");
    description = t("coupons.createdDescription");
    footer = (
      <div className={footerRow}>
        <Button variant="outline" onClick={createAnother}>
          {t("coupons.createAnother")}
        </Button>
        <Button onClick={() => onOpenChange(false)}>{t("coupons.done")}</Button>
      </div>
    );
    body = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-bg px-4 py-3 text-success-fg">
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <code className="min-w-0 flex-1 truncate font-mono text-lg font-semibold tracking-wide text-fg">{created.code}</code>
          <CopyButton value={created.code} label={t("coupons.copyCode")} />
        </div>
        <DescriptionList
          columns={2}
          items={[
            { label: t("coupons.detailHours"), value: t("coupons.hoursValue", { hours: created.hours }) },
            {
              label: t("coupons.detailAssigned"),
              value: values.tutor?.displayName || (created.assignedTutorId ? t("coupons.tutorUnnamed") : t("coupons.anyTutor")),
            },
            {
              label: t("coupons.detailExpires"),
              value: created.expiresAt ? formatThaiDate(created.expiresAt, "long") : t("coupons.noExpiry"),
            },
          ]}
        />
      </div>
    );
  } else if (review) {
    const expiresAt = typeof review.expiresAt === "string" ? review.expiresAt : null;
    title = t("coupons.reviewTitle", { hours: Number(review.hours) });
    description = t("coupons.reviewDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => setReview(null)}>
          {t("coupons.reviewBack")}
        </Button>
        <Button type="button" loading={saving} onClick={() => void save(review)}>
          {t("coupons.reviewConfirm", { hours: Number(review.hours) })}
        </Button>
      </div>
    );
    body = (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-hairline bg-surface-muted p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: t("coupons.detailHours"), value: t("coupons.hoursValue", { hours: Number(review.hours) }) },
              {
                label: t("coupons.detailAssigned"),
                value: values.tutor ? values.tutor.displayName || t("coupons.tutorUnnamed") : t("coupons.anyTutor"),
              },
              {
                label: t("coupons.detailExpires"),
                value: expiresAt ? t("coupons.expiryHintDate", { date: formatThaiDate(expiresAt, "long") }) : t("coupons.noExpiry"),
              },
              { label: t("coupons.noteLabel"), value: values.note.trim() || "–" },
            ]}
          />
        </div>
        {errorBox}
      </div>
    );
  } else {
    title = coupon ? t("coupons.editTitle", { code: coupon.code }) : t("coupons.createTitle");
    description = coupon ? t("coupons.editDescription") : t("coupons.createDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
          {t("coupons.close")}
        </Button>
        <Button type="submit" form="coupon-form" loading={saving}>
          {coupon ? t("coupons.editSubmit") : t("coupons.createSubmit")}
        </Button>
      </div>
    );
    body = (
      <form id="coupon-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("coupons.hoursLabel")}
          required={!coupon}
          inputMode="numeric"
          autoFocus={!coupon}
          disabled={Boolean(coupon) || saving}
          value={values.hours}
          onChange={(event) => set("hours", event.target.value.replace(/[^\d]/g, ""))}
          endAddon={t("coupons.hoursUnit")}
          placeholder={t("coupons.hoursPlaceholder")}
          hint={t("coupons.hoursHint")}
          error={errors.hours}
          max={HOURS_MAX}
        />
        <TutorPicker value={values.tutor} onChange={(tutor) => set("tutor", tutor)} disabled={saving} />
        <ThaiDateField
          label={t("coupons.expiryLabel")}
          value={values.expiry}
          onChange={(expiry) => set("expiry", expiry)}
          error={errors.expiry}
          disabled={saving}
        />
        <TextAreaField
          label={t("coupons.noteLabel")}
          optional
          rows={3}
          maxLength={NOTE_MAX}
          disabled={saving}
          value={values.note}
          onChange={(event) => set("note", event.target.value)}
          placeholder={t("coupons.notePlaceholder")}
          hint={`${t("coupons.noteHint")} · ${values.note.length}/${NOTE_MAX}`}
          error={errors.note}
        />
        {errorBox}
      </form>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
      dismissible={!saving}
      title={title}
      description={description}
      footer={footer}
    >
      {body}
    </Sheet>
  );
}
