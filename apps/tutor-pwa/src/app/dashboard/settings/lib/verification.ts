/**
 * Pure helpers for the verification (KYC / payout account) forms.
 * Rules are identical to the former settings modal.
 */

export type VerificationField = "idCard" | "bankBook" | "address" | "taxInfo";
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

/** Which of the 4 steps have been submitted (same rule as the old progress bar). */
export function stepCompletion(user: SettingsUser | null | undefined): Record<VerificationField, boolean> {
  return {
    idCard: getFieldStatus(user, "idCard") !== "UNVERIFIED",
    bankBook: getFieldStatus(user, "bankBook") !== "UNVERIFIED",
    address: getFieldStatus(user, "address") !== "UNVERIFIED",
    taxInfo: Boolean(user?.settings?.taxName && user?.settings?.nationalId),
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

/** Tax info needs a name and a 13-digit national ID. */
export function isTaxInfoValid(taxName: string, nationalId: string): boolean {
  return Boolean(taxName.trim()) && digitsOnly(nationalId).length === 13;
}

/** Tax info differs from what is stored (used for the "unsaved changes" bar). */
export function isTaxInfoChanged(user: SettingsUser | null | undefined, taxName: string, nationalId: string): boolean {
  return taxName !== (user?.settings?.taxName || "") || nationalId !== (user?.settings?.nationalId || "");
}

export function isPdfFile(file: File | null | undefined): boolean {
  return Boolean(file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name)));
}

export function isPdfUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.pdf($|\?)/i.test(url));
}
