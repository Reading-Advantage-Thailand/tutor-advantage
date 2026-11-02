"use client";

import Link from "next/link";
import { TicketPercent } from "lucide-react";
import { useMemo, useState } from "react";
import { DescriptionList, Money, Notice, SelectField, Sheet, TextField, useAdminSession } from "@/components/app";
import { Button } from "@/components/ui/button";
import { api, errorMessage, newIdempotencyKey } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  CAPACITY_MAX,
  DISPLAY_NAME_MAX,
  EMAIL_MAX,
  EMPTY_CLASS_FORM,
  TITLE_MAX,
  bookLabel,
  discountCodeCreateHref,
  groupBooksByProgram,
  validateCreateClassForm,
  type BookOption,
  type CreateClassBody,
  type CreateClassFormErrors,
  type CreateClassFormValues,
  type CreatedClass,
} from "../classForm";
import "@/locales/th/classes";

export interface CreateClassSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the class was created (refresh the list). */
  onCreated: (created: CreatedClass) => void;
}

const MESSAGES = {
  emailInvalid: t("classes.validation.emailInvalid"),
  displayNameInvalid: t("classes.validation.displayNameInvalid"),
  titleInvalid: t("classes.validation.titleInvalid"),
  bookRequired: t("classes.validation.bookRequired"),
  priceInvalid: t("classes.validation.priceInvalid"),
  capacityInvalid: t("classes.validation.capacityInvalid"),
};

/**
 * "สร้างคลาสให้ครู" in a Sheet: form → review (explains the waiting tutor
 * account) → created (whether an account was created + issue a discount code).
 * The tutor is matched by email; a new email pre-provisions a TUTOR account
 * that the tutor claims by signing in with Google. Mounted with a `key` per
 * opening so state resets; one Idempotency-Key per opening.
 */
export function CreateClassSheet({ open, onOpenChange, onCreated }: CreateClassSheetProps) {
  const me = useAdminSession();
  const [values, setValues] = useState<CreateClassFormValues>(EMPTY_CLASS_FORM);
  const [errors, setErrors] = useState<CreateClassFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<CreateClassBody | null>(null);
  const [created, setCreated] = useState<CreatedClass | null>(null);
  const [idempotencyKey] = useState(newIdempotencyKey);

  const books = useCachedResource(
    me ? `${me.userId}:books` : null,
    () => api.get<{ books: BookOption[] }>("/v1/books"),
    { enabled: open, staleTime: 5 * 60_000 },
  );
  const bookList = useMemo(() => books.data?.books ?? [], [books.data]);
  const grouped = useMemo(() => groupBooksByProgram(bookList), [bookList]);
  const selectedBook = bookList.find((book) => book.bookId === (review?.bookId ?? values.bookId));

  const set = <K extends keyof CreateClassFormValues>(key: K, value: CreateClassFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async (body: CreateClassBody) => {
    setSaving(true);
    setSubmitError(null);
    try {
      const data = await api.post<CreatedClass>("/v1/admin/classes", body, { idempotencyKey });
      setReview(null);
      setCreated(data);
      onCreated(data);
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validateCreateClassForm(values, MESSAGES);
    setErrors(result.errors);
    if (!result.body) return;
    setSubmitError(null);
    setReview(result.body);
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
    const { class: item, tutor } = created;
    const tutorName = tutor.displayName || tutor.email || t("classes.tutorUnnamed");
    title = t("classes.createdTitle");
    description = t("classes.createdDescription");
    footer = (
      <div className={footerRow}>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t("classes.done")}
        </Button>
        <Button asChild>
          <Link href={discountCodeCreateHref(item.classId)}>
            <TicketPercent aria-hidden="true" />
            {t("classes.issueCodeForClass")}
          </Link>
        </Button>
      </div>
    );
    body = (
      <div className="flex flex-col gap-4">
        <Notice
          tone={tutor.created ? "success" : "info"}
          title={tutor.created ? t("classes.createdTutorNew") : t("classes.createdTutorExisting")}
        >
          {[
            tutor.created ? null : t("classes.createdTutorExistingHint", { name: tutorName, email: tutor.email ?? "–" }),
            tutor.pendingRegistration ? t("classes.createdTutorLoginHint", { email: tutor.email ?? "–" }) : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </Notice>
        <DescriptionList
          columns={2}
          items={[
            { label: t("classes.detailTitle"), value: item.title, wide: true },
            { label: t("classes.colTutor"), value: tutorName },
            { label: t("classes.detailBook"), value: item.bookCode ?? item.bookTitle ?? "–" },
            { label: t("classes.detailPrice"), value: <Money satang={item.packagePriceSatang} /> },
            { label: t("classes.detailCapacity"), value: t("classes.capacityValue", { count: formatNumber(item.capacity) }) },
          ]}
        />
      </div>
    );
  } else if (review) {
    title = t("classes.reviewTitle");
    description = t("classes.reviewDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => setReview(null)}>
          {t("classes.reviewBack")}
        </Button>
        <Button type="button" loading={saving} onClick={() => void save(review)}>
          {t("classes.reviewConfirm")}
        </Button>
      </div>
    );
    body = (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-hairline bg-surface-muted p-4">
          <DescriptionList
            columns={2}
            items={[
              { label: t("classes.detailTutorEmail"), value: review.tutorEmail, wide: true },
              { label: t("classes.detailTutorName"), value: review.tutorDisplayName },
              { label: t("classes.detailTitle"), value: review.title },
              { label: t("classes.detailBook"), value: selectedBook ? bookLabel(selectedBook) : "–", wide: true },
              { label: t("classes.detailPrice"), value: <Money satang={review.packagePriceSatang} /> },
              { label: t("classes.detailCapacity"), value: t("classes.capacityValue", { count: formatNumber(review.capacity) }) },
            ]}
          />
        </div>
        <Notice tone="info" title={t("classes.reviewNoticeTitle")}>
          {t("classes.reviewNotice")}
        </Notice>
        {errorBox}
      </div>
    );
  } else {
    title = t("classes.createTitle");
    description = t("classes.createDescription");
    footer = (
      <div className={footerRow}>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
          {t("classes.close")}
        </Button>
        <Button type="submit" form="create-class-form" loading={saving}>
          {t("classes.createSubmit")}
        </Button>
      </div>
    );
    const booksFailed = Boolean(books.error) && !books.data;
    body = (
      <form id="create-class-form" noValidate onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("classes.tutorEmailLabel")}
          required
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          maxLength={EMAIL_MAX}
          disabled={saving}
          value={values.tutorEmail}
          onChange={(event) => set("tutorEmail", event.target.value)}
          placeholder={t("classes.tutorEmailPlaceholder")}
          hint={t("classes.tutorEmailHint")}
          error={errors.tutorEmail}
        />
        <TextField
          label={t("classes.tutorNameLabel")}
          required
          autoComplete="off"
          maxLength={DISPLAY_NAME_MAX}
          disabled={saving}
          value={values.tutorDisplayName}
          onChange={(event) => set("tutorDisplayName", event.target.value)}
          placeholder={t("classes.tutorNamePlaceholder")}
          hint={t("classes.tutorNameHint")}
          error={errors.tutorDisplayName}
        />
        <TextField
          label={t("classes.titleLabel")}
          required
          autoComplete="off"
          maxLength={TITLE_MAX}
          disabled={saving}
          value={values.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder={t("classes.titlePlaceholder")}
          hint={t("classes.titleHint")}
          error={errors.title}
        />
        <div className="flex flex-col gap-1.5">
          <SelectField
            label={t("classes.bookLabel")}
            required
            disabled={saving || !books.data}
            value={values.bookId}
            onChange={(event) => set("bookId", event.target.value)}
            placeholder={books.data ? t("classes.bookPlaceholder") : t("classes.booksLoading")}
            error={errors.bookId ?? (booksFailed ? t("classes.booksError") : undefined)}
          >
            {grouped.reading.length > 0 ? (
              <optgroup label="Reading Advantage">
                {grouped.reading.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {bookLabel(book)}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {grouped.primary.length > 0 ? (
              <optgroup label="Primary Advantage">
                {grouped.primary.map((book) => (
                  <option key={book.bookId} value={book.bookId}>
                    {bookLabel(book)}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </SelectField>
          {booksFailed ? (
            <Button type="button" variant="link" size="sm" className="self-start" onClick={() => void books.refetch()}>
              {t("classes.booksRetry")}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            label={t("classes.priceLabel")}
            required
            inputMode="decimal"
            autoComplete="off"
            disabled={saving}
            value={values.price}
            onChange={(event) => set("price", event.target.value)}
            endAddon={t("classes.priceUnit")}
            hint={t("classes.priceHint")}
            error={errors.price}
          />
          <TextField
            label={t("classes.capacityLabel")}
            required
            inputMode="numeric"
            autoComplete="off"
            disabled={saving}
            value={values.capacity}
            onChange={(event) => set("capacity", event.target.value.replace(/[^\d]/g, ""))}
            endAddon={t("classes.capacityUnit")}
            error={errors.capacity}
            max={CAPACITY_MAX}
          />
        </div>
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
