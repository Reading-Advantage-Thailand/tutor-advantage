import { createHash } from "crypto";

// Free-text redaction shared by the winston logger and the Discord alert
// transport. Kept out of logger.ts so the transport (which logger.ts imports)
// can use it without an import cycle.

const DATABASE_URL_PATTERN = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const COOKIE_TOKEN_PATTERN = /\b((?:student-session|tutor_session|session|token)=)[^;\s]+/gi;
const SENSITIVE_QUERY_PARAMETER_PATTERN = /([?&](?:access_token|authorization|code|id_token|password|referralToken|secret|signature|state|token)=)[^&#\s]*/gi;

// Passport-number-like tokens in free text: 1-3 letters followed by 6+ digits (e.g. AA1234567).
const PASSPORT_TEXT_PATTERN = /\b[A-Z]{1,3}\d{6,17}\b/g;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
// Thai national ID: 13 digits, optionally grouped 1-4-5-2-1. Only values that
// pass the ID checksum are redacted, so ms timestamps and amounts survive.
const THAI_NATIONAL_ID_PATTERN = /\b\d[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d\b/g;
// Thai mobile (0[689]x-xxx-xxxx) and Bangkok landline (02-xxx-xxxx), local or +66.
const THAI_PHONE_PATTERN = /(?:\+66[-\s]?|\b0)(?:[689]\d|2)[-\s]?\d{3}[-\s]?\d{4}\b/g;
// LINE user ids: "U" followed by 32 hex characters.
const LINE_USER_ID_PATTERN = /\bU[0-9a-f]{32}\b/g;
const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/** Hashes identifiers so logs can still be correlated without exposing them. */
export function hashIdentifier(value: unknown): string {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function isThaiNationalId(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(digits[12]);
}

/** Removes credentials, secret-bearing URL values and personal data from log messages. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(DATABASE_URL_PATTERN, "[REDACTED_DATABASE_URL]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(COOKIE_TOKEN_PATTERN, "$1[REDACTED]")
    .replace(SENSITIVE_QUERY_PARAMETER_PATTERN, "$1[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .replace(LINE_USER_ID_PATTERN, "[REDACTED_LINE_USER_ID]")
    .replace(THAI_NATIONAL_ID_PATTERN, (match) =>
      isThaiNationalId(match.replace(/[-\s]/g, "")) ? "[REDACTED_NATIONAL_ID]" : match,
    )
    .replace(THAI_PHONE_PATTERN, "[REDACTED_PHONE]")
    .replace(PASSPORT_TEXT_PATTERN, "[REDACTED_DOCUMENT_NUMBER]");
}

/**
 * Stricter redaction for text that leaves GCP (Discord). On top of
 * redactSensitiveText, raw UUIDs (user, tutor, payment ids) are replaced by
 * their hashIdentifier so alerts can still be correlated with structured logs.
 */
export function redactExternalText(value: string): string {
  return redactSensitiveText(value).replace(UUID_PATTERN, (uuid) => `<id:${hashIdentifier(uuid)}>`);
}
