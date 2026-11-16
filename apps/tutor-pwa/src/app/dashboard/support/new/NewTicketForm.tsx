"use client";

import { Fragment, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ShieldAlert } from "lucide-react";
import {
  Card,
  IconTile,
  Notice,
  SelectField,
  StickyActions,
  TextAreaField,
  TextField,
  cardTapClass,
  toast,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createTicket } from "../actions";
import { categoryTile } from "../components/categoryTile";
import {
  BODY_MAX,
  SUBJECT_MAX,
  TUTOR_TICKET_CATEGORIES,
  bodyHint,
  buildCreateTicketRequest,
  categoryLabel,
  createClientId,
  getSupportErrorMessage,
  validateTicketDraft,
  type SupportClassOption,
  type TicketDraft,
  type TicketDraftErrors,
} from "../lib/support";

export interface NewTicketFormProps {
  classOptions: SupportClassOption[];
  initialCategory?: string;
  initialClassId?: string;
}

const CATEGORY_OPTIONS = TUTOR_TICKET_CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) }));

/**
 * Words in the category labels that the browser's Thai segmentation would
 * otherwise split across two lines in a narrow tile ("ได้|รับ", "ส่วน|ตัว",
 * "ใช้|งาน"), and one phrase kept whole so its last word is not left alone:
 * "ปัญหาการใช้งานแอป" is 1 px wider than a 360 px tile and used to wrap as
 * "ปัญหาการใช้งาน / แอป"; it now wraps as "ปัญหา / การใช้งานแอป" (about 80 px,
 * the 320 px tile holds 95). A longer entry goes before the word it contains.
 */
const KEEP_TOGETHER = ["ได้รับ", "ส่วนตัว", "การใช้งานแอป", "ใช้งาน"];
const KEEP_TOGETHER_PATTERN = new RegExp(`(${KEEP_TOGETHER.join("|")})`);

/** Renders a phrase with each keep-together word in a no-wrap span. The text content is unchanged. */
function keepWordsWhole(phrase: string): ReactNode {
  // split() with a capturing group puts the matched words at the odd indexes.
  return phrase.split(KEEP_TOGETHER_PATTERN).map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * New support ticket. One idempotency key per form instance, so a retry
 * after a timeout (or a double submit) cannot create a second ticket.
 * Layout (patterns.md S13 "New" at tutor sizes): the category as tappable
 * tone tiles (a native radio group), then the details card, then the sticky
 * primary "ส่งคำร้อง".
 */
export function NewTicketForm({ classOptions, initialCategory = "", initialClassId = "" }: NewTicketFormProps) {
  const router = useRouter();
  const categoryRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [idempotencyKey] = useState(createClientId);
  const [form, setForm] = useState<TicketDraft>({ category: initialCategory, classId: initialClassId, subject: "", body: "" });
  const [fieldErrors, setFieldErrors] = useState<TicketDraftErrors>({});
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (field: keyof TicketDraft, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof TicketDraftErrors];
        return next;
      });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const errors = validateTicketDraft(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setErrorText(t("dashboardSupport.fixErrors"));
      if (errors.category) categoryRef.current?.focus();
      else if (errors.subject) subjectRef.current?.focus();
      else bodyRef.current?.focus();
      return;
    }

    setLoading(true);
    setErrorText("");
    try {
      const result = await createTicket(buildCreateTicketRequest(form, idempotencyKey));
      if (result.ok) {
        toast.success(t("dashboardSupport.created"));
        router.replace(`/dashboard/support/${result.ticket.ticketId}`);
        router.refresh();
        return;
      }
      setErrorText(getSupportErrorMessage(result.code));
    } catch {
      setErrorText(getSupportErrorMessage(null));
    }
    setLoading(false);
  };

  const categoryError = fieldErrors.category;

  return (
    <form id="new-ticket-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Notice tone="warning" icon={ShieldAlert} title={t("dashboardSupport.privacyTitle")}>
        {t("dashboardSupport.privacyBody")}
      </Notice>

      <Card as="section">
        {/* Invalid state as the old <select> had it: aria-invalid on the radiogroup (where
            ARIA 1.2 supports it) and the error read on whichever radio takes focus. */}
        <fieldset
          id="ticket-category"
          role="radiogroup"
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? "ticket-category-error" : undefined}
          className="min-w-0"
        >
          <legend className="type-section text-fg">
            {t("dashboardSupport.categoryLabel")}
            <span className="ml-0.5 text-danger-fg" aria-hidden="true">
              *
            </span>
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
            {CATEGORY_OPTIONS.map((option, index) => {
              const tile = categoryTile(option.value);
              const checked = form.category === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex min-h-24 cursor-pointer flex-col items-start gap-2 rounded-(--radius-card) border p-3",
                    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-focus-ring",
                    checked
                      ? "border-brand-fg bg-brand-soft shadow-[inset_0_0_0_1px_var(--brand-fg),0_2px_0_var(--brand-soft-border)]"
                      : categoryError
                        ? cn(cardTapClass, "border-danger-solid")
                        : cardTapClass,
                  )}
                >
                  <input
                    ref={index === 0 ? categoryRef : undefined}
                    type="radio"
                    name="ticket-category"
                    value={option.value}
                    checked={checked}
                    required
                    aria-describedby={categoryError ? "ticket-category-error" : undefined}
                    onChange={() => update("category", option.value)}
                    className="sr-only"
                  />
                  <IconTile icon={tile.icon} tone={tile.tone} />
                  <span className={cn("text-sm leading-[1.6] text-fg", checked ? "font-semibold" : "font-medium")}>
                    {/* Authored break points (patterns.md "Thai text"): the line breaks after a
                        "/" and the short phrase after it stays whole, so "ตาราง|เรียน" or
                        "ลบ|บัญชี" never split. The leading phrase wraps where a tile is narrower
                        than it (320 px), but only between words: keepWordsWhole holds "ได้รับ",
                        "ส่วนตัว" and "การใช้งานแอป" together. The label takes the full tile width; the
                        check mark sits in the icon row above it. Plain inline spans (no <wbr>,
                        no inline-block) keep the radio's accessible name exactly the string. */}
                    {option.label.split("/").map((phrase, i) =>
                      i === 0 ? (
                        <Fragment key={i}>{keepWordsWhole(phrase)}</Fragment>
                      ) : (
                        <Fragment key={i}>
                          /<span className="whitespace-nowrap">{phrase}</span>
                        </Fragment>
                      ),
                    )}
                  </span>
                  {checked ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-brand-solid text-on-brand"
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <div aria-live="polite">
            {categoryError ? (
              <p id="ticket-category-error" className="mt-2.5 flex items-start gap-1.5 text-sm text-danger-fg">
                <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{categoryError}</span>
              </p>
            ) : null}
          </div>
        </fieldset>
      </Card>

      <Card as="section" aria-labelledby="new-ticket-heading">
        <h2 id="new-ticket-heading" className="sr-only">
          {t("dashboardSupport.newTitle")}
        </h2>
        <div className="flex flex-col gap-4">
          {classOptions.length > 0 ? (
            <SelectField
              id="ticket-class"
              label={t("dashboardSupport.classLabel")}
              placeholder={t("dashboardSupport.classPlaceholder")}
              optional
              hint={t("dashboardSupport.classHint")}
              options={classOptions}
              value={form.classId}
              onChange={(event) => update("classId", event.target.value)}
            />
          ) : null}
          <TextField
            ref={subjectRef}
            id="ticket-subject"
            label={t("dashboardSupport.subjectLabel")}
            placeholder={t("dashboardSupport.subjectPlaceholder")}
            required
            maxLength={SUBJECT_MAX}
            value={form.subject}
            error={fieldErrors.subject}
            onChange={(event) => update("subject", event.target.value)}
          />
          <TextAreaField
            ref={bodyRef}
            id="ticket-body"
            label={t("dashboardSupport.bodyLabel")}
            placeholder={t("dashboardSupport.bodyPlaceholder")}
            required
            rows={6}
            maxLength={BODY_MAX}
            hint={bodyHint(form.body.trim().length)}
            value={form.body}
            error={fieldErrors.body}
            onChange={(event) => update("body", event.target.value)}
          />
        </div>
      </Card>

      <StickyActions className="flex-col items-stretch md:flex-row md:items-center">
        {errorText ? (
          <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger-fg md:mr-auto">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{errorText}</span>
          </p>
        ) : null}
        <Button id="btn-submit-ticket" type="submit" size="xl" className="w-full md:w-auto" loading={loading}>
          {loading ? t("dashboardSupport.submitting") : t("dashboardSupport.submit")}
        </Button>
      </StickyActions>
    </form>
  );
}
