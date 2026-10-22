type OmiseChargeStatus =
  | "failed"
  | "expired"
  | "pending"
  | "reversed"
  | "successful";

export type OmiseCharge = {
  id: string;
  amount: number;
  currency: string;
  status: OmiseChargeStatus;
  paid: boolean;
  metadata?: Record<string, string>;
  authorize_uri?: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  /** Total refunded so far, in satang. */
  refunded_amount?: number | null;
  /** "3DS" or "PASSKEY" when the cardholder was authenticated; absent otherwise. */
  authenticated_by?: string | null;
  card?: {
    id?: string;
    fingerprint?: string | null;
    brand?: string | null;
    bank?: string | null;
    country?: string | null;
    last_digits?: string | null;
  } | null;
  source?: {
    id?: string;
    scannable_code?: {
      image?: {
        download_uri?: string;
      };
    };
  } | null;
};

/** Omise returns either an id string or an expanded object for references. */
export type OmiseRef = string | { id?: string | null } | null | undefined;

export function omiseRefId(ref: OmiseRef): string | null {
  if (typeof ref === "string") return ref.trim() || null;
  if (ref && typeof ref === "object" && typeof ref.id === "string") return ref.id.trim() || null;
  return null;
}

export type OmiseDisputeStatus = "open" | "pending" | "won" | "lost" | "closed";

export type OmiseDispute = {
  object?: "dispute";
  id: string;
  amount: number;
  currency: string;
  status: OmiseDisputeStatus | string;
  charge: OmiseRef;
  reason_code?: string | null;
  reason_message?: string | null;
  created_at?: string | null;
  closed_at?: string | null;
  metadata?: Record<string, string>;
};

export type OmiseRefund = {
  object?: "refund";
  id: string;
  amount: number;
  currency: string;
  charge: OmiseRef;
  status?: string | null;
  voided?: boolean;
  created_at?: string | null;
  metadata?: Record<string, string>;
};

export type OmiseToken = {
  id: string;
  used?: boolean;
  card?: { fingerprint?: string | null; brand?: string | null; country?: string | null } | null;
};

type OmiseList<T> = { object?: "list"; data?: T[]; total?: number; offset?: number; limit?: number };

export type OmiseTransfer = {
  id: string;
  amount: number;
  paid: boolean;
  paid_at?: string | null;
  sent: boolean;
  sent_at?: string | null;
  sendable: boolean;
  failure_code?: string | null;
  failure_message?: string | null;
  recipient?: string | null;
  metadata?: Record<string, string>;
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

type CreateTransferInput = {
  amount: number;
  recipient: string;
  metadata?: Record<string, string>;
  failFast?: boolean;
  idempotencyKey?: string;
};

const OMISE_API_BASE_URL = process.env.OMISE_API_BASE_URL || "https://api.omise.co";
const OMISE_VAULT_BASE_URL = process.env.OMISE_VAULT_BASE_URL || "https://vault.omise.co";

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

export async function retrieveOmiseDispute(disputeId: string) {
  return omiseRequest<OmiseDispute>(`/disputes/${encodeURIComponent(disputeId)}`, {
    method: "GET",
  });
}

/**
 * Reads a card token before charging it (vault API, public key) so the card
 * fingerprint can be checked first. The token stays usable afterwards.
 */
export async function retrieveOmiseToken(tokenId: string): Promise<OmiseToken> {
  const publicKey = process.env.OMISE_PUBLIC_KEY;
  if (!publicKey) throw new Error("OMISE_PUBLIC_KEY_NOT_CONFIGURED");
  const response = await fetch(
    `${OMISE_VAULT_BASE_URL}/tokens/${encodeURIComponent(tokenId)}`,
    {
      method: "GET",
      headers: { Authorization: `Basic ${Buffer.from(`${publicKey}:`).toString("base64")}` },
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.code || `Omise token request failed with status ${response.status}`);
  }
  return payload as OmiseToken;
}

async function listAll<T>(path: string, from: Date, maxPages = 20): Promise<T[]> {
  const items: T[] = [];
  const limit = 100;
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      from: from.toISOString(),
      limit: String(limit),
      offset: String(page * limit),
      order: "chronological",
    });
    const payload = await omiseRequest<OmiseList<T> | T[]>(`${path}?${params.toString()}`, {
      method: "GET",
    });
    const data = Array.isArray(payload) ? payload : payload.data ?? [];
    items.push(...data);
    const total = Array.isArray(payload) ? data.length : payload.total ?? data.length;
    if (data.length < limit || items.length >= total) break;
  }
  return items;
}

/** Disputes created since `from` (all statuses). */
export async function listOmiseDisputes(from: Date) {
  return listAll<OmiseDispute>("/disputes", from);
}

/** Refunds created since `from`. */
export async function listOmiseRefunds(from: Date) {
  return listAll<OmiseRefund>("/refunds", from);
}

type CreateRecipientInput = {
  name: string;
  email?: string;
  bankAccountBrand: string;
  bankAccountNumber: string;
  bankAccountName: string;
};

export type OmiseRecipient = {
  id: string;
  name: string;
  verified: boolean;
  active: boolean;
  bank_account?: {
    brand: string;
    last_digits: string;
    name: string;
  };
};

export async function createOmiseRecipient(input: CreateRecipientInput): Promise<OmiseRecipient> {
  const params = new URLSearchParams();
  params.set("name", input.name);
  if (input.email) params.set("email", input.email);
  params.set("type", "individual");
  params.set("bank_account[brand]", input.bankAccountBrand);
  params.set("bank_account[number]", input.bankAccountNumber);
  params.set("bank_account[name]", input.bankAccountName);

  return omiseRequest<OmiseRecipient>("/recipients", {
    method: "POST",
    body: params,
  });
}

export async function createOmiseTransfer(input: CreateTransferInput) {
  const params = new URLSearchParams();
  params.set("amount", String(input.amount));
  params.set("recipient", input.recipient);
  params.set("fail_fast", String(input.failFast ?? true));

  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    params.set(`metadata[${key}]`, value);
  }

  return omiseRequest<OmiseTransfer>("/transfers", {
    method: "POST",
    body: params,
    headers: input.idempotencyKey
      ? { "Idempotency-Key": input.idempotencyKey }
      : undefined,
  });
}

export async function listOmiseTransfers() {
  const payload = await omiseRequest<OmiseTransfer[] | { data?: OmiseTransfer[] }>(
    "/transfers",
    { method: "GET" },
  );
  return Array.isArray(payload) ? payload : payload.data ?? [];
}

export async function retrieveOmiseTransfer(transferId: string) {
  return omiseRequest<OmiseTransfer>(`/transfers/${encodeURIComponent(transferId)}`, {
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
