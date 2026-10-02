/**
 * Turns /v1/users/me + /v1/guardian/consent into what the "my consents"
 * screen shows. Pure (no "@/…" imports) so vitest can load it.
 */

export interface MeConsentRecord {
  consentType?: string;
  status?: string;
  effectiveAt?: string | null;
  createdAt?: string | null;
}

/** The parts of GET /v1/users/me this screen reads. */
export interface MeResponse {
  user?: {
    userConsents?: MeConsentRecord[] | null;
    requiresGuardian?: boolean | null;
  } | null;
}

/** GET /v1/guardian/consent */
export interface GuardianConsentResponse {
  hasConsent?: boolean | null;
}

export type GuardianConsentState = "granted" | "required" | "notNeeded";

export interface ConsentSummary {
  terms: { accepted: boolean; acceptedAt: string | null };
  guardian: GuardianConsentState;
}

const TERMS_CONSENT_TYPE = "TERMS_AND_PRIVACY";
const ACCEPTED = "ACCEPTED";

export function buildConsentSummary(
  me: MeResponse | null | undefined,
  guardian: GuardianConsentResponse | null | undefined,
): ConsentSummary {
  const records = me?.user?.userConsents ?? [];
  // Same predicate as the root layout's hasConsent check.
  const accepted = records.find((c) => c.consentType === TERMS_CONSENT_TYPE && c.status === ACCEPTED);

  let guardianState: GuardianConsentState;
  if (guardian?.hasConsent) guardianState = "granted";
  else if (me?.user?.requiresGuardian) guardianState = "required";
  else guardianState = "notNeeded";

  return {
    terms: {
      accepted: Boolean(accepted),
      acceptedAt: accepted ? accepted.effectiveAt ?? accepted.createdAt ?? null : null,
    },
    guardian: guardianState,
  };
}
