"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload } from "lucide-react";
import {
  CardHeader,
  Field,
  Notice,
  SegmentedControl,
  SelectField,
  StickyActions,
  Surface,
  TextAreaField,
  TextField,
  toast,
} from "@/components/app";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  saveTaxInfoAction,
  submitVerificationAction,
  submitWorkPermitAction,
  uploadFileAction,
  type VerificationActionResult,
} from "../../actions";
import { nationalityOptions } from "../lib/countries";
import {
  ACCEPTED_DOCUMENT_TYPES,
  BANK_BRANDS,
  bangkokToday,
  canSubmitAddress,
  digitsOnly,
  getRejectionComment,
  isFutureDate,
  isPdfFile,
  isPdfUrl,
  isTaxInfoChanged,
  isValidPassportNumber,
  sanitizeDigitsAndDashes,
  validateBankDraft,
  validateTaxInfoDraft,
  type IdType,
  type SettingsUser,
  type TaxInfoDraft,
  type TeachingLocation,
  type VerificationField,
} from "../lib/verification";
import { FieldStatusChip } from "./FieldStatusChip";

type DocField = "idCard" | "bankBook" | "address";

const SERVER_ERRORS: Record<string, string> = {
  INVALID_THAI_ID: t("dashboardSettings.serverError_INVALID_THAI_ID"),
  INVALID_PASSPORT_NUMBER: t("dashboardSettings.serverError_INVALID_PASSPORT_NUMBER"),
  INVALID_NATIONALITY: t("dashboardSettings.serverError_INVALID_NATIONALITY"),
  PASSPORT_EXPIRED: t("dashboardSettings.serverError_PASSPORT_EXPIRED"),
  INVALID_WORK_PERMIT: t("dashboardSettings.serverError_INVALID_WORK_PERMIT"),
  PASSPORT_UNAVAILABLE: t("dashboardSettings.serverError_PASSPORT_UNAVAILABLE"),
  PRIVACY_NOTICE_REQUIRED: t("dashboardSettings.privacyNoticeRequired"),
  RIGHT_TO_WORK_REQUIRED: t("dashboardSettings.rightToWorkRequired"),
  INVALID_TEACHING_LOCATION: t("dashboardSettings.teachingLocationRequired"),
};

function serverErrorMessage(result: VerificationActionResult, fallback: string): string | null {
  if (result.ok) return null;
  return SERVER_ERRORS[result.code] ?? fallback;
}

/* ─── Building blocks ─────────────────────────────────────────────────── */

function ConsentCheckbox({
  id,
  checked,
  disabled,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm text-fg">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span>{children}</span>
    </label>
  );
}

function StepCard({
  user,
  field,
  title,
  description,
  children,
  footer,
}: {
  user: SettingsUser;
  field: VerificationField;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const comment = getRejectionComment(user, field);
  return (
    <Surface padding="md" as="section" aria-label={title}>
      <CardHeader title={title} description={description} action={<FieldStatusChip user={user} field={field} />} />
      <div className="flex flex-col gap-4">
        {comment ? (
          <Notice tone="danger" title={t("dashboardSettings.rejectReason")}>
            {comment}
          </Notice>
        ) : null}
        {children}
      </div>
      <div className="mt-4 flex justify-end border-t border-hairline pt-4">{footer}</div>
    </Surface>
  );
}

/** Keyboard-accessible file picker with preview (label wraps a visually hidden input). */
function FilePicker({
  id,
  label,
  hint,
  error,
  file,
  previewUrl,
  submittedUrl,
  disabled,
  onSelect,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  file: File | null;
  previewUrl: string | null;
  submittedUrl: string | null;
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  const shownUrl = previewUrl ?? submittedUrl;
  const showPdf = previewUrl ? isPdfFile(file) : isPdfUrl(submittedUrl);
  return (
    <Field id={id} label={label} hint={hint} error={error ?? undefined}>
      {({ id: inputId, describedBy, invalid }) => (
        <label
          htmlFor={inputId}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center",
            "focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-ring/40 hover:bg-surface-muted",
            previewUrl ? "border-brand-soft-border bg-brand-soft/40" : invalid ? "border-danger-border" : "border-hairline-strong",
            disabled && "pointer-events-none opacity-60",
          )}
        >
          {shownUrl && !showPdf ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shownUrl}
              alt={previewUrl ? t("dashboardSettings.previewAlt") : t("dashboardSettings.uploadedAlt")}
              className="aspect-video w-full max-w-md rounded-md object-contain"
            />
          ) : shownUrl ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium text-fg">
              <FileText aria-hidden="true" className="size-5" />
              {file?.name ?? t("dashboardSettings.pdfSelected")}
            </span>
          ) : (
            <Upload aria-hidden="true" className="size-7 text-fg-subtle" />
          )}
          <span className="text-[0.8125rem] text-fg-muted">
            {previewUrl
              ? t("dashboardSettings.selectedFilePendingUpload")
              : submittedUrl
                ? t("dashboardSettings.uploadedImage")
                : t("dashboardSettings.fileDropHint")}
          </span>
          <span className="inline-flex h-8 items-center rounded-lg border border-field-border bg-surface px-3 text-sm font-medium text-fg group-hover:bg-press">
            {shownUrl ? t("dashboardSettings.changeFile") : t("dashboardSettings.chooseFile")}
          </span>
          <input
            id={inputId}
            type="file"
            className="sr-only"
            accept={ACCEPTED_DOCUMENT_TYPES}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) onSelect(selected);
            }}
          />
        </label>
      )}
    </Field>
  );
}

/* ─── Forms ───────────────────────────────────────────────────────────── */

/**
 * Edit forms for the four verification steps. Each step is submitted on its
 * own (separate review per document), exactly as before; the sticky bar on
 * the bottom submits every step that is ready, in order.
 */
export function VerificationForms({ user, onCancelEdit }: { user: SettingsUser; onCancelEdit?: () => void }) {
  const router = useRouter();
  const settings = user.settings ?? {};
  const [activeField, setActiveField] = useState<DocField | null>(null);

  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankBookFile, setBankBookFile] = useState<File | null>(null);
  const [idCardPreview, setIdCardPreview] = useState<string | null>(null);
  const [bankBookPreview, setBankBookPreview] = useState<string | null>(null);
  const [submittedIdCardUrl, setSubmittedIdCardUrl] = useState<string | null>(user.idCardImageUrl || null);
  const [submittedBankBookUrl, setSubmittedBankBookUrl] = useState<string | null>(user.bankBookImageUrl || null);
  const [address, setAddress] = useState<string>(settings.address || "");
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(settings.bankAccountNumber || "");
  const [bankBrand, setBankBrand] = useState<string>(settings.bankBrand || "");
  const [idCardError, setIdCardError] = useState<string | null>(null);
  const [bankBookError, setBankBookError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const identity = user.identity ?? {};
  const [taxName, setTaxName] = useState<string>(settings.taxName || "");
  const [nationalId, setNationalId] = useState<string>(settings.nationalId || "");
  const [idType, setIdType] = useState<IdType>(identity.idType ?? "THAI_ID");
  // The saved passport number is never sent to the browser; it is re-entered to change it.
  const [passportNumber, setPassportNumber] = useState("");
  const [passportNationality, setPassportNationality] = useState<string>(identity.passportNationality || "");
  const [passportExpiresOn, setPassportExpiresOn] = useState<string>(identity.passportExpiresOn || "");
  const [teachingLocation, setTeachingLocation] = useState<TeachingLocation | "">(identity.teachingLocation || "");
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [rightToWorkConfirmed, setRightToWorkConfirmed] = useState(Boolean(identity.rightToWorkConfirmedAt));
  const [taxInfoSaved, setTaxInfoSaved] = useState(false);
  const [taxInfoPending, setTaxInfoPending] = useState(false);
  const [taxInfoError, setTaxInfoError] = useState<string | null>(null);
  const [workPermitFile, setWorkPermitFile] = useState<File | null>(null);
  const [workPermitPreview, setWorkPermitPreview] = useState<string | null>(null);
  const [submittedWorkPermitUrl, setSubmittedWorkPermitUrl] = useState<string | null>(identity.workPermitImageUrl || null);
  const [workPermitExpiresOn, setWorkPermitExpiresOn] = useState<string>(identity.workPermitExpiresOn || "");
  const [workPermitError, setWorkPermitError] = useState<string | null>(null);
  const [workPermitPending, setWorkPermitPending] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const isPassport = idType === "PASSPORT";
  const needsWorkPermit = isPassport && teachingLocation === "THAILAND";

  // Keep in sync with fresh server data after router.refresh().
  useEffect(() => {
    setSubmittedIdCardUrl(user.idCardImageUrl || null);
    setSubmittedBankBookUrl(user.bankBookImageUrl || null);
    if (user.settings?.address) setAddress(user.settings.address);
    if (user.settings?.bankAccountNumber) setBankAccountNumber(user.settings.bankAccountNumber);
    if (user.settings?.bankBrand) setBankBrand(user.settings.bankBrand);
    if (user.settings?.taxName) setTaxName(user.settings.taxName);
    if (user.settings?.nationalId) setNationalId(user.settings.nationalId);
    setSubmittedWorkPermitUrl(user.identity?.workPermitImageUrl || null);
    if (user.identity?.idType) setIdType(user.identity.idType);
    if (user.identity?.passportNationality) setPassportNationality(user.identity.passportNationality);
    if (user.identity?.passportExpiresOn) setPassportExpiresOn(user.identity.passportExpiresOn);
    if (user.identity?.teachingLocation) setTeachingLocation(user.identity.teachingLocation);
    if (user.identity?.workPermitExpiresOn) setWorkPermitExpiresOn(user.identity.workPermitExpiresOn);
  }, [user]);

  // Release object URLs of replaced previews.
  const previewsRef = useRef<string[]>([]);
  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const makePreview = (file: File) => {
    const url = URL.createObjectURL(file);
    previewsRef.current.push(url);
    return url;
  };

  const isPending = activeField !== null;
  const busy = isPending || taxInfoPending || workPermitPending || savingAll;

  const setFieldError = (field: DocField, msg: string | null) => {
    if (field === "idCard") setIdCardError(msg);
    else if (field === "bankBook") setBankBookError(msg);
    else setAddressError(msg);
  };

  /** Validates and submits one document step. Resolves true on success. */
  const submitField = async (field: DocField): Promise<boolean> => {
    setFieldError(field, null);
    if (field === "idCard" && !idCardFile) {
      setIdCardError(t("dashboardSettings.selectIdCardFile"));
      return false;
    }
    if (field === "bankBook") {
      const problem = validateBankDraft({ file: bankBookFile, accountNumber: bankAccountNumber, brand: bankBrand });
      if (problem) {
        setBankBookError(t(`dashboardSettings.${problem}`));
        return false;
      }
    }
    if (field === "address" && !address.trim()) {
      setAddressError(t("dashboardSettings.addressRequired"));
      return false;
    }

    setActiveField(field);
    try {
      let idCardUrl: string | undefined;
      let bankBookUrl: string | undefined;
      let addr: string | undefined;

      if (field === "idCard" && idCardFile) {
        const formData = new FormData();
        formData.append("file", idCardFile);
        const uploadResult = await uploadFileAction(formData);
        if (!uploadResult.success) throw new Error(uploadResult.error);
        idCardUrl = uploadResult.objectKey;
      } else if (field === "bankBook" && bankBookFile) {
        const formData = new FormData();
        formData.append("file", bankBookFile);
        const uploadResult = await uploadFileAction(formData);
        if (!uploadResult.success) throw new Error(uploadResult.error);
        bankBookUrl = uploadResult.objectKey;
      } else if (field === "address") {
        addr = address.trim();
      }

      await submitVerificationAction(
        idCardUrl,
        bankBookUrl,
        addr,
        field === "bankBook" ? digitsOnly(bankAccountNumber) : undefined,
        field === "bankBook" ? bankBrand : undefined,
      );

      if (field === "idCard") {
        if (idCardPreview) setSubmittedIdCardUrl(idCardPreview);
        setIdCardFile(null);
        setIdCardPreview(null);
      }
      if (field === "bankBook") {
        if (bankBookPreview) setSubmittedBankBookUrl(bankBookPreview);
        setBankBookFile(null);
        setBankBookPreview(null);
      }
      router.refresh();
      return true;
    } catch (err) {
      setFieldError(field, err instanceof Error && err.message ? err.message : t("dashboardSettings.submitDocumentsFailed"));
      return false;
    } finally {
      setActiveField(null);
    }
  };

  const submitOne = async (field: DocField) => {
    if (await submitField(field)) toast.success(t("dashboardSettings.submitSuccess"));
  };

  const taxDraft: TaxInfoDraft = {
    idType,
    taxName,
    nationalId,
    passportNumber,
    passportNationality,
    passportExpiresOn,
    teachingLocation,
    privacyNoticeAccepted,
    rightToWorkConfirmed,
  };
  const taxProblem = validateTaxInfoDraft(taxDraft);
  const taxInfoValid = taxProblem === null;
  const taxInfoDirty = !taxInfoSaved && isTaxInfoChanged(user, taxDraft);

  const submitTaxInfo = async (): Promise<boolean> => {
    if (!taxInfoValid) return false;
    setTaxInfoPending(true);
    setTaxInfoError(null);
    try {
      const result = await saveTaxInfoAction({
        idType,
        taxName,
        nationalId,
        passportNumber,
        passportNationality,
        passportExpiresOn,
        teachingLocation: teachingLocation || undefined,
        privacyNoticeAccepted,
        rightToWorkConfirmed,
      });
      const message = serverErrorMessage(result, t("dashboardSettings.taxInfoFailed"));
      if (message) {
        setTaxInfoError(message);
        return false;
      }
      setTaxInfoSaved(true);
      setPassportNumber("");
      router.refresh();
      return true;
    } catch {
      setTaxInfoError(t("dashboardSettings.taxInfoFailed"));
      return false;
    } finally {
      setTaxInfoPending(false);
    }
  };

  const workPermitReady = needsWorkPermit && Boolean(workPermitFile) && isFutureDate(workPermitExpiresOn);

  const submitWorkPermit = async (): Promise<boolean> => {
    setWorkPermitError(null);
    if (!workPermitFile) {
      setWorkPermitError(t("dashboardSettings.selectWorkPermitFile"));
      return false;
    }
    if (!isFutureDate(workPermitExpiresOn)) {
      setWorkPermitError(t("dashboardSettings.passportExpiryInvalid"));
      return false;
    }
    // The server accepts a work permit only once the passport + "teaching
    // from Thailand" answer is saved, so send unsaved identity info first.
    if (!user.identity?.workPermitRequired || taxInfoDirty) {
      if (!(await submitTaxInfo())) {
        setWorkPermitError(t("dashboardSettings.taxInfoFailed"));
        return false;
      }
    }
    setWorkPermitPending(true);
    try {
      const formData = new FormData();
      formData.append("file", workPermitFile);
      const upload = await uploadFileAction(formData);
      if (!upload.success || !upload.objectKey) throw new Error(upload.error);
      const result = await submitWorkPermitAction(upload.objectKey, workPermitExpiresOn);
      const message = serverErrorMessage(result, t("dashboardSettings.submitDocumentsFailed"));
      if (message) {
        setWorkPermitError(message);
        return false;
      }
      if (workPermitPreview) setSubmittedWorkPermitUrl(workPermitPreview);
      setWorkPermitFile(null);
      setWorkPermitPreview(null);
      router.refresh();
      return true;
    } catch (err) {
      setWorkPermitError(err instanceof Error && err.message ? err.message : t("dashboardSettings.submitDocumentsFailed"));
      return false;
    } finally {
      setWorkPermitPending(false);
    }
  };

  const nationalIdDigits = digitsOnly(nationalId).length;
  const ready = {
    idCard: Boolean(idCardFile),
    bankBook: validateBankDraft({ file: bankBookFile, accountNumber: bankAccountNumber, brand: bankBrand }) === null,
    address: canSubmitAddress(address, settings.address),
    taxInfo: taxInfoValid && taxInfoDirty,
    workPermit: workPermitReady,
  };
  const readyCount = Object.values(ready).filter(Boolean).length;

  const saveAll = async () => {
    setSavingAll(true);
    let ok = true;
    try {
      for (const field of ["idCard", "bankBook", "address"] as const) {
        if (ready[field]) ok = (await submitField(field)) && ok;
      }
      // Identity before the work permit: the permit needs the saved passport answer.
      if (ready.taxInfo) ok = (await submitTaxInfo()) && ok;
      if (ready.workPermit) ok = (await submitWorkPermit()) && ok;
    } finally {
      setSavingAll(false);
    }
    if (ok) toast.success(t("dashboardSettings.submitSuccess"));
  };

  const taxFieldError = (problem: typeof taxProblem, shown: boolean) =>
    shown && taxProblem === problem ? t(`dashboardSettings.${problem}` as "dashboardSettings.taxNameRequired") : undefined;

  return (
    <div className="flex flex-col gap-3">
      {onCancelEdit ? (
        <Notice
          tone="warning"
          action={
            <Button variant="outline" size="sm" onClick={onCancelEdit} disabled={busy}>
              {t("dashboardSettings.cancelEdit")}
            </Button>
          }
        >
          {t("dashboardSettings.editVerificationWarning")}
        </Notice>
      ) : null}

      {/* 1. ID card / passport photo page */}
      <StepCard
        user={user}
        field="idCard"
        title={isPassport ? t("dashboardSettings.passportStep") : t("dashboardSettings.idCardStep")}
        footer={
          <Button
            onClick={() => void submitOne("idCard")}
            disabled={!idCardFile || busy}
            loading={activeField === "idCard"}
            className="w-full sm:w-auto"
          >
            {activeField === "idCard" ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadIdCard")}
          </Button>
        }
      >
        <FilePicker
          id="id-card-input"
          label={isPassport ? t("dashboardSettings.idTypePassport") : t("dashboardSettings.idCard")}
          hint={isPassport ? t("dashboardSettings.passportHint") : t("dashboardSettings.idCardHint")}
          error={idCardError}
          file={idCardFile}
          previewUrl={idCardPreview}
          submittedUrl={submittedIdCardUrl}
          disabled={busy}
          onSelect={(file) => {
            setIdCardFile(file);
            setIdCardPreview(makePreview(file));
            setIdCardError(null);
          }}
        />
      </StepCard>

      {/* 2. Bank account */}
      <StepCard
        user={user}
        field="bankBook"
        title={t("dashboardSettings.bankBookStep")}
        footer={
          <Button
            onClick={() => void submitOne("bankBook")}
            disabled={!ready.bankBook || busy}
            loading={activeField === "bankBook"}
            className="w-full sm:w-auto"
          >
            {activeField === "bankBook" ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadBankBook")}
          </Button>
        }
      >
        {isPassport ? <Notice tone="info">{t("dashboardSettings.bankNameMustMatchId")}</Notice> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            id="bank-brand"
            label={t("dashboardSettings.bankBrandField")}
            placeholder={t("dashboardSettings.bankBrandPlaceholder")}
            options={BANK_BRANDS}
            value={bankBrand}
            onChange={(event) => setBankBrand(event.target.value)}
            disabled={busy}
            required
          />
          <TextField
            id="bank-account-number"
            label={t("dashboardSettings.bankAccountNumber")}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t("dashboardSettings.bankAccountNumberPlaceholder")}
            value={bankAccountNumber}
            onChange={(event) => setBankAccountNumber(sanitizeDigitsAndDashes(event.target.value))}
            disabled={busy}
            required
          />
        </div>
        <FilePicker
          id="bank-book-input"
          label={t("dashboardSettings.bankBook")}
          hint={t("dashboardSettings.bankBookHint")}
          error={bankBookError}
          file={bankBookFile}
          previewUrl={bankBookPreview}
          submittedUrl={submittedBankBookUrl}
          disabled={busy}
          onSelect={(file) => {
            setBankBookFile(file);
            setBankBookPreview(makePreview(file));
            setBankBookError(null);
          }}
        />
      </StepCard>

      {/* 3. Address */}
      <StepCard
        user={user}
        field="address"
        title={t("dashboardSettings.addressStep")}
        footer={
          <Button
            onClick={() => void submitOne("address")}
            disabled={!ready.address || busy}
            loading={activeField === "address"}
            className="w-full sm:w-auto"
          >
            {activeField === "address" ? t("dashboardSettings.saving") : t("dashboardSettings.saveAddress")}
          </Button>
        }
      >
        <TextAreaField
          id="address"
          label={t("dashboardSettings.address")}
          hint={t("dashboardSettings.addressHint")}
          error={addressError ?? undefined}
          placeholder={t("dashboardSettings.fullAddressPlaceholder")}
          autoComplete="street-address"
          rows={3}
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          disabled={busy}
          required
        />
      </StepCard>

      {/* 4. Identity document + tax info */}
      <StepCard
        user={user}
        field="taxInfo"
        title={isPassport ? t("dashboardSettings.passportTaxInfoStep") : t("dashboardSettings.taxInfoStep")}
        description={isPassport ? t("dashboardSettings.passportTaxInfoHint") : t("dashboardSettings.taxInfoHint")}
        footer={
          <Button
            variant={taxInfoSaved ? "soft" : "default"}
            onClick={() => void submitTaxInfo()}
            disabled={!taxInfoValid || busy}
            loading={taxInfoPending}
            className="w-full sm:w-auto"
          >
            {taxInfoPending
              ? t("dashboardSettings.savingTaxInfo")
              : taxInfoSaved
                ? t("dashboardSettings.taxInfoSubmitted")
                : t("dashboardSettings.saveTaxInfo")}
          </Button>
        }
      >
        {taxInfoError ? <Notice tone="danger">{taxInfoError}</Notice> : null}
        <Field id="id-type" label={t("dashboardSettings.idTypeLabel")}>
          {() => (
            <SegmentedControl<IdType>
              aria-label={t("dashboardSettings.idTypeLabel")}
              fullWidth
              value={idType}
              onValueChange={(value) => {
                setIdType(value);
                setTaxInfoSaved(false);
              }}
              items={[
                { value: "THAI_ID", label: t("dashboardSettings.idTypeThaiId"), disabled: busy },
                { value: "PASSPORT", label: t("dashboardSettings.idTypePassport"), disabled: busy },
              ]}
            />
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="tax-name"
            label={isPassport ? t("dashboardSettings.passportNameLabel") : t("dashboardSettings.taxNameLabel")}
            placeholder={isPassport ? "John Smith" : t("dashboardSettings.taxNamePlaceholder")}
            autoComplete="name"
            value={taxName}
            onChange={(event) => {
              setTaxName(event.target.value);
              setTaxInfoSaved(false);
            }}
            disabled={busy}
            required
          />
          {isPassport ? (
            <TextField
              id="passport-number"
              label={t("dashboardSettings.passportNumberLabel")}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={identity.passportNumberMasked || t("dashboardSettings.passportNumberPlaceholder")}
              value={passportNumber}
              error={passportNumber && !isValidPassportNumber(passportNumber) ? t("dashboardSettings.passportNumberInvalid") : undefined}
              hint={identity.passportNumberMasked && !passportNumber ? t("dashboardSettings.passportNumberKeep") : undefined}
              onChange={(event) => {
                setPassportNumber(event.target.value.toUpperCase());
                setTaxInfoSaved(false);
              }}
              disabled={busy}
              required
            />
          ) : (
            <TextField
              id="national-id"
              label={t("dashboardSettings.nationalIdLabel")}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t("dashboardSettings.nationalIdPlaceholder")}
              value={nationalId}
              error={
                nationalIdDigits > 13 || (nationalIdDigits === 13 && taxProblem === "nationalIdInvalid")
                  ? t("dashboardSettings.nationalIdInvalid")
                  : undefined
              }
              hint={nationalIdDigits > 0 && nationalIdDigits < 13 ? `${nationalIdDigits} / 13` : undefined}
              onChange={(event) => {
                setNationalId(sanitizeDigitsAndDashes(event.target.value));
                setTaxInfoSaved(false);
              }}
              disabled={busy}
              required
            />
          )}
        </div>
        {isPassport ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                id="passport-nationality"
                label={t("dashboardSettings.nationalityLabel")}
                placeholder={t("dashboardSettings.nationalityPlaceholder")}
                options={nationalityOptions()}
                value={passportNationality}
                onChange={(event) => {
                  setPassportNationality(event.target.value);
                  setTaxInfoSaved(false);
                }}
                disabled={busy}
                required
              />
              <TextField
                id="passport-expiry"
                type="date"
                label={t("dashboardSettings.passportExpiryLabel")}
                min={bangkokToday()}
                value={passportExpiresOn}
                error={taxFieldError("passportExpiryInvalid", Boolean(passportExpiresOn))}
                onChange={(event) => {
                  setPassportExpiresOn(event.target.value);
                  setTaxInfoSaved(false);
                }}
                disabled={busy}
                required
              />
            </div>
            <Field id="teaching-location" label={t("dashboardSettings.teachingLocationLabel")} hint={t("dashboardSettings.teachingFromThailandHint")}>
              {() => (
                <SegmentedControl<TeachingLocation>
                  aria-label={t("dashboardSettings.teachingLocationLabel")}
                  fullWidth
                  value={(teachingLocation || "") as TeachingLocation}
                  onValueChange={(value) => {
                    setTeachingLocation(value);
                    setTaxInfoSaved(false);
                  }}
                  items={[
                    { value: "THAILAND", label: t("dashboardSettings.teachingFromThailand"), disabled: busy },
                    { value: "ABROAD", label: t("dashboardSettings.teachingFromAbroad"), disabled: busy },
                  ]}
                />
              )}
            </Field>
            <div className="flex flex-col gap-3 rounded-lg border border-hairline p-3">
              <p className="text-[0.8125rem] text-fg-muted">{t("dashboardSettings.privacyNoticeBody")}</p>
              <ConsentCheckbox
                id="privacy-notice-consent"
                checked={privacyNoticeAccepted}
                disabled={busy}
                onChange={(value) => {
                  setPrivacyNoticeAccepted(value);
                  setTaxInfoSaved(false);
                }}
              >
                {t("dashboardSettings.privacyNoticeConsent")}
              </ConsentCheckbox>
              <ConsentCheckbox
                id="right-to-work-consent"
                checked={rightToWorkConfirmed}
                disabled={busy}
                onChange={(value) => {
                  setRightToWorkConfirmed(value);
                  setTaxInfoSaved(false);
                }}
              >
                {t("dashboardSettings.rightToWorkConsent")}
              </ConsentCheckbox>
            </div>
          </>
        ) : null}
      </StepCard>

      {/* 5. Work permit (passport holders teaching from Thailand) */}
      {needsWorkPermit ? (
        <StepCard
          user={user}
          field="workPermit"
          title={t("dashboardSettings.workPermitStep")}
          footer={
            <Button
              onClick={() => void submitWorkPermit().then((ok) => ok && toast.success(t("dashboardSettings.submitSuccess")))}
              disabled={!workPermitReady || (!user.identity?.workPermitRequired && !taxInfoValid) || busy}
              loading={workPermitPending}
              className="w-full sm:w-auto"
            >
              {workPermitPending ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadWorkPermit")}
            </Button>
          }
        >
          <TextField
            id="work-permit-expiry"
            type="date"
            label={t("dashboardSettings.workPermitExpiryLabel")}
            min={bangkokToday()}
            value={workPermitExpiresOn}
            error={workPermitExpiresOn && !isFutureDate(workPermitExpiresOn) ? t("dashboardSettings.passportExpiryInvalid") : undefined}
            onChange={(event) => setWorkPermitExpiresOn(event.target.value)}
            disabled={busy}
            required
          />
          <FilePicker
            id="work-permit-input"
            label={t("dashboardSettings.workPermitFile")}
            hint={t("dashboardSettings.workPermitHint")}
            error={workPermitError}
            file={workPermitFile}
            previewUrl={workPermitPreview}
            submittedUrl={submittedWorkPermitUrl}
            disabled={busy}
            onSelect={(file) => {
              setWorkPermitFile(file);
              setWorkPermitPreview(makePreview(file));
              setWorkPermitError(null);
            }}
          />
        </StepCard>
      ) : null}

      {readyCount > 0 ? (
        <StickyActions className="justify-between">
          <span className="text-sm text-fg-muted">
            {t("dashboardSettings.unsavedCount")} <span className="font-semibold text-fg tabular">{readyCount}</span>
          </span>
          <Button onClick={() => void saveAll()} disabled={busy} loading={savingAll}>
            {t("dashboardSettings.saveAll")}
          </Button>
        </StickyActions>
      ) : null}
    </div>
  );
}
