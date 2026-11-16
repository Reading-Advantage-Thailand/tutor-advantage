"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageUp } from "lucide-react";
import {
  Field,
  IconTile,
  Notice,
  SegmentedControl,
  SelectField,
  StickyActions,
  Surface,
  TextAreaField,
  TextField,
  toast,
} from "@/components/app";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { t } from "@/lib/i18n";
import { bilingualCopy, thaiLabel } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  saveTaxInfoAction,
  scanPassportAction,
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
  MAX_DOCUMENT_BYTES,
  passportScanPatch,
  sanitizeDigitsAndDashes,
  savedPassportOf,
  validateBankDraft,
  validateTaxInfoDraft,
  type IdType,
  type PassportScanField,
  type SettingsUser,
  type TaxInfoDraft,
  type TeachingLocation,
  type VerificationField,
} from "../lib/verification";
import { FieldStatusChip } from "./FieldStatusChip";
import { PassportScanPanel, type PassportScanState } from "./PassportScanPanel";
import { stepTile } from "./stepMeta";

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

const SCAN_ERRORS: Record<string, string> = {
  PASSPORT_NOT_READABLE: t("dashboardSettings.scanError_PASSPORT_NOT_READABLE"),
  PASSPORT_SCAN_UNAVAILABLE: t("dashboardSettings.scanError_PASSPORT_SCAN_UNAVAILABLE"),
  RATE_LIMITED: t("dashboardSettings.scanError_RATE_LIMITED"),
  INVALID_VERIFICATION_FILE: t("dashboardSettings.scanError_INVALID_VERIFICATION_FILE"),
  FILE_TOO_LARGE: t("dashboardSettings.scanError_FILE_TOO_LARGE"),
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
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-sm leading-[1.6] text-fg">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {/* "ไทย · English": each language wraps as its own block; the label's text is unchanged. */}
      <span className="min-w-0">{bilingualCopy(children, { label: true })}</span>
    </label>
  );
}

/**
 * One KYC document (patterns.md T8 upload row): tone tile + document name +
 * status chip (ยังไม่ได้ส่ง / รอการตรวจสอบ / ตรวจสอบแล้ว / ปฏิเสธ + reason),
 * the fields, then this step's own submit in a muted footer.
 */
function StepCard({
  user,
  field,
  isPassport,
  title,
  description,
  children,
  footer,
}: {
  user: SettingsUser;
  field: VerificationField;
  isPassport: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const comment = getRejectionComment(user, field);
  const tile = stepTile(field, isPassport);
  return (
    <Surface padding="none" as="section" aria-label={title} className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <IconTile icon={tile.icon} tone={tile.tone} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:justify-between sm:gap-3">
              <h3 className="type-card text-balance-th text-fg">{title}</h3>
              <span className="shrink-0">
                <FieldStatusChip user={user} field={field} showUnsubmitted />
              </span>
            </div>
            {description ? <p className="mt-0.5 type-body-s text-fg-muted">{bilingualCopy(description)}</p> : null}
          </div>
        </div>
        {comment ? (
          <Notice tone="danger" title={t("dashboardSettings.rejectReason")}>
            {comment}
          </Notice>
        ) : null}
        {children}
      </div>
      <div className="flex justify-end border-t border-hairline bg-surface-muted px-4 py-3 md:px-5">{footer}</div>
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
            "group flex min-h-16 cursor-pointer flex-wrap items-center gap-3 rounded-(--radius-ctl) border p-2.5 transition-colors duration-(--duration-fast) sm:flex-nowrap",
            "hover:bg-row-hover has-[:focus-visible]:border-brand-fg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring has-[:focus-visible]:outline-solid",
            previewUrl ? "border-brand-soft-border bg-brand-soft" : invalid ? "border-danger-solid bg-surface" : "border-field-border bg-surface",
            disabled && "pointer-events-none opacity-45",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-(--radius-ctl-sm) border border-hairline bg-surface-muted text-fg-subtle">
              {shownUrl && !showPdf ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shownUrl}
                  alt={previewUrl ? t("dashboardSettings.previewAlt") : t("dashboardSettings.uploadedAlt")}
                  className="size-full object-cover"
                />
              ) : shownUrl ? (
                <FileText aria-hidden="true" className="size-6 text-fg" />
              ) : (
                <ImageUp aria-hidden="true" className="size-6" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              {shownUrl && showPdf ? (
                <span className="truncate text-sm font-semibold text-fg">{file?.name ?? t("dashboardSettings.pdfSelected")}</span>
              ) : null}
              <span className={cn("text-sm leading-[1.6]", previewUrl ? "font-medium text-brand-soft-fg" : "text-fg-muted")}>
                {/* Inside the file input's label: spans only, the accessible name stays the same. */}
                {thaiLabel(
                  previewUrl
                    ? t("dashboardSettings.selectedFilePendingUpload")
                    : submittedUrl
                      ? t("dashboardSettings.uploadedImage")
                      : t("dashboardSettings.fileDropHint"),
                )}
              </span>
            </span>
          </span>
          <span className={cn(buttonVariants({ variant: "outline" }), "pointer-events-none min-h-11 w-full sm:w-auto")}>
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
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(Boolean(identity.privacyNoticeAcceptedAt));
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
  const [scanState, setScanState] = useState<PassportScanState>("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  // Fields last filled by a scan and not edited since (they show a "check this" hint).
  const [scanFilled, setScanFilled] = useState<PassportScanField[]>([]);
  const [scanConfirmed, setScanConfirmed] = useState<PassportScanField[]>([]);
  const scanRunRef = useRef(0);
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
  const scanning = scanState === "scanning";
  const busy = isPending || taxInfoPending || workPermitPending || savingAll || scanning;

  /** Reads the passport photo page and fills the passport fields with what it found. */
  const scanPassport = async (file: File) => {
    const run = ++scanRunRef.current;
    const fail = (code: string) => {
      if (run !== scanRunRef.current) return;
      setScanState("error");
      setScanError(SCAN_ERRORS[code] ?? t("dashboardSettings.scanFailed"));
    };
    if (file.size > MAX_DOCUMENT_BYTES) return fail("FILE_TOO_LARGE");
    setScanState("scanning");
    setScanError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await scanPassportAction(formData);
      if (run !== scanRunRef.current) return;
      if (!result.ok) return fail(result.code);
      const { patch, filled } = passportScanPatch(result, nationalityOptions().map((option) => option.value));
      if (filled.length === 0) return fail("PASSPORT_NOT_READABLE");
      if (patch.taxName !== undefined) setTaxName(patch.taxName);
      if (patch.passportNumber !== undefined) setPassportNumber(patch.passportNumber);
      if (patch.passportNationality !== undefined) setPassportNationality(patch.passportNationality);
      if (patch.passportExpiresOn !== undefined) setPassportExpiresOn(patch.passportExpiresOn);
      setTaxInfoSaved(false);
      setScanFilled(filled);
      setScanConfirmed(result.confirmed.filter((field) => filled.includes(field)));
      setScanState("done");
    } catch {
      fail("PASSPORT_SCAN_FAILED");
    }
  };

  const clearScanHint = (field: PassportScanField) => setScanFilled((fields) => fields.filter((f) => f !== field));
  const scanHint = (field: PassportScanField) =>
    scanFilled.includes(field)
      ? scanConfirmed.includes(field)
        ? t("dashboardSettings.scanFilledConfirmed")
        : t("dashboardSettings.scanFilledCheck")
      : undefined;

  const selectIdCardFile = (file: File) => {
    setIdCardFile(file);
    setIdCardPreview(makePreview(file));
    setIdCardError(null);
  };

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
  const savedPassport = savedPassportOf(user);
  const taxProblem = validateTaxInfoDraft(taxDraft, new Date(), savedPassport);
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
      // Saved values are no longer "from the photo".
      setScanFilled([]);
      setScanState((state) => (state === "done" ? "idle" : state));
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
        isPassport={isPassport}
        title={isPassport ? t("dashboardSettings.passportStep") : t("dashboardSettings.idCardStep")}
        footer={
          <Button
            variant="tonal"
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
            selectIdCardFile(file);
            // Not read automatically: the scan panel asks first (the photo goes to Google Gemini).
            if (isPassport) setScanState((state) => (state === "scanning" ? state : "idle"));
          }}
        />
      </StepCard>

      {/* 2. Bank account */}
      <StepCard
        user={user}
        field="bankBook"
        isPassport={isPassport}
        title={t("dashboardSettings.bankBookStep")}
        footer={
          <Button
            variant="tonal"
            onClick={() => void submitOne("bankBook")}
            disabled={!ready.bankBook || busy}
            loading={activeField === "bankBook"}
            className="w-full sm:w-auto"
          >
            {activeField === "bankBook" ? t("dashboardSettings.uploading") : t("dashboardSettings.uploadBankBook")}
          </Button>
        }
      >
        {isPassport ? <Notice tone="info">{bilingualCopy(t("dashboardSettings.bankNameMustMatchId"))}</Notice> : null}
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
        isPassport={isPassport}
        title={t("dashboardSettings.addressStep")}
        footer={
          <Button
            variant="tonal"
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
        isPassport={isPassport}
        title={isPassport ? t("dashboardSettings.passportTaxInfoStep") : t("dashboardSettings.taxInfoStep")}
        description={isPassport ? t("dashboardSettings.passportTaxInfoHint") : t("dashboardSettings.taxInfoHint")}
        footer={
          <Button
            variant={taxInfoSaved ? "outline" : "tonal"}
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
              // The long bilingual labels wrap on phones instead of truncating ("ในประเทศไทย (Thail…").
              wrapLabels
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
        {isPassport ? (
          <PassportScanPanel
            state={scanState}
            error={scanError}
            filledCount={scanFilled.length}
            hasPhoto={Boolean(idCardFile)}
            disabled={busy}
            onScanPhoto={() => idCardFile && void scanPassport(idCardFile)}
            onPickPhoto={(file) => {
              selectIdCardFile(file);
              void scanPassport(file);
            }}
          />
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            id="tax-name"
            label={isPassport ? bilingualCopy(t("dashboardSettings.passportNameLabel"), { label: true }) : t("dashboardSettings.taxNameLabel")}
            placeholder={isPassport ? "John Smith" : t("dashboardSettings.taxNamePlaceholder")}
            autoComplete="name"
            value={taxName}
            hint={isPassport ? scanHint("fullName") : undefined}
            onChange={(event) => {
              setTaxName(event.target.value);
              setTaxInfoSaved(false);
              clearScanHint("fullName");
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
              hint={
                scanHint("passportNumber") ??
                (savedPassport.hasNumber && !passportNumber ? t("dashboardSettings.passportNumberKeep") : undefined)
              }
              onChange={(event) => {
                setPassportNumber(event.target.value.toUpperCase());
                setTaxInfoSaved(false);
                clearScanHint("passportNumber");
              }}
              disabled={busy}
              required={!savedPassport.hasNumber}
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
                hint={scanHint("nationality")}
                onChange={(event) => {
                  setPassportNationality(event.target.value);
                  setTaxInfoSaved(false);
                  clearScanHint("nationality");
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
                hint={scanHint("expiresOn")}
                onChange={(event) => {
                  setPassportExpiresOn(event.target.value);
                  setTaxInfoSaved(false);
                  clearScanHint("expiresOn");
                }}
                disabled={busy}
                required
              />
            </div>
            <Field
              id="teaching-location"
              label={bilingualCopy(t("dashboardSettings.teachingLocationLabel"), { label: true })}
              hint={bilingualCopy(t("dashboardSettings.teachingFromThailandHint"))}
            >
              {() => (
                <SegmentedControl<TeachingLocation>
                  aria-label={t("dashboardSettings.teachingLocationLabel")}
                  fullWidth
                  wrapLabels
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
            <div className="ds-well flex flex-col gap-2 p-3.5">
              <p className="type-body-s text-fg-muted">{bilingualCopy(t("dashboardSettings.privacyNoticeBody"))}</p>
              <ConsentCheckbox
                id="privacy-notice-consent"
                checked={privacyNoticeAccepted || savedPassport.privacyAccepted}
                disabled={busy || savedPassport.privacyAccepted}
                onChange={(value) => {
                  setPrivacyNoticeAccepted(value);
                  setTaxInfoSaved(false);
                }}
              >
                {t("dashboardSettings.privacyNoticeConsent")}
              </ConsentCheckbox>
              <ConsentCheckbox
                id="right-to-work-consent"
                checked={rightToWorkConfirmed || savedPassport.rightToWorkConfirmed}
                disabled={busy || savedPassport.rightToWorkConfirmed}
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
          isPassport={isPassport}
          title={t("dashboardSettings.workPermitStep")}
          footer={
            <Button
              variant="tonal"
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
        <StickyActions className="justify-between gap-3">
          <span className="min-w-0 text-sm text-fg-muted">
            {t("dashboardSettings.unsavedCount")}{" "}
            <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-brand-soft px-1.5 text-xs font-semibold text-brand-soft-fg tabular">
              {readyCount}
            </span>
          </span>
          <Button size="lg" onClick={() => void saveAll()} disabled={busy} loading={savingAll}>
            {t("dashboardSettings.saveAll")}
          </Button>
        </StickyActions>
      ) : null}
    </div>
  );
}
