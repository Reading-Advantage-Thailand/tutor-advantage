"use client";

import { ArrowRight, Check, CheckCircle2, Copy, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton, DescriptionList, Money, Sheet, TextAreaField, TextField } from "@/components/app";
import { toast } from "@/components/app/toastStore";
import { Button } from "@/components/ui/button";
import { api, downloadBlob, errorMessage, newIdempotencyKey } from "@/lib/api";
import { formatNumber, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { EMPTY_DATE } from "../../coupons/couponForm";
import { ThaiDateField } from "../../coupons/components/ThaiDateField";
import { buildCodesCsv, buildCodesText, codesCsvFilename, CSV_MIME } from "../discountCodeExport";
import {
  NOTE_MAX,
  QUANTITY_LIMIT,
  validateDiscountCodeForm,
  type DiscountCode,
  type DiscountCodeCreateBody,
  type DiscountCodeFormErrors,
  type DiscountCodeFormValues,
} from "../discountCodeForm";
import { useClassLookup } from "../useClassLookup";
import { ClassPicker } from "./ClassPicker";
import "@/locales/th/coupons";
import "@/locales/th/discountCodes";

export interface DiscountCodeFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselect this class (deep link from /classes). */
  initialClassId: string | null;
  /** Called after a successful create with the new codes in batch order (refresh the list). */
  onCreated: (codes: DiscountCode[]) => void;
}

const BLANK: DiscountCodeFormValues = { classOption: null, quantity: "1", expiry: EMPTY_DATE, note: "" };

const MESSAGES = {
  classRequired: t("discountCodes.validation.classRequired"),
  classDemo: t("discountCodes.validation.classDemo"),
  quantity: t("discountCodes.validation.quantity"),
  noteTooLong: t("discountCodes.validation.noteTooLong", { max: NOTE_MAX }),
  // Same date picker as coupons, same wording.
  expiryIncomplete: t("coupons.validation.expiryIncomplete"),
  expiryInvalid: t("coupons.validation.expiryInvalid"),
  expiryPast: t("coupons.validation.expiryPast"),
};

function tutorName(tutor: { displayName: string | null; email: string | null } | null | undefined): string {
  if (!tutor) return "–";
  return tutor.displayName || tutor.email || t("discountCodes.tutorUnnamed");
}

/** "คัดลอกทั้งหมด": a labelled button (CopyButton is icon-only) that confirms for a moment. */
function CopyAllButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          toast.error(t("discountCodes.copyAllFailed"));
        }
      }}
    >
      {copied ? <Check aria-hidden="true" className="text-success-fg" /> : <Copy aria-hidden="true" />}
      {copied ? t("shell.copied") : t("discountCodes.copyAll")}
    </Button>
  );
}

/**
 * Issue class discount codes in a Sheet: form → review (class, price ฿X → ฿0,
 * number of codes, expiry) → created (one code + a message to send the
 * student, or a numbered list with copy-all and CSV for a batch). Every code
 * is single-use (one per student), so a forwarded code cannot be reused.
 * Mounted with a `key` per opening so state resets; one Idempotency-Key per
 * opening (and per "ออกโค้ดเพิ่ม").
 */
export function DiscountCodeFormSheet({ open, onOpenChange, initialClassId, onCreated }: DiscountCodeFormSheetProps) {
  const [values, setValues] = useState<DiscountCodeFormValues>(BLANK);
  const [errors, setErrors] = useState<DiscountCodeFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<DiscountCodeCreateBody | null>(null);
  const [created, setCreated] = useState<DiscountCode[] | null>(null);
  // One key per opening: a retry after a network error is the same request.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  // Deep link (?classId=): fill the picker once the class has loaded.
  const lookup = useClassLookup(initialClassId);
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (prefilled || lookup.data === undefined) return;
    setPrefilled(true);
    const found = lookup.data;
    if (found) setValues((current) => (current.classOption ? current : { ...current, classOption: found }));
  }, [lookup.data, prefilled]);
  const preselecting = Boolean(initialClassId) && !prefilled && lookup.isLoading;
  const preselectMissing = Boolean(initialClassId) && prefilled && lookup.data === null && !values.classOption;
  // The lookup failed (network/server): say so instead of silently showing an empty picker.
  const preselectError =
    Boolean(initialClassId) && !prefilled && lookup.error && !values.classOption ? errorMessage(lookup.error) : null;

  const set = <K extends keyof DiscountCodeFormValues>(key: K, value: DiscountCodeFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    const errorKey = key === "classOption" ? "class" : (key as keyof DiscountCodeFormErrors);
    if (errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  const save = async (body: DiscountCodeCreateBody) => {
    setSaving(true);
    setSubmitError(null);
    try {
      const data = await api.post<{ discountCodes: DiscountCode[] }>("/v1/discount-codes/batch", body, { idempotencyKey });
      setReview(null);
      setCreated(data.discountCodes);
      onCreated(data.discountCodes);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateDiscountCodeForm(values, MESSAGES);
    setErrors(result.errors);
    if (!result.body) return;
    setSubmitError(null);
    setReview(result.body);
  };

  // More codes for the same class is the common case (one code per paying student).
  const createAnother = () => {
    setCreated(null);
    setValues((current) => ({ ...BLANK, classOption: current.classOption }));
    setErrors({});
    setIdempotencyKey(newIdempotencyKey());
  };

  const selected = values.classOption;
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
    const first = created[0];
    const classTitle = first?.classTitle ?? selected?.title ?? "";
    const instructionFor = (code: string) => t("discountCodes.instruction", { title: classTitle, code });
    const classItem = { label: t("discountCodes.detailClass"), value: first?.classTitle ?? selected?.title ?? t("discountCodes.classUnknown") };
    const tutorItem = {
      label: t("discountCodes.detailTutor"),
      value: first?.tutorName || first?.tutorEmail || tutorName(selected?.tutor),
    };
    const expiryItem = {
      label: t("discountCodes.detailExpires"),
      value: first?.expiresAt ? formatThaiDate(first.expiresAt, "long") : t("discountCodes.noExpiry"),
    };
    footer = (
      <div className={footerRow}>
        <Button variant="outline" onClick={createAnother}>
          {t("discountCodes.createAnother")}
        </Button>
        <Button onClick={() => onOpenChange(false)}>{t("discountCodes.done")}</Button>
      </div>
    );

    if (created.length === 1 && first) {
      const instruction = instructionFor(first.code);
      title = t("discountCodes.createdTitle");
      description = t("discountCodes.createdDescription");
      body = (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-bg px-4 py-3 text-success-fg">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
            <code className="min-w-0 flex-1 truncate font-mono text-lg font-semibold tracking-wide text-fg">{first.code}</code>
            <CopyButton value={first.code} label={t("discountCodes.copyCode")} />
          </div>
          <DescriptionList
            columns={2}
            items={[
              classItem,
              tutorItem,
              {
                label: t("discountCodes.detailUses"),
                value: t("discountCodes.usesValue", { count: formatNumber(first.maxRedemptions) }),
              },
              expiryItem,
            ]}
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-fg">{t("discountCodes.instructionLabel")}</p>
            <div className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-muted px-3 py-2.5">
              <p className="min-w-0 flex-1 text-sm leading-relaxed break-words text-fg">{instruction}</p>
              <CopyButton value={instruction} label={t("discountCodes.copyInstruction")} />
            </div>
          </div>
        </div>
      );
    } else {
      const downloadCsv = () => {
        const csv = buildCodesCsv(
          created.map((code) => ({ code: code.code, message: instructionFor(code.code) })),
          {
            index: t("discountCodes.csvIndex"),
            code: t("discountCodes.csvCode"),
            sentTo: t("discountCodes.csvSentTo"),
            message: t("discountCodes.csvMessage"),
          },
        );
        downloadBlob(new Blob([csv], { type: CSV_MIME }), codesCsvFilename());
      };
      title = t("discountCodes.createdBatchTitle", { count: formatNumber(created.length) });
      description = t("discountCodes.createdBatchDescription");
      body = (
        <div className="flex flex-col gap-4">
          <DescriptionList
            columns={2}
            items={[
              classItem,
              tutorItem,
              {
                label: t("discountCodes.detailQuantity"),
                value: t("discountCodes.quantityValue", { count: formatNumber(created.length) }),
              },
              expiryItem,
            ]}
          />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg">{t("discountCodes.codesListLabel")}</p>
              <div className="flex flex-wrap gap-2">
                <CopyAllButton value={buildCodesText(created.map((code) => code.code))} />
                <Button size="sm" variant="outline" onClick={downloadCsv}>
                  <Download aria-hidden="true" />
                  {t("discountCodes.downloadCsv")}
                </Button>
              </div>
            </div>
            <ol
              aria-label={t("discountCodes.codesListLabel")}
              className="divide-y divide-hairline rounded-xl border border-hairline bg-surface"
            >
              {created.map((code, index) => (
                <li key={code.discountCodeId} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-8 shrink-0 text-right text-sm text-fg-muted tabular">{index + 1}.</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold tracking-wide text-fg">{code.code}</code>
                  <CopyButton value={code.code} label={t("discountCodes.copyCodeNumbered", { n: index + 1 })} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      );
    }
  } else if (review) {
    title = t("discountCodes.reviewTitle");
    description = t("discountCodes.reviewDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => setReview(null)}>
          {t("discountCodes.reviewBack")}
        </Button>
        <Button type="button" loading={saving} onClick={() => void save(review)}>
          {t("discountCodes.reviewConfirm")}
        </Button>
      </div>
    );
    body = (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-hairline bg-surface-muted p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: t("discountCodes.detailClass"), value: selected?.title ?? "–", wide: true },
              { label: t("discountCodes.detailTutor"), value: tutorName(selected?.tutor) },
              { label: t("discountCodes.detailBook"), value: selected?.bookCode ?? "–" },
              {
                label: t("discountCodes.detailPrice"),
                value: (
                  <span className="inline-flex items-center gap-1.5">
                    <Money satang={selected?.packagePriceSatang ?? null} muted className="line-through" />
                    <ArrowRight aria-hidden="true" className="size-3.5 text-fg-subtle" />
                    <Money satang={0} className="font-semibold text-success-fg" />
                  </span>
                ),
              },
              {
                label: t("discountCodes.detailQuantity"),
                value: t("discountCodes.quantityValue", { count: formatNumber(review.quantity) }),
              },
              {
                label: t("discountCodes.detailExpires"),
                value: review.expiresAt
                  ? t("discountCodes.expiryValue", { date: formatThaiDate(review.expiresAt, "long") })
                  : t("discountCodes.noExpiry"),
              },
              { label: t("discountCodes.noteLabel"), value: review.note ?? "–", wide: true },
            ]}
          />
        </div>
        {errorBox}
      </div>
    );
  } else {
    title = t("discountCodes.createTitle");
    description = t("discountCodes.createDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
          {t("discountCodes.close")}
        </Button>
        <Button type="submit" form="discount-code-form" loading={saving}>
          {t("discountCodes.createSubmit")}
        </Button>
      </div>
    );
    body = (
      <form id="discount-code-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <ClassPicker
          value={values.classOption}
          onChange={(option) => set("classOption", option)}
          disabled={saving}
          error={errors.class}
          loading={preselecting}
          notice={preselectMissing ? t("discountCodes.classMissing") : (preselectError ?? undefined)}
        />
        <TextField
          label={t("discountCodes.quantityLabel")}
          required
          inputMode="numeric"
          disabled={saving}
          value={values.quantity}
          onChange={(event) => set("quantity", event.target.value.replace(/[^\d]/g, ""))}
          endAddon={t("discountCodes.quantityUnit")}
          hint={t("discountCodes.quantityHint")}
          error={errors.quantity}
          max={QUANTITY_LIMIT}
        />
        <ThaiDateField
          label={t("discountCodes.expiryLabel")}
          value={values.expiry}
          onChange={(expiry) => set("expiry", expiry)}
          error={errors.expiry}
          disabled={saving}
          noneHint={t("discountCodes.expiryHintNone")}
        />
        <TextAreaField
          label={t("discountCodes.noteLabel")}
          optional
          rows={3}
          maxLength={NOTE_MAX}
          disabled={saving}
          value={values.note}
          onChange={(event) => set("note", event.target.value)}
          placeholder={t("discountCodes.notePlaceholder")}
          hint={`${t("discountCodes.noteHint")} · ${values.note.length}/${NOTE_MAX}`}
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
