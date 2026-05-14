export type PaymentMethod = "promptpay" | "card";
export type PaymentStep = "select" | "age-check" | "qr" | "card-form" | "success";

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
    name: "Loading class...",
    price: DEFAULT_PRICE_SATANG / 100,
    priceSatang: DEFAULT_PRICE_SATANG,
    tutor: "Tutor Advantage",
    cefr: "Reading Advantage",
  };
}

export function buildOrderSummaryFromClass(
  cls: ClassDetailsLike,
  fallbackClassId: string,
): OrderSummary {
  const priceSatang = cls.packagePriceSatang || DEFAULT_PRICE_SATANG;

  return {
    id: cls.id || fallbackClassId,
    name: cls.name || cls.book || "Reading Advantage Class",
    price: priceSatang / 100,
    priceSatang,
    tutor: cls.tutor?.name || "Tutor Advantage",
    cefr: cls.book || "Reading Advantage",
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

export function parseClassIdFromQrText(scannedText: string): string | null {
  if (!scannedText.trim()) return null;

  try {
    const parsedUrl = new URL(scannedText);
    const classId = parsedUrl.searchParams.get("classId");
    return classId || null;
  } catch {
    const match = scannedText.match(/[?&]classId=([^&]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }
}
