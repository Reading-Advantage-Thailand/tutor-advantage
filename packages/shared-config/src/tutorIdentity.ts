/**
 * Tutor identity rules (Thai ID or passport) shared by the identity and
 * finance services. Pure functions only: no I/O, no Node APIs.
 *
 * Phase 1 of "foreign tutors with a passport":
 * - Thai ID must pass the 13-digit checksum.
 * - Passport: 6–20 letters/digits, a nationality and an expiry in the future.
 * - Passport holders teaching from Thailand also need a work permit.
 * - Payouts are blocked while any of those documents has expired.
 * - Tax: residents 3% (50 ทวิ), non-residents 15% (PND.54).
 */

export const ID_TYPES = ["THAI_ID", "PASSPORT"] as const;
export type IdType = (typeof ID_TYPES)[number];

export const TEACHING_LOCATIONS = ["THAILAND", "ABROAD"] as const;
export type TeachingLocation = (typeof TEACHING_LOCATIONS)[number];

export const TAX_RESIDENCIES = ["RESIDENT", "NON_RESIDENT"] as const;
export type TaxResidency = (typeof TAX_RESIDENCIES)[number];

/** Withholding tax rate (percent) applied to a payout for each residency. */
export const WHT_RATE_PERCENT_BY_RESIDENCY: Record<TaxResidency, number> = {
  RESIDENT: 3,
  NON_RESIDENT: 15,
};

/** Consent types written to identity.user_consents by the passport flow. */
export const FOREIGN_PRIVACY_NOTICE_CONSENT_TYPE = "PRIVACY_NOTICE_PASSPORT_V1";
export const RIGHT_TO_WORK_CONSENT_TYPE = "RIGHT_TO_WORK";

export const BASE_VERIFICATION_FIELDS = ["idCard", "bankBook", "address", "taxInfo"] as const;
export const ALL_VERIFICATION_FIELDS = [...BASE_VERIFICATION_FIELDS, "workPermit"] as const;
export type TutorVerificationField = (typeof ALL_VERIFICATION_FIELDS)[number];

export function isIdType(value: unknown): value is IdType {
  return typeof value === "string" && (ID_TYPES as readonly string[]).includes(value);
}

export function isTeachingLocation(value: unknown): value is TeachingLocation {
  return typeof value === "string" && (TEACHING_LOCATIONS as readonly string[]).includes(value);
}

export function isTaxResidency(value: unknown): value is TaxResidency {
  return typeof value === "string" && (TAX_RESIDENCIES as readonly string[]).includes(value);
}

export function normalizeThaiId(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

/** Thai national ID: 13 digits, the last is a mod-11 check digit over the first 12. */
export function isValidThaiId(value: unknown): boolean {
  const digits = normalizeThaiId(value);
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/** Upper-case, no spaces or dashes. */
export function normalizePassportNumber(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\s-]/g, "").toUpperCase() : "";
}

export function isValidPassportNumber(value: unknown): boolean {
  return /^[A-Z0-9]{6,20}$/.test(normalizePassportNumber(value));
}

/** ISO 3166-1 alpha-2 or alpha-3 code, upper-case. */
export function normalizeNationality(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function isValidNationality(value: unknown): boolean {
  return /^[A-Z]{2,3}$/.test(normalizeNationality(value));
}

/** Parses a YYYY-MM-DD date (UTC midnight); null when malformed. */
export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

/**
 * A document is valid through its expiry date (inclusive) and expires the
 * next day. `asOf` is compared by calendar day in Asia/Bangkok.
 */
export function isExpired(expiresOn: Date | string | null | undefined, asOf: Date = new Date()): boolean {
  if (!expiresOn) return false;
  const expiry = typeof expiresOn === "string" ? parseIsoDate(expiresOn.slice(0, 10)) : expiresOn;
  if (!expiry) return false;
  return bangkokDay(asOf) > expiry.toISOString().slice(0, 10);
}

function bangkokDay(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Last 4 characters with the rest replaced, for admin screens. */
export function maskDocumentNumber(value: string | null | undefined, visible = 4): string | null {
  if (!value) return null;
  if (value.length <= visible) return "•".repeat(value.length);
  return `${"•".repeat(value.length - visible)}${value.slice(-visible)}`;
}

export type TutorIdentityState = {
  idType?: string | null;
  teachingLocation?: string | null;
  passportExpiresOn?: Date | string | null;
  workPermitExpiresOn?: Date | string | null;
};

export function requiresWorkPermit(user: TutorIdentityState): boolean {
  return user.idType === "PASSPORT" && user.teachingLocation === "THAILAND";
}

/** Verification fields a tutor must have VERIFIED before payouts. */
export function requiredVerificationFields(user: TutorIdentityState): TutorVerificationField[] {
  return requiresWorkPermit(user)
    ? [...ALL_VERIFICATION_FIELDS]
    : [...BASE_VERIFICATION_FIELDS];
}

/** Overall status from per-field review statuses (only required fields count). */
export function computeTutorVerificationStatus(
  verification: Record<string, { status?: string } | undefined>,
  user: TutorIdentityState,
): "VERIFIED" | "REJECTED" | "PENDING" | "UNVERIFIED" {
  const statuses = requiredVerificationFields(user).map((field) => verification[field]?.status);
  if (statuses.every((status) => status === "VERIFIED")) return "VERIFIED";
  if (statuses.some((status) => status === "REJECTED")) return "REJECTED";
  if (statuses.some((status) => status === "PENDING")) return "PENDING";
  return "UNVERIFIED";
}

export type PayoutDocumentBlock = "PASSPORT_EXPIRED" | "WORK_PERMIT_EXPIRED" | "WORK_PERMIT_MISSING";

/**
 * Why identity documents currently block payouts (null = not blocked).
 * Checked at settlement and again right before money moves, so an expiry
 * pauses payouts automatically without an admin action.
 */
export function payoutDocumentBlock(user: TutorIdentityState, asOf: Date = new Date()): PayoutDocumentBlock | null {
  if (user.idType !== "PASSPORT") return null;
  if (!user.passportExpiresOn || isExpired(user.passportExpiresOn, asOf)) return "PASSPORT_EXPIRED";
  if (requiresWorkPermit(user)) {
    if (!user.workPermitExpiresOn) return "WORK_PERMIT_MISSING";
    if (isExpired(user.workPermitExpiresOn, asOf)) return "WORK_PERMIT_EXPIRED";
  }
  return null;
}

/** Integer withholding (half-up to the satang) at a whole-percent rate. */
export function calculateWithholdingAtRate(grossMinor: bigint, ratePercent: number) {
  const rate = BigInt(ratePercent);
  const withholdingTaxMinor = (grossMinor * rate + 50n) / 100n;
  return { grossPayoutMinor: grossMinor, withholdingTaxMinor, netPayoutMinor: grossMinor - withholdingTaxMinor };
}

export function whtRatePercentFor(taxResidency: unknown): number {
  return isTaxResidency(taxResidency) ? WHT_RATE_PERCENT_BY_RESIDENCY[taxResidency] : WHT_RATE_PERCENT_BY_RESIDENCY.RESIDENT;
}
