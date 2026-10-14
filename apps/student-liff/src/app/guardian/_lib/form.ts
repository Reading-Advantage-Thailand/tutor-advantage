/**
 * Guardian consent form rules. No "@/…" imports (the root vitest config maps
 * "@" to another app); i18n keys are returned as strings for the page to t().
 */

/** Values sent as `guardianContact` (unchanged API contract), with their label keys. */
export const GUARDIAN_RELATIONS = [
  { value: "Father", labelKey: "guardian.father" },
  { value: "Mother", labelKey: "guardian.mother" },
  { value: "Relative", labelKey: "guardian.relative" },
  { value: "Other", labelKey: "guardian.other" },
] as const;

export type GuardianRelation = (typeof GUARDIAN_RELATIONS)[number]["value"];

export interface GuardianFormValues {
  guardianName: string;
  relation: string;
  agreed: boolean;
}

export interface GuardianFormErrors {
  guardianName?: "guardian.nameRequired";
  relation?: "guardian.relationRequired";
  agreed?: "guardian.agreementHint";
}

/** Field errors (empty object = valid). A name of only spaces counts as empty. */
export function validateGuardianForm({ guardianName, relation, agreed }: GuardianFormValues): GuardianFormErrors {
  const errors: GuardianFormErrors = {};
  if (!guardianName.trim()) errors.guardianName = "guardian.nameRequired";
  if (!relation) errors.relation = "guardian.relationRequired";
  if (!agreed) errors.agreed = "guardian.agreementHint";
  return errors;
}

export function hasErrors(errors: GuardianFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export type GuardianErrorKey =
  | "guardian.sessionExpired"
  | "guardian.dobRequired"
  | "guardian.notRequired"
  | "guardian.invalidData"
  | "guardian.saveFailed";

/**
 * Kid-friendly Thai message for a failed POST /guardian/consent (never the raw
 * server text). Uses StudentApiError.status / .code.
 */
export function getGuardianErrorKey(error: unknown): GuardianErrorKey {
  const details = (error ?? {}) as { status?: unknown; code?: unknown };
  const status = typeof details.status === "number" ? details.status : undefined;
  const code = typeof details.code === "string" ? details.code : undefined;
  if (status === 401) return "guardian.sessionExpired";
  if (code === "DATE_OF_BIRTH_REQUIRED") return "guardian.dobRequired";
  if (code === "GUARDIAN_CONSENT_NOT_REQUIRED") return "guardian.notRequired";
  if (status === 400 || status === 422) return "guardian.invalidData";
  return "guardian.saveFailed";
}
