export const GUARDIAN_AGE_THRESHOLD = 18;
export const GUARDIAN_CONSENT_TYPE = "GUARDIAN_CONTACT_PAYMENT";
export const CONSENT_STATUS_GRANTED = "granted";

export function isUnderGuardianAge(
  dateOfBirth: Date,
  now: Date = new Date(),
): boolean {
  const nowIct = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const todayIct = Date.UTC(
    nowIct.getUTCFullYear(),
    nowIct.getUTCMonth(),
    nowIct.getUTCDate(),
  );
  const adultDate = Date.UTC(
    dateOfBirth.getUTCFullYear() + GUARDIAN_AGE_THRESHOLD,
    dateOfBirth.getUTCMonth(),
    dateOfBirth.getUTCDate(),
  );
  return adultDate > todayIct;
}

export function requiresGuardianConsent(
  role: string,
  dateOfBirth: Date | null | undefined,
  hasGrantedConsent: boolean,
  now: Date = new Date(),
): boolean {
  if (role !== "STUDENT") return false;
  if (!dateOfBirth) return true;
  return isUnderGuardianAge(dateOfBirth, now) && !hasGrantedConsent;
}
