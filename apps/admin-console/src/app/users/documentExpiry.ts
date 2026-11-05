/**
 * Pure helpers for tutor identity-document expiry in the admin users area
 * (list chip + verification tab notice). Relative imports only so vitest
 * (whose "@" alias points elsewhere) can test it.
 */

export type ExpiringDocument = "PASSPORT" | "WORK_PERMIT";

/** GET /v1/users row `documentExpiry`: soonest document; daysLeft < 0 = already expired. */
export interface DocumentExpiry {
  document: ExpiringDocument;
  /** YYYY-MM-DD, the last valid day. */
  expiresOn: string;
  /** Bangkok days left; 0 = expires today (still valid), negative = expired. */
  daysLeft: number;
}

/** GET /v1/users/:id identity.expiryWarnings item (still valid, within 30 days). */
export type DocumentExpiryWarning = DocumentExpiry;

export const DOCUMENT_FILTERS = ["EXPIRING", "EXPIRED"] as const;
export type DocumentFilter = (typeof DOCUMENT_FILTERS)[number];

/** Message templates; `{document}`, `{days}` and `{date}` are filled in here. */
export interface ExpiryMessages {
  passport: string;
  workPermit: string;
  inDays: string;
  today: string;
  expired: string;
}

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

export function documentName(document: ExpiringDocument, messages: Pick<ExpiryMessages, "passport" | "workPermit">) {
  return document === "WORK_PERMIT" ? messages.workPermit : messages.passport;
}

/** Text + tone for an expiry: danger once expired or due within 7 days, warning otherwise. */
export function documentExpiryChip(
  expiry: DocumentExpiry | null | undefined,
  messages: ExpiryMessages,
): { tone: "warning" | "danger"; text: string } | null {
  if (!expiry || !Number.isFinite(expiry.daysLeft)) return null;
  const values = { document: documentName(expiry.document, messages), days: expiry.daysLeft, date: expiry.expiresOn };
  if (expiry.daysLeft < 0) return { tone: "danger", text: fill(messages.expired, values) };
  if (expiry.daysLeft === 0) return { tone: "danger", text: fill(messages.today, values) };
  return { tone: expiry.daysLeft <= 7 ? "danger" : "warning", text: fill(messages.inDays, values) };
}

/** One line per still-valid warning, soonest first. */
export function expiryWarningLines(warnings: DocumentExpiryWarning[] | null | undefined, messages: ExpiryMessages): string[] {
  return [...(warnings ?? [])]
    .filter((warning) => warning.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map((warning) => documentExpiryChip(warning, messages)!.text);
}
