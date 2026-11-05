"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, ShieldAlert } from "lucide-react";
import { Card, CardHeader, IconTile, Notice, SelectField, StickyActions, TextAreaField, TextField, toast } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { createTicket } from "../actions";
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
 * New support ticket. One idempotency key per form instance, so a retry
 * after a timeout (or a double submit) cannot create a second ticket.
 */
export function NewTicketForm({ classOptions, initialCategory = "", initialClassId = "" }: NewTicketFormProps) {
  const router = useRouter();
  const categoryRef = useRef<HTMLSelectElement>(null);
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

  return (
    <form id="new-ticket-form" onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <Notice tone="warning" icon={ShieldAlert} title={t("dashboardSupport.privacyTitle")}>
        {t("dashboardSupport.privacyBody")}
      </Notice>

      <Card as="section" aria-labelledby="new-ticket-heading">
        <CardHeader
          icon={<IconTile icon={LifeBuoy} size="sm" />}
          title={<span id="new-ticket-heading">{t("dashboardSupport.newTitle")}</span>}
        />
        <div className="flex flex-col gap-4">
          <SelectField
            ref={categoryRef}
            id="ticket-category"
            label={t("dashboardSupport.categoryLabel")}
            placeholder={t("dashboardSupport.categoryPlaceholder")}
            required
            options={CATEGORY_OPTIONS}
            value={form.category}
            error={fieldErrors.category}
            onChange={(event) => update("category", event.target.value)}
          />
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
          <p role="alert" className="text-[0.8125rem] font-medium text-danger-fg md:mr-auto">
            {errorText}
          </p>
        ) : null}
        <Button id="btn-submit-ticket" type="submit" size="lg" className="w-full md:w-auto" loading={loading}>
          {loading ? t("dashboardSupport.submitting") : t("dashboardSupport.submit")}
        </Button>
      </StickyActions>
    </form>
  );
}
