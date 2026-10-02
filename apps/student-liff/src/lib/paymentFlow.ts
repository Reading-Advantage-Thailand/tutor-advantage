import { t, type I18nKey } from "./i18n";
import { formatThaiMonthYear, toDate } from "./format";

export type PaymentMethod = "promptpay" | "card";
/**
 * Checkout steps. "result" is the card 3DS return screen for an intent that is
 * still pending or has failed (a successful one goes straight to "success").
 */
export type PaymentStep = "select" | "age-check" | "qr" | "card-form" | "result" | "success";

export function isValidDateOfBirth(value: string, now: Date = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed.getTime() <= now.getTime()
  );
}

export function isUnder18(value: string, now: Date = new Date()) {
  if (!isValidDateOfBirth(value, now)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const adultDate = new Date(year + 18, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return adultDate.getTime() > today.getTime();
}

export type OrderSummary = {
  id: string;
  name: string;
  price: number;
  priceSatang: number;
  tutor: string;
  cefr: string;
};

export type CheckoutDetails = {
  provider: "omise";
  chargeId: string;
  status: string;
  paid: boolean;
  authorizeUri: string | null;
  qrCodeUrl: string | null;
  qrCodeDataUri?: string | null;
  failureMessage: string | null;
};

type PaymentIntentLike = {
  status: string;
  method?: string | null;
};

type ClassDetailsLike = {
  id?: string | null;
  name?: string | null;
  book?: string | null;
  packagePriceSatang?: number | null;
  tutor?: {
    name?: string | null;
  } | null;
};

/** Response of GET /payments/:id/status and POST /payments/intent. */
export type PaymentStatusResponse = {
  intent: {
    paymentIntentId: string;
    status: string;
    method?: string | null;
    amountMinor?: number | null;
    createdAt?: string;
  };
  checkout: CheckoutDetails | null;
};

const DEFAULT_PRICE_SATANG = 250_000;

export function createDefaultOrderSummary(classId: string): OrderSummary {
  return {
    id: classId,
    name: t("payment.loadingClass"),
    price: DEFAULT_PRICE_SATANG / 100,
    priceSatang: DEFAULT_PRICE_SATANG,
    tutor: t("payment.defaultTutor"),
    cefr: t("payment.defaultCefr"),
  };
}

export function buildOrderSummaryFromClass(
  cls: ClassDetailsLike,
  fallbackClassId: string,
): OrderSummary {
  const priceSatang = cls.packagePriceSatang || DEFAULT_PRICE_SATANG;

  return {
    id: cls.id || fallbackClassId,
    name: cls.name || cls.book || t("payment.defaultClassName"),
    price: priceSatang / 100,
    priceSatang,
    tutor: cls.tutor?.name || t("payment.defaultTutor"),
    cefr: cls.book || t("payment.defaultCefr"),
  };
}

export function mergeCheckoutDetails(
  current: CheckoutDetails | null,
  next: CheckoutDetails | null,
): CheckoutDetails | null {
  if (!next) return current;

  return {
    ...next,
    qrCodeDataUri: next.qrCodeDataUri || current?.qrCodeDataUri || null,
  };
}

/**
 * Step to show for an intent that the page resumes (3DS return URL carries
 * `paymentIntentId`): SUCCESS → receipt; a card intent that is not paid yet →
 * the card result screen (pending/failed); anything else → the PromptPay screen.
 */
export function getReturnedPaymentStep(intent: PaymentIntentLike): PaymentStep {
  if (intent.status === "SUCCESS") return "success";
  return normalizePaymentMethod(intent.method) === "card" ? "result" : "qr";
}

/** Maps the API's method string ("card", "CARD", "promptpay"…) to a PaymentMethod, or null when unknown. */
export function normalizePaymentMethod(method: string | null | undefined): PaymentMethod | null {
  const value = method?.trim().toLowerCase();
  if (value === "card") return "card";
  if (value === "promptpay") return "promptpay";
  return null;
}

export function shouldLoadPromptPayQr(intent: PaymentIntentLike): boolean {
  return intent.status !== "SUCCESS" && intent.method === "promptpay";
}

export function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 16)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function formatCardExpiry(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 4)
    .replace(/(.{2})/, "$1/");
}

/** CVV input mask: digits only, at most 4. */
export function sanitizeCardCvv(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

/** Card form values exactly as typed (already masked). Never persisted. */
export type CardFields = {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
};

/** The pay button needs every card field to be filled in. */
export function hasAllCardFields(card: CardFields): boolean {
  return Boolean(card.number && card.name && card.expiry && card.cvv);
}

/** Omise.createToken("card", …) payload built from the masked card fields. */
export function buildOmiseCardPayload(card: CardFields) {
  const [month, year] = card.expiry.split("/");
  const fullYear = year?.length === 2 ? Number(`20${year}`) : Number(year);
  return {
    name: card.name,
    number: card.number.replace(/\s/g, ""),
    expiration_month: Number(month),
    expiration_year: fullYear,
    security_code: card.cvv,
  };
}

// ─── Steps & age check ─────────────────────────────────────────────────────

/** The payment screen for a method. */
export function paymentStepForMethod(method: PaymentMethod): "qr" | "card-form" {
  return method === "promptpay" ? "qr" : "card-form";
}

/**
 * Where "proceed" goes from the method screen: adults and minors with consent
 * skip the age check; unknown/invalid DOBs and minors without consent see it.
 */
export function getProceedStep(
  dateOfBirth: string,
  consentAlreadyGiven: boolean,
  method: PaymentMethod,
  now: Date = new Date(),
): PaymentStep {
  const minor = isUnder18(dateOfBirth, now);
  if (minor === false || (minor === true && consentAlreadyGiven)) {
    return paymentStepForMethod(method);
  }
  return "age-check";
}

/** Guardian fields are shown (and required) for minors without recorded consent. */
export function needsGuardianConsent(
  dateOfBirth: string,
  consentAlreadyGiven: boolean,
  now: Date = new Date(),
): boolean {
  return isUnder18(dateOfBirth, now) === true && !consentAlreadyGiven;
}

export type AgeCheckFields = {
  dateOfBirth: string;
  guardianName: string;
  guardianRelation: string;
  consentAlreadyGiven: boolean;
};

/** Same rule as the age-check button: a valid DOB, plus guardian details when needed. */
export function canSubmitAgeCheck(fields: AgeCheckFields, now: Date = new Date()): boolean {
  if (!isValidDateOfBirth(fields.dateOfBirth, now)) return false;
  if (!needsGuardianConsent(fields.dateOfBirth, fields.consentAlreadyGiven, now)) return true;
  return Boolean(fields.guardianName.trim() && fields.guardianRelation.trim());
}

// ─── Order summary ─────────────────────────────────────────────────────────

type PaymentClassBookCycle = {
  id: string;
  title: string;
  price: number;
  packagePriceSatang: number;
  cefr?: string | null;
};

export type PaymentClassDetails = ClassDetailsLike & {
  cefr?: string | null;
  bookCycles?: PaymentClassBookCycle[] | null;
};

/** What the screens show. `priceSatang` is null when the API gave no price (never the 2,500 fallback). */
export type OrderDisplay = {
  name: string;
  tutor: string;
  cefr: string;
  priceSatang: number | null;
};

/** A real price from the API. 0/missing count as unknown, like the `||` fallback in the order. */
function knownSatang(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Amount to show: the intent's own amount once an intent exists (it is what
 * the student is charged), otherwise the class/cycle price; null = unknown.
 */
export function getDisplayAmountSatang(
  intentAmountSatang: number | null | undefined,
  orderPriceSatang: number | null | undefined,
): number | null {
  return knownSatang(intentAmountSatang) ?? knownSatang(orderPriceSatang);
}

/**
 * Builds the order from GET /classes/:id. `order` is the same object the page
 * always used (it keeps the DEFAULT_PRICE fallback, which the intent payload
 * still uses when the enrollment has no amount); `display` is what the
 * student sees.
 */
export function buildPaymentOrder(
  cls: PaymentClassDetails,
  classId: string,
  cycleId: string,
): { order: OrderSummary; display: OrderDisplay } {
  const cycle = cycleId ? cls.bookCycles?.find((item) => item.id === cycleId) : null;
  if (cycle) {
    const order: OrderSummary = {
      id: classId,
      name: `${cls.name} / ${cycle.title}`,
      price: cycle.price,
      priceSatang: cycle.packagePriceSatang,
      tutor: cls.tutor?.name || t("payment.defaultTutor"),
      cefr: cycle.cefr || cls.cefr || t("payment.defaultCefr"),
    };
    return {
      order,
      display: {
        name: order.name,
        tutor: order.tutor,
        cefr: order.cefr,
        priceSatang: knownSatang(cycle.packagePriceSatang),
      },
    };
  }

  const order = buildOrderSummaryFromClass(cls, classId);
  return {
    order,
    display: {
      name: order.name,
      tutor: order.tutor,
      cefr: order.cefr,
      priceSatang: knownSatang(cls.packagePriceSatang),
    },
  };
}

/** Display for a referral-only checkout (no classId → no class to load, price unknown). */
export function createUnknownOrderDisplay(): OrderDisplay {
  return {
    name: t("payment.defaultClassName"),
    tutor: t("payment.defaultTutor"),
    cefr: t("payment.defaultCefr"),
    priceSatang: null,
  };
}

// ─── PromptPay QR ──────────────────────────────────────────────────────────

/** How long the screen offers a PromptPay QR before asking for a new one. */
export const QR_LIFETIME_MS = 15 * 60_000;

/**
 * Deadline for a QR loaded at `loadedAt` (device clock, like the old
 * countdown). Not derived from intent.createdAt: the API returns the existing
 * pending intent when a new QR is requested, so a createdAt-based deadline
 * would expire again immediately, and device clocks can be off.
 */
export function getQrExpiresAt(loadedAt: number): number {
  return loadedAt + QR_LIFETIME_MS;
}

/** Whole seconds left until `expiresAt` (never negative). */
export function getQrSecondsLeft(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** "mm:ss" for a countdown, e.g. 905 → "15:05". */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Checkout after GET /payments/:id/qr-code: keeps the current checkout and
 * adds the QR image, or builds a minimal pending Omise checkout when there was
 * none yet (same object the page always built).
 */
export function withQrCodeDataUri(
  current: CheckoutDetails | null,
  qr: { chargeId: string; dataUri: string | null },
): CheckoutDetails {
  if (current) return { ...current, qrCodeDataUri: qr.dataUri };
  return {
    provider: "omise",
    chargeId: qr.chargeId,
    status: "pending",
    paid: false,
    authorizeUri: null,
    qrCodeUrl: null,
    qrCodeDataUri: qr.dataUri,
    failureMessage: null,
  };
}

/** What the PromptPay screen's main button does. */
export type QrCtaMode =
  /** No intent yet and nothing running: create the intent + QR. */
  | "create"
  /** Creating the intent / loading the QR. */
  | "creating"
  /** The QR expired or the payment failed: clear it and create a new one. */
  | "regenerate"
  /** A live QR: check the payment status now. */
  | "verify"
  /** A status check is running. */
  | "verifying";

export function getQrCtaMode(state: {
  hasIntent: boolean;
  busy: boolean;
  qrLoading: boolean;
  expired: boolean;
  failed: boolean;
}): QrCtaMode {
  if (!state.hasIntent) return state.busy || state.qrLoading ? "creating" : "create";
  if (state.qrLoading) return "creating";
  if (state.busy) return "verifying";
  if (state.expired || state.failed) return "regenerate";
  return "verify";
}

/** The card result screen (3DS return) shows "failed" for FAILED, otherwise "pending". */
export function getCardResultStatus(intentStatus: string | null | undefined): "pending" | "failed" {
  return intentStatus === "FAILED" ? "failed" : "pending";
}

// ─── Navigation helpers ────────────────────────────────────────────────────

export type PaymentRouteParams = {
  classId: string;
  cycleId: string;
  referralToken: string | null;
};

/** 3DS return URI: the current page without its query, plus classId/cycleId/referralToken. */
export function buildPaymentReturnUri(currentHref: string, params: PaymentRouteParams): string {
  const base = currentHref.split("?")[0];
  const rp = new URLSearchParams();
  if (params.classId) rp.set("classId", params.classId);
  if (params.cycleId) rp.set("cycleId", params.cycleId);
  if (params.referralToken) rp.set("referralToken", params.referralToken);
  return `${base}?${rp.toString()}`;
}

const ENROLLMENT_FIRST_CODES = new Set(["NOT_ENROLLED", "ENROLLMENT_PAYMENT_PENDING"]);
const ENROLLMENT_FIRST_MESSAGES = new Set([
  "Please enroll in the class first",
  "Please complete your class enrollment payment first",
]);

/**
 * True when a book-cycle purchase needs the class enrollment paid first.
 * Matches the API error code (StudentApiError.code) and, for older
 * responses, the English message the page used to compare.
 */
export function isEnrollmentFirstError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  return (
    (typeof code === "string" && ENROLLMENT_FIRST_CODES.has(code)) ||
    (typeof message === "string" && ENROLLMENT_FIRST_MESSAGES.has(message))
  );
}

/** The class-enrollment checkout a book-cycle purchase is sent to first. */
export function buildEnrollmentFirstPath(classId: string, referralToken: string | null): string {
  const enrollUrl = new URLSearchParams({ classId });
  if (referralToken) enrollUrl.set("referralToken", referralToken);
  return `/payment?${enrollUrl.toString()}`;
}

// ─── Errors → friendly Thai copy ───────────────────────────────────────────

export type PaymentFlowErrorKind =
  /** Card payments are not configured (no Omise keys). */
  | "gateway"
  /** omise.js could not be loaded. */
  | "card-script"
  /** Omise rejected the card details while creating a token. */
  | "card-token"
  /** The intent/charge is FAILED. */
  | "failed"
  /** The charge was neither paid, nor redirected, nor a QR. */
  | "incomplete";

/** Errors raised by the checkout itself; `detail` keeps the provider's raw message for logs. */
export class PaymentFlowError extends Error {
  readonly kind: PaymentFlowErrorKind;
  readonly detail: string | null;

  constructor(kind: PaymentFlowErrorKind, detail?: string | null) {
    super(detail || kind);
    this.name = "PaymentFlowError";
    this.kind = kind;
    this.detail = detail ?? null;
  }
}

/**
 * Friendly message for a FAILED charge. `detail` is Omise's failure message
 * (English, only used to spot "insufficient funds"); it is never shown.
 */
export function getChargeFailureKey(detail: string | null | undefined, method: PaymentMethod): I18nKey {
  const text = (detail ?? "").toLowerCase();
  if (method === "card") {
    if (text.includes("insufficient")) return "payment.errors.insufficientFunds";
    return text ? "payment.errors.cardDeclined" : "payment.errors.cardFailed";
  }
  return "payment.errors.qrFailed";
}

/**
 * Maps any checkout error to one short Thai message for a toast. Raw API or
 * Omise messages (English, technical) are never shown to students.
 */
export function getPaymentErrorKey(err: unknown, method: PaymentMethod): I18nKey {
  if (err instanceof PaymentFlowError) {
    switch (err.kind) {
      case "gateway":
        return "payment.errors.omiseNotConfigured";
      case "card-script":
        return "payment.errors.loadOmiseScript";
      case "card-token":
        return "payment.errors.createCardTokenFailed";
      case "failed":
      case "incomplete":
        return getChargeFailureKey(err.detail, method);
    }
  }
  const code = err && typeof err === "object" ? (err as { code?: unknown }).code : undefined;
  if (code === "PAYMENT_IN_PROGRESS") return "payment.errors.paymentInProgress";
  if (code === "PAYMENT_ALREADY_COMPLETED") return "payment.errors.alreadyPaid";
  if (code === "PAYMENT_GATEWAY_NOT_CONFIGURED") return "payment.errors.omiseNotConfigured";
  if (code === "CLASS_FULL" || code === "CLASS_CLOSED") return "payment.errors.classFull";
  if (code === "REFERRAL_INVALID") return "payment.errors.referralInvalid";
  // fetch() network failures reject with a TypeError ("Failed to fetch").
  if (err instanceof TypeError) return "common.networkError";
  return "payment.errors.enrollmentFailed";
}

// ─── Payment history ───────────────────────────────────────────────────────

/** One row of GET /payments/history. */
export type PaymentHistoryRecord = {
  paymentIntentId: string;
  amountMinor: number;
  currency: string;
  method: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
  enrollment: {
    enrollmentId: string;
    status: string;
    class: {
      title: string;
      book: {
        title: string;
        bookCode: string;
      };
    };
  } | null;
};

/** "CODE: Book title" for a class purchase, or null (other expenses). */
export function getPaymentBookLabel(record: Pick<PaymentHistoryRecord, "enrollment">): string | null {
  const book = record.enrollment?.class?.book;
  if (!book?.title) return null;
  return book.bookCode ? `${book.bookCode}: ${book.title}` : book.title;
}

export type PaymentStatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/** Chip tone + label for a payment intent status (SUCCESS / PENDING / FAILED / REFUNDED…). */
export function getPaymentStatusDisplay(status: string | null | undefined): {
  tone: PaymentStatusTone;
  labelKey: I18nKey;
} {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
      return { tone: "success", labelKey: "payment.history.statusSuccess" };
    case "PENDING":
      return { tone: "warning", labelKey: "payment.history.statusPending" };
    case "FAILED":
      return { tone: "danger", labelKey: "payment.history.statusFailed" };
    case "REFUNDED":
      return { tone: "info", labelKey: "payment.history.statusRefunded" };
    default:
      return { tone: "neutral", labelKey: "payment.history.statusOther" };
  }
}

/** Label key for a method; anything that is not PromptPay is a card (as before). */
export function getPaymentMethodLabelKey(method: string | null | undefined): I18nKey {
  return normalizePaymentMethod(method) === "promptpay" ? "payment.methods.promptpay" : "payment.methods.card";
}

export type MonthGroup<T> = { key: string; label: string; items: T[] };

/**
 * Groups items by local calendar month, keeping their order (the API returns
 * newest first). Items with an unreadable date go to a group with an empty label.
 */
export function groupByMonth<T extends { createdAt: string }>(items: T[]): MonthGroup<T>[] {
  const groups: MonthGroup<T>[] = [];
  const byKey = new Map<string, MonthGroup<T>>();
  for (const item of items) {
    const date = toDate(item.createdAt);
    const key = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "unknown";
    let group = byKey.get(key);
    if (!group) {
      group = { key, label: date ? formatThaiMonthYear(date) : "", items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export type InviteEnrollParams = {
  classId: string | null;
  referralToken: string | null;
};

export function parseInviteEnrollParams(inviteText: string): InviteEnrollParams | null {
  const trimmed = inviteText.trim();
  if (!trimmed) return null;

  try {
    const parsedUrl = new URL(trimmed, "https://student-liff.local");
    const classId = parsedUrl.searchParams.get("classId");
    const referralToken =
      parsedUrl.searchParams.get("referralToken") ?? parsedUrl.searchParams.get("token");
    if (!classId && !referralToken) return null;
    return { classId, referralToken };
  } catch {
    const classIdMatch = trimmed.match(/[?&]classId=([^&]+)/);
    const tokenMatch = trimmed.match(/[?&](?:referralToken|token)=([^&]+)/);
    const classId = classIdMatch?.[1] ? decodeURIComponent(classIdMatch[1]) : null;
    const referralToken = tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : null;
    if (!classId && !referralToken) return null;
    return { classId, referralToken };
  }
}

export function buildEnrollPathFromInviteText(inviteText: string): string | null {
  const params = parseInviteEnrollParams(inviteText);
  if (!params) return null;

  const searchParams = new URLSearchParams();
  if (params.classId) searchParams.set("classId", params.classId);
  if (params.referralToken) searchParams.set("referralToken", params.referralToken);
  return `/enroll?${searchParams.toString()}`;
}

export function parseClassIdFromQrText(scannedText: string): string | null {
  return parseInviteEnrollParams(scannedText)?.classId ?? null;
}
