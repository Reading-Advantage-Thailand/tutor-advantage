import { t } from "./i18n";

export type PaymentMethod = "promptpay" | "card";
export type PaymentStep = "select" | "age-check" | "qr" | "card-form" | "success";

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

export function getReturnedPaymentStep(intent: PaymentIntentLike): PaymentStep {
  return intent.status === "SUCCESS" ? "success" : "qr";
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
