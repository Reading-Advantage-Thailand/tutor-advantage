"use client";

import { Suspense, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LifeBuoy, PartyPopper, Send, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  AppBar,
  BottomActionBar,
  IconTile,
  Notice,
  Screen,
  StatusScreen,
  Surface,
  TextArea,
  TextField,
} from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { Button } from "@/components/ui/button";
import { LiffErrorState } from "@/app/dashboard/_components/LiffErrorState";
import { studentApi } from "@/lib/api";
import { mutateResource, peekResource, useCachedResource } from "@/lib/cachedResource";
import { t } from "@/lib/i18n";
import { supportTicketResourceKey, supportTicketsResourceKey } from "@/lib/resourceKeys";
import { enrolledClassesResourceKey, type EnrolledClassesResponse } from "@/lib/schedule";
import { OptionPicker, type PickerOption } from "../_components/OptionPicker";
import { NewRequestSkeleton } from "../_components/SupportSkeletons";
import {
  BODY_MAX,
  PAYMENT_REFERENCE_MAX,
  SUBJECT_MAX,
  buildCreateTicketPayload,
  createUuid,
  getSupportErrorKey,
  hasErrors,
  parseSupportPrefill,
  resolveClassId,
  shouldKeepIdempotencyKey,
  validateSupportForm,
  type SupportFormErrors,
} from "../_lib/form";
import {
  STUDENT_TICKET_CATEGORIES,
  formatTicketNumber,
  getCategoryLabelKey,
  upsertTicketSummary,
  type TicketDetail,
  type TicketResponse,
  type TicketsResponse,
} from "../_lib/tickets";

const FORM_ID = "support-new-form";

const CATEGORY_OPTIONS: PickerOption[] = STUDENT_TICKET_CATEGORIES.map((category) => ({
  value: category,
  label: t(getCategoryLabelKey(category)),
}));

export default function NewSupportRequestPage() {
  return (
    <Suspense fallback={<NewRequestSkeleton />}>
      <NewSupportRequest />
    </Suspense>
  );
}

function NewSupportRequest() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isReady, profile, error: liffError } = useLiff();
  const userId = profile?.userId;

  // Same cache entry as /schedule and the chat list. A failed load only hides the class picker.
  const classesRes = useCachedResource<EnrolledClassesResponse>(
    userId ? enrolledClassesResourceKey(userId) : null,
    () => studentApi.getEnrolledClasses(),
    { enabled: isReady },
  );
  const classes = useMemo(
    () => (classesRes.data?.classes ?? []).filter((item) => item?.id && item?.name),
    [classesRes.data],
  );
  const classOptions: PickerOption[] = useMemo(
    () => [{ value: "", label: t("support.classNone") }, ...classes.map((item) => ({ value: item.id, label: item.name }))],
    [classes],
  );

  const [prefill] = useState(() => parseSupportPrefill(searchParams));
  const [category, setCategory] = useState<string>(prefill.category);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [classId, setClassId] = useState(prefill.classId);
  const [paymentReference, setPaymentReference] = useState(prefill.paymentReference);
  const [errors, setErrors] = useState<SupportFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<TicketDetail | null>(null);

  // One key per submit: a retry after a timeout replays the same request, so a
  // slow network never creates the ticket twice.
  const idempotencyKeyRef = useRef<string | null>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const refRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const values = {
      category,
      subject,
      details,
      classId: resolveClassId(classId, classes.map((item) => item.id)),
      paymentReference,
    };
    const nextErrors = validateSupportForm(values);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) {
      if (nextErrors.category) categoryRef.current?.focus();
      else if (nextErrors.subject) subjectRef.current?.focus();
      else if (nextErrors.details) detailsRef.current?.focus();
      else if (nextErrors.paymentReference) refRef.current?.focus();
      return;
    }

    idempotencyKeyRef.current ??= createUuid();
    setSaving(true);
    try {
      const response = (await studentApi.createSupportTicket(
        buildCreateTicketPayload(values, idempotencyKeyRef.current),
      )) as TicketResponse;
      const ticket = response?.ticket;
      if (!ticket?.ticketId) throw new Error("Ticket missing from response");
      if (userId) {
        mutateResource<TicketResponse>(supportTicketResourceKey(userId, ticket.ticketId), { ticket });
        const listKey = supportTicketsResourceKey(userId);
        const list = upsertTicketSummary(peekResource<TicketsResponse>(listKey), ticket);
        if (list) mutateResource(listKey, list);
      }
      setCreated(ticket);
    } catch (err) {
      console.warn("Failed to create support ticket:", err);
      if (!shouldKeepIdempotencyKey(err)) idempotencyKeyRef.current = null;
      toast.error(t(getSupportErrorKey(err)), { id: "support-create-error" });
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <NewRequestSkeleton />;

  if (liffError || !profile) {
    return (
      <Screen>
        <AppBar title={t("support.newTitle")} back fallbackHref="/support" />
        <LiffErrorState />
      </Screen>
    );
  }

  if (created) {
    return (
      <Screen>
        <AppBar title={t("support.newTitle")} back fallbackHref="/support" onBack={() => router.replace("/support")} />
        <StatusScreen
          icon={PartyPopper}
          mascot="cheer"
          title={t("support.sentTitle")}
          description={`${formatTicketNumber(created.ticketNumber)} · ${t("support.sentDescription")}`}
          primaryAction={
            <Button
              variant="brand"
              size="cta"
              className="w-full"
              onClick={() => router.replace(`/support/${created.ticketId}`)}
            >
              {t("support.viewTicket")}
            </Button>
          }
          secondaryAction={
            <Button variant="ghost" size="touch" className="w-full" onClick={() => router.replace("/support")}>
              {t("support.backToList")}
            </Button>
          }
        />
      </Screen>
    );
  }

  const clearError = (field: keyof SupportFormErrors) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <Screen>
      <AppBar title={t("support.newTitle")} back fallbackHref="/support" />

      <form id={FORM_ID} noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-2 pb-6">
        <Surface tone="brand" className="flex items-start gap-3">
          <IconTile icon={LifeBuoy} tone="blue" size="lg" />
          <p className="min-w-0 text-sm leading-[1.6] text-fg-muted">{t("support.intro")}</p>
        </Surface>

        <Notice
          tone="warning"
          icon={ShieldAlert}
          title={t("support.privacyTitle")}
          description={t("support.privacyDescription")}
        />

        <Surface as="section" className="flex flex-col gap-3">
          <OptionPicker
            name="support-category"
            legend={t("support.categoryLabel")}
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(value) => {
              setCategory(value);
              clearError("category");
            }}
            error={errors.category ? t(errors.category) : undefined}
            firstOptionRef={categoryRef}
          />
        </Surface>

        <Surface as="section" className="flex flex-col gap-4">
          <TextField
            ref={subjectRef}
            label={t("support.subjectLabel")}
            placeholder={t("support.subjectPlaceholder")}
            enterKeyHint="next"
            maxLength={SUBJECT_MAX}
            required
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value);
              clearError("subject");
            }}
            error={errors.subject ? t(errors.subject) : undefined}
          />
          <TextArea
            ref={detailsRef}
            label={t("support.detailsLabel")}
            placeholder={t("support.detailsPlaceholder")}
            hint={t("support.detailsHint")}
            maxLength={BODY_MAX}
            required
            value={details}
            onChange={(event) => {
              setDetails(event.target.value);
              clearError("details");
            }}
            error={errors.details ? t(errors.details) : undefined}
          />
        </Surface>

        {classes.length > 0 ? (
          <Surface as="section" className="flex flex-col gap-3">
            <OptionPicker
              name="support-class"
              legend={t("support.classLabel")}
              options={classOptions}
              value={resolveClassId(classId, classes.map((item) => item.id))}
              onChange={setClassId}
            />
          </Surface>
        ) : null}

        <Surface as="section">
          <TextField
            ref={refRef}
            label={t("support.refLabel")}
            hint={t("support.refHint")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={PAYMENT_REFERENCE_MAX}
            inputClassName="font-mono"
            value={paymentReference}
            onChange={(event) => {
              setPaymentReference(event.target.value);
              clearError("paymentReference");
            }}
            error={errors.paymentReference ? t(errors.paymentReference) : undefined}
          />
        </Surface>
      </form>

      <BottomActionBar>
        <Button type="submit" form={FORM_ID} variant="brand" size="cta" className="flex-1" loading={saving}>
          {saving ? null : <Send aria-hidden="true" />}
          {saving ? t("support.submitting") : t("support.submit")}
        </Button>
      </BottomActionBar>
    </Screen>
  );
}
