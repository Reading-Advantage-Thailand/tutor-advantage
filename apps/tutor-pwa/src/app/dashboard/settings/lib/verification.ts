/**
 * Pure helpers for the verification (KYC / payout account) forms.
 * Rules are identical to the former settings modal.
 */

export type VerificationField = "idCard" | "bankBook" | "address" | "taxInfo" | "workPermit";
export type IdType = "THAI_ID" | "PASSPORT";
export type TeachingLocation = "THAILAND" | "ABROAD";

/** Identity document as returned by identity /v1/users/me (passport masked). */
export type TutorIdentity = {
  idType?: IdType;
  passportNumberMasked?: string | null;
  passportNationality?: string | null;
  passportExpiresOn?: string | null;
  teachingLocation?: TeachingLocation | null;
  workPermitRequired?: boolean;
  workPermitImageUrl?: string | null;
  workPermitExpiresOn?: string | null;
  rightToWorkConfirmedAt?: string | null;
  taxResidency?: "RESIDENT" | "NON_RESIDENT";
  payoutBlock?: "PASSPORT_EXPIRED" | "WORK_PERMIT_EXPIRED" | "WORK_PERMIT_MISSING" | null;
};
export type FieldStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | (string & {});

export type SettingsUser = {
  userId?: string;
  displayName?: string;
  email?: string;
  profilePictureUrl?: string;
  role?: string;
  verificationStatus?: string;
  idCardImageUrl?: string | null;
  bankBookImageUrl?: string | null;
  identity?: TutorIdentity;
  settings?: {
    lineNotification?: boolean;
    address?: string;
    bankAccountNumber?: string;
    bankBrand?: string;
    taxName?: string;
    nationalId?: string;
    verification?: Partial<Record<string, { status?: string; comment?: string }>>;
  };
};

export const BANK_BRANDS: { value: string; label: string }[] = [
  { value: "kbank", label: "กสิกรไทย (KBank)" },
  { value: "scb", label: "ไทยพาณิชย์ (SCB)" },
  { value: "bbl", label: "กรุงเทพ (BBL)" },
  { value: "bay", label: "กรุงศรีอยุธยา (BAY)" },
  { value: "ttb", label: "ทีทีบี (TTB)" },
  { value: "kiatnakin", label: "เกียรตินาคินภัทร (KKP)" },
  { value: "cimb", label: "ซีไอเอ็มบี (CIMB)" },
  { value: "gsb", label: "ออมสิน (GSB)" },
  { value: "baac", label: "ธ.ก.ส. (BAAC)" },
  { value: "uob", label: "ยูโอบี (UOB)" },
  { value: "lhb", label: "แลนด์แอนด์เฮ้าส์ (LH Bank)" },
];

export function bankBrandLabel(brand: string | null | undefined): string {
  if (!brand) return "";
  return BANK_BRANDS.find((b) => b.value === brand)?.label ?? brand;
}

export const ACCEPTED_DOCUMENT_TYPES = "image/jpeg,image/png,image/webp,application/pdf";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Input filter used by the account number and national ID fields (digits and dashes). */
export function sanitizeDigitsAndDashes(value: string): string {
  return value.replace(/[^\d-]/g, "");
}

export function getFieldStatus(user: SettingsUser | null | undefined, field: VerificationField): FieldStatus {
  return user?.settings?.verification?.[field]?.status || "UNVERIFIED";
}

/** Rejection comment for a field, only when the field is REJECTED. */
export function getRejectionComment(user: SettingsUser | null | undefined, field: VerificationField): string {
  if (getFieldStatus(user, field) !== "REJECTED") return "";
  return user?.settings?.verification?.[field]?.comment || "";
}

export const VERIFICATION_STEPS: VerificationField[] = ["idCard", "bankBook", "address", "taxInfo"];

export function isPassportUser(user: SettingsUser | null | undefined): boolean {
  return user?.identity?.idType === "PASSPORT";
}

/** Steps this tutor has to complete: a work permit is added for passport holders teaching from Thailand. */
export function verificationSteps(user: SettingsUser | null | undefined): VerificationField[] {
  return user?.identity?.workPermitRequired ? [...VERIFICATION_STEPS, "workPermit"] : VERIFICATION_STEPS;
}

/** Which steps have been submitted (same rule as the old progress bar). */
export function stepCompletion(user: SettingsUser | null | undefined): Record<VerificationField, boolean> {
  return {
    idCard: getFieldStatus(user, "idCard") !== "UNVERIFIED",
    bankBook: getFieldStatus(user, "bankBook") !== "UNVERIFIED",
    address: getFieldStatus(user, "address") !== "UNVERIFIED",
    taxInfo: Boolean(
      user?.settings?.taxName && (isPassportUser(user) ? user?.identity?.passportNumberMasked : user?.settings?.nationalId),
    ),
    workPermit: getFieldStatus(user, "workPermit") !== "UNVERIFIED",
  };
}

export type BankDraft = { file: File | null; accountNumber: string; brand: string };

/** Error key for the bank book step, or null when it can be submitted. */
export function validateBankDraft(
  draft: BankDraft,
): null | "selectBankBookFile" | "bankAccountRequired" | "bankBrandRequired" {
  if (!draft.file) return "selectBankBookFile";
  if (!digitsOnly(draft.accountNumber)) return "bankAccountRequired";
  if (!draft.brand) return "bankBrandRequired";
  return null;
}

/** Address can be submitted when non-empty and changed from the saved value. */
export function canSubmitAddress(address: string, saved: string | null | undefined): boolean {
  return Boolean(address.trim()) && address !== saved;
}

/** Thai national ID: 13 digits with a valid mod-11 check digit (same rule as the server). */
export function isValidThaiId(value: string): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

export function normalizePassportNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPassportNumber(value: string): boolean {
  return /^[A-Z0-9]{6,20}$/.test(normalizePassportNumber(value));
}

/** Today in Asia/Bangkok as YYYY-MM-DD. */
export function bangkokToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date strictly after today (Bangkok). */
export function isFutureDate(value: string, now: Date = new Date()): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value > bangkokToday(now);
}

export type TaxInfoDraft = {
  idType: IdType;
  taxName: string;
  nationalId: string;
  passportNumber: string;
  passportNationality: string;
  passportExpiresOn: string;
  teachingLocation: TeachingLocation | "";
  privacyNoticeAccepted: boolean;
  rightToWorkConfirmed: boolean;
};

export type TaxInfoProblem =
  | "taxNameRequired"
  | "nationalIdInvalid"
  | "passportNumberInvalid"
  | "nationalityRequired"
  | "passportExpiryInvalid"
  | "teachingLocationRequired"
  | "privacyNoticeRequired"
  | "rightToWorkRequired";

/** First problem with the identity/tax draft, or null when it can be submitted. */
export function validateTaxInfoDraft(draft: TaxInfoDraft, now: Date = new Date()): TaxInfoProblem | null {
  if (!draft.taxName.trim()) return "taxNameRequired";
  if (draft.idType === "THAI_ID") return isValidThaiId(draft.nationalId) ? null : "nationalIdInvalid";
  if (!isValidPassportNumber(draft.passportNumber)) return "passportNumberInvalid";
  if (!/^[A-Za-z]{2,3}$/.test(draft.passportNationality.trim())) return "nationalityRequired";
  if (!isFutureDate(draft.passportExpiresOn, now)) return "passportExpiryInvalid";
  if (!draft.teachingLocation) return "teachingLocationRequired";
  if (!draft.privacyNoticeAccepted) return "privacyNoticeRequired";
  if (!draft.rightToWorkConfirmed) return "rightToWorkRequired";
  return null;
}

/** Thai ID tax info needs a name and a valid 13-digit national ID. */
export function isTaxInfoValid(taxName: string, nationalId: string): boolean {
  return Boolean(taxName.trim()) && isValidThaiId(nationalId);
}

/** Tax info differs from what is stored (used for the "unsaved changes" bar). */
export function isTaxInfoChanged(user: SettingsUser | null | undefined, draft: TaxInfoDraft): boolean {
  const identity = user?.identity;
  const savedIdType = identity?.idType ?? "THAI_ID";
  if (draft.idType !== savedIdType || draft.taxName !== (user?.settings?.taxName || "")) return true;
  if (draft.idType === "THAI_ID") return draft.nationalId !== (user?.settings?.nationalId || "");
  // The saved passport number is never sent back, so typing one is a change.
  return (
    Boolean(draft.passportNumber) ||
    draft.passportNationality.toUpperCase() !== (identity?.passportNationality || "") ||
    draft.passportExpiresOn !== (identity?.passportExpiresOn || "") ||
    draft.teachingLocation !== (identity?.teachingLocation || "")
  );
}

export function isPdfFile(file: File | null | undefined): boolean {
  return Boolean(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)));
}

export function isPdfUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}
