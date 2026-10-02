// Pure helpers for the "payment required" screen shared by the lesson lobby
// and the live lesson. Relative imports only: vitest maps "@" to another app.
import type { PaymentRequiredData } from "../../hooks/useLessonSocket";

type PaymentLinkData = Pick<PaymentRequiredData, "paymentUrl" | "cycleId">;
type PaymentBookData = Pick<PaymentRequiredData, "bookCode" | "bookTitle">;

/**
 * Where "ไปชำระเงิน" goes. The server-provided paymentUrl wins; otherwise the
 * payment page for this class (and book cycle when known). Kept byte-identical
 * to the URLs the lobby and live lesson built before (no extra encoding).
 */
export function buildPaymentUrl(data: PaymentLinkData, classId: string | null | undefined): string {
  if (data.paymentUrl) return data.paymentUrl;
  if (!classId) return "/payment";
  return `/payment?classId=${classId}${data.cycleId ? `&cycleId=${data.cycleId}` : ""}`;
}

/** Secondary action: back to the class page (books the student can open), or home. */
export function buildPaymentBackUrl(classId: string | null | undefined): string {
  return classId ? `/classes/${classId}` : "/dashboard";
}

/** "CODE: Title", either part alone, or null when the server sent neither. */
export function getPaymentBookLabel(data: PaymentBookData): string | null {
  return [data.bookCode, data.bookTitle].filter(Boolean).join(": ") || null;
}
