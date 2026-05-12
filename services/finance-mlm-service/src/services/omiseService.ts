type OmiseChargeStatus =
  | "failed"
  | "expired"
  | "pending"
  | "reversed"
  | "successful";

export type OmiseCharge = {
  id: string;
  status: OmiseChargeStatus;
  paid: boolean;
  authorize_uri?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  source?: {
    id?: string;
    scannable_code?: {
      image?: {
        download_uri?: string;
      };
    };
  } | null;
};

type CreateChargeInput = {
  amount: number;
  currency: string;
  description: string;
  paymentIntentId: string;
  enrollmentId: string;
  studentUserId: string;
  returnUri: string;
  method: "promptpay" | "card";
  cardToken?: string;
  ip?: string;
};

const OMISE_API_BASE_URL = process.env.OMISE_API_BASE_URL || "https://api.omise.co";

export function getOmisePublicKey() {
  return process.env.OMISE_PUBLIC_KEY || "";
}

export function isOmiseConfigured() {
  return Boolean(process.env.OMISE_PRIVATE_KEY && process.env.OMISE_PUBLIC_KEY);
}

export async function createOmiseCharge(input: CreateChargeInput) {
  const params = new URLSearchParams();
  params.set("amount", String(input.amount));
  params.set("currency", input.currency.toLowerCase());
  params.set("description", input.description);
  params.set("return_uri", input.returnUri);
  params.set("metadata[paymentIntentId]", input.paymentIntentId);
  params.set("metadata[enrollmentId]", input.enrollmentId);
  params.set("metadata[studentUserId]", input.studentUserId);
  params.set("metadata[method]", input.method);

  if (input.ip) {
    params.set("ip", input.ip);
  }

  if (input.method === "card") {
    if (!input.cardToken) {
      throw new Error("OMISE_CARD_TOKEN_REQUIRED");
    }
    params.set("card", input.cardToken);
  } else {
    params.set("source[type]", "promptpay");
    params.set("source[amount]", String(input.amount));
    params.set("source[currency]", input.currency.toLowerCase());
    params.set("source[qr_settings][image_type]", "png");
  }

  return omiseRequest<OmiseCharge>("/charges", {
    method: "POST",
    body: params,
  });
}

export async function retrieveOmiseCharge(chargeId: string) {
  return omiseRequest<OmiseCharge>(`/charges/${encodeURIComponent(chargeId)}`, {
    method: "GET",
  });
}

export async function downloadOmiseDocumentAsDataUri(downloadUri: string) {
  const secretKey = process.env.OMISE_PRIVATE_KEY;
  if (!secretKey) {
    throw new Error("OMISE_PRIVATE_KEY_NOT_CONFIGURED");
  }

  const url = new URL(downloadUri);
  const expectedHost = new URL(OMISE_API_BASE_URL).host;
  if (url.host !== expectedHost || !url.pathname.startsWith("/charges/")) {
    throw new Error("INVALID_OMISE_DOCUMENT_URL");
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Could not download Omise document: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/svg+xml";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

async function omiseRequest<T>(path: string, init: RequestInit): Promise<T> {
  const secretKey = process.env.OMISE_PRIVATE_KEY;
  if (!secretKey) {
    throw new Error("OMISE_PRIVATE_KEY_NOT_CONFIGURED");
  }

  const response = await fetch(`${OMISE_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.code ||
      `Omise API request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}
