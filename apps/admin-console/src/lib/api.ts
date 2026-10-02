/**
 * Browser → backend API client for the admin console.
 *
 * Every call goes through the same-origin proxy (`/api/proxy/v1/...`), which
 * reads the httpOnly admin_token, checks the endpoint allowlist and forwards
 * with the bearer token. Never call backend services directly and never read
 * the token in client code.
 *
 * New code: `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch`,
 * `api.delete`, `api.download(path)`. They throw {@link ApiError}, whose
 * `.message` is already a Thai, user-facing message (error code → Thai map
 * below, else the server message, else a status-based message).
 * Mutations send an `Idempotency-Key` (pass your own to make a retry of the
 * same user action reuse it). A 401 clears the session once and goes to /login.
 *
 * Legacy helpers (`fetchWithAuth`, `fetchBlobWithAuth`, `downloadBlob`,
 * `getAdmin*`) keep their old signatures for unmigrated pages.
 */
import { HttpError } from "./cachedResource";
import { t } from "./i18n";

/* ─── Error codes → Thai ─────────────────────────────────────────────────── */

/**
 * Thai messages for backend error codes (`{ error: { code, message } }`).
 * Page groups: append codes your endpoints return (keep messages actionable).
 */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  UNAUTHORIZED_ROLE: "บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้",
  ACCOUNT_SUSPENDED: "บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ",
  AUTHENTICATION_UNAVAILABLE: "ระบบยืนยันตัวตนไม่พร้อมใช้งานชั่วคราว กรุณาลองใหม่",
  NOT_FOUND: "ไม่พบข้อมูลที่ต้องการ อาจถูกลบหรือเปลี่ยนแปลงแล้ว",
  BAD_REQUEST: "ข้อมูลที่ส่งไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
  OPENAPI_REQUEST_VALIDATION_FAILED: "ข้อมูลหรือตัวกรองที่ส่งไม่ถูกต้องตามรูปแบบที่ระบบรองรับ",
  INTERNAL_SERVER_ERROR: "ระบบขัดข้อง กรุณาลองใหม่ภายหลัง",
  SERVICE_UNREACHABLE: "บริการปลายทางไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
  PROXY_PATH_NOT_ALLOWED: "คอนโซลไม่อนุญาตให้เรียกใช้งานรายการนี้",
  PROXY_METHOD_NOT_ALLOWED: "คอนโซลไม่อนุญาตให้เรียกใช้งานรายการนี้",
  PROXY_ROLE_NOT_ALLOWED: "บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้",
  CROSS_SITE_REQUEST: "คำขอถูกปฏิเสธเพื่อความปลอดภัย กรุณาโหลดหน้าใหม่",
  IDEMPOTENCY_KEY_REUSED: "รายการนี้ถูกส่งไปแล้ว กรุณารีเฟรชเพื่อดูสถานะล่าสุด",
  INVALID_IDEMPOTENCY_KEY: "คำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง",
  // Settlements
  DRAFT_EXISTS: "มีรอบจ่ายเงินฉบับร่างของเดือนนี้อยู่แล้ว เปิดรอบนั้นแล้วกด “คำนวณใหม่” แทนการสร้างใหม่",
  PENDING_ADJUSTMENTS_EXIST: "ยังมีรายการปรับปรุงยอดรออนุมัติในรอบนี้ อนุมัติหรือปฏิเสธให้ครบก่อน",
  PAYOUT_IDENTITY_CHANGED: "ข้อมูลบัญชีรับเงินของครูเปลี่ยนหลังคำนวณรอบนี้ ต้องตีกลับและคำนวณใหม่ก่อนอนุมัติ",
  SETTLEMENT_IMMUTABLE: "รอบจ่ายเงินนี้ถูกล็อกแล้ว แก้ไขไม่ได้",
  SETTLEMENT_ALREADY_CLAIMED: "มีผู้ดำเนินการกับรอบจ่ายเงินนี้อยู่แล้ว กรุณารีเฟรช",
  SETTLEMENT_NOT_APPROVED: "รอบจ่ายเงินนี้ยังไม่ได้รับอนุมัติ",
  SETTLEMENT_PERIOD_MISMATCH: "เดือนของรอบจ่ายเงินไม่ตรงกับข้อมูลที่เลือก",
  INVALID_PERIOD_MONTH: "รูปแบบเดือนไม่ถูกต้อง",
  NOT_SETTLEMENT_DAY: "ยังไม่ถึงวันคำนวณรอบจ่ายเงิน",
  INVALID_STATUS: "สถานะปัจจุบันไม่อนุญาตให้ทำรายการนี้ กรุณารีเฟรช",
  // Transfers
  MISSING_OMISE_RECIPIENT: "ครูยังไม่มีบัญชีรับเงิน (Omise recipient)",
  OMISE_TRANSFER_FAILED: "โอนเงินผ่าน Omise ไม่สำเร็จ",
  OMISE_PAYOUTS_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่าการโอนเงินผ่าน Omise",
  OMISE_PRIVATE_KEY_NOT_CONFIGURED: "ยังไม่ได้ตั้งค่าการโอนเงินผ่าน Omise",
  TRANSFER_ALREADY_ACTIVE: "มีการโอนเงินรายการนี้อยู่แล้ว",
  TRANSFER_RECOVERY_FAILED: "ตรวจสอบสถานะการโอนไม่สำเร็จ กรุณาลองใหม่",
  NO_TRANSFER_REQUIRED: "รายการนี้ไม่ต้องโอนเงิน",
  PAYOUT_LINE_NOT_FOUND: "ไม่พบรายการจ่ายเงินนี้",
  PAYOUT_LINE_NOT_IN_SETTLEMENT: "รายการจ่ายเงินไม่อยู่ในรอบนี้",
  // Settlements (G2): freshness + empty-run guards
  SETTLEMENT_EMPTY: "รอบนี้ไม่มีรายการจ่ายเงิน (0 รายการ) จึงส่งตรวจหรืออนุมัติไม่ได้",
  SETTLEMENT_NOT_PREVIEWED: "รอบนี้ยังไม่เคยคำนวณ กรุณาคำนวณก่อนส่งตรวจหรืออนุมัติ",
  SETTLEMENT_STALE: "ข้อมูลของรอบนี้เปลี่ยนหลังคำนวณ (ปรับยอด การชำระเงิน หรือบัญชีรับเงินของครู) ต้องคำนวณใหม่ก่อนส่งตรวจหรืออนุมัติ",
  SETTLEMENT_NOT_STALE: "รอบนี้ยังตรงกับข้อมูลล่าสุดและรอผู้ตรวจสอบอยู่ ไม่ต้องคำนวณใหม่",
  // Adjustments / coupons / users
  INVALID_AMOUNT: "จำนวนเงินไม่ถูกต้อง",
  INVALID_TUTOR_ID: "รหัสครูไม่ถูกต้อง กรุณาเลือกครูจากรายการ",
  TUTOR_NOT_FOUND: "ไม่พบครูตามรหัสที่ระบุ",
  INVALID_HOURS: "จำนวนชั่วโมงไม่ถูกต้อง",
  INVALID_EXPIRY: "วันหมดอายุไม่ถูกต้อง",
  CANNOT_VOID: "คูปองนี้ยกเลิกไม่ได้แล้ว",
  // Coupons (G5)
  COUPON_NOT_EDITABLE: "แก้ไขได้เฉพาะคูปองที่ยังใช้งานได้ คูปองนี้ถูกใช้หรือยกเลิกไปแล้ว กรุณารีเฟรช",
  INVALID_NOTE: "หมายเหตุยาวเกินไป (ไม่เกิน 500 ตัวอักษร)",
  INVALID_REASON: "กรุณาระบุเหตุผล 5–500 ตัวอักษร",
  SPONSOR_TREE_CYCLE: "โครงสร้างผู้แนะนำวนซ้ำ กรุณาตรวจสอบข้อมูลครู",
  ENROLLMENT_NOT_FOUND: "ไม่พบการลงทะเบียนเรียนนี้",
  PAYMENT_INTENT_NOT_FOUND: "ไม่พบรายการชำระเงินนี้",
  // Users, verification and roles (G4)
  USER_NOT_FOUND: "ไม่พบผู้ใช้นี้ อาจถูกลบหรือรหัสไม่ถูกต้อง",
  NO_PENDING_VERIFICATION: "ไม่มีเอกสารที่รอตรวจสอบแล้ว กรุณารีเฟรช",
  VERIFICATION_CHANGED: "ครูส่งหรือแก้ไขเอกสารระหว่างที่คุณตรวจ กรุณาโหลดใหม่แล้วตรวจอีกครั้ง",
  VERIFICATION_NOT_SUBMITTED: "อนุมัติหรือปฏิเสธได้เฉพาะรายการที่ครูส่งมาและรอตรวจสอบเท่านั้น",
  VERIFICATION_DATA_MISSING: "ยังไม่มีเอกสารหรือข้อมูลของรายการนี้ จึงอนุมัติไม่ได้",
  INVALID_VERIFICATION_FIELD: "รายการเอกสารไม่ถูกต้อง",
  REJECT_REASON_REQUIRED: "กรุณาระบุเหตุผลที่ไม่อนุมัติ",
  USER_ANONYMIZED: "บัญชีนี้ถูกลบข้อมูลส่วนบุคคลแล้ว ทำรายการนี้ไม่ได้",
  USER_HAS_OPEN_PAYOUTS: "ครูยังมีรายการจ่ายเงินที่ยังไม่เสร็จสิ้น ลบข้อมูลได้หลังจ่ายเงินครบแล้ว",
  STAFF_ACCOUNT: "บัญชีนี้เป็นบัญชีเจ้าหน้าที่ จัดการได้ที่หน้าสิทธิ์การใช้งาน",
  CANNOT_CHANGE_SELF: "เปลี่ยนสิทธิ์หรือสถานะบัญชีของตัวเองไม่ได้",
  INVALID_OMISE_RECIPIENT: "รหัสบัญชีรับเงิน Omise ต้องขึ้นต้นด้วย recp_",
  NOT_A_TUTOR: "ผู้ใช้นี้ไม่ใช่ครู",
  ROLE_TRANSITION_NOT_ALLOWED: "ให้สิทธิ์เจ้าหน้าที่กับบัญชีครูหรือนักเรียนไม่ได้ กรุณาใช้อีเมลสำหรับงานเจ้าหน้าที่แยกต่างหาก",
  LAST_ADMIN: "ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน",
  REASON_REQUIRED: "กรุณาระบุเหตุผล (อย่างน้อย 5 ตัวอักษร)",
  INVALID_EMAIL: "รูปแบบอีเมลไม่ถูกต้อง",
  INVALID_ROLE: "สิทธิ์ที่เลือกไม่ถูกต้อง",
  CONCURRENT_UPDATE: "มีการเปลี่ยนแปลงพร้อมกัน กรุณาลองใหม่",
  // Payments operations: reconciliation, exceptions, fraud (G3)
  PAYMENT_NOT_SUCCESSFUL: "รายการนี้ยังไม่ได้ชำระเงินสำเร็จ จึงเปิดสิทธิ์เรียนไม่ได้ ให้ตรวจสอบกับ Omise ก่อน",
  ENROLLMENT_TARGET_NOT_FOUND: "ไม่พบการลงเรียนหรือแพ็กเกจที่ผูกกับการชำระเงินนี้",
  ENROLLMENT_STATE_NOT_ACTIVATABLE: "สถานะการลงเรียนปัจจุบัน (เช่น คืนเงินแล้วหรือย้ายคลาสแล้ว) เปิดสิทธิ์ซ้ำไม่ได้",
  NO_SUCCESSFUL_PAYMENT: "ยังไม่พบการชำระเงินที่สำเร็จของนักเรียนในคลาสนี้ ตรวจสอบกับ Omise ในหน้าตรวจสอบการชำระเงินก่อน",
  NO_PROVIDER_REF: "รายการนี้ไม่มีรหัสการชำระเงินของ Omise ให้ตรวจสอบ",
  PROVIDER_UNAVAILABLE: "เชื่อมต่อ Omise ไม่ได้ในขณะนี้ กรุณาลองใหม่ภายหลัง",
  CHARGE_VERIFICATION_FAILED: "ข้อมูลการชำระเงินใน Omise ไม่ตรงกับรายการนี้ (รหัส ยอดเงิน สกุลเงิน หรือ metadata) ระบบจึงไม่เปลี่ยนสถานะ",
  CHARGE_REF_MISMATCH: "รหัสการชำระเงินใน webhook ไม่ตรงกับรายการชำระเงินที่เลือก",
  EVENT_ALREADY_LINKED: "เหตุการณ์นี้ถูกจับคู่กับรายการชำระเงินแล้ว กรุณารีเฟรช",
  INVALID_ISSUE_FILTER: "ตัวกรองประเภทปัญหาไม่ถูกต้อง",
  INVALID_STATUS_FILTER: "ตัวกรองสถานะไม่ถูกต้อง",
  INVALID_SEVERITY_FILTER: "ตัวกรองระดับความเสี่ยงไม่ถูกต้อง",
  UNSUPPORTED_EXCEPTION_ACTION: "วิธีปิดเคสนี้ไม่รองรับแล้ว กรุณาโหลดหน้าใหม่",
  EXCEPTION_ALREADY_CLOSED: "เคสนี้ถูกปิดไปแล้ว กรุณารีเฟรช",
  INVALID_FRAUD_ACTION: "การดำเนินการไม่ถูกต้อง",
  ADMIN_REQUIRED: "เฉพาะผู้ดูแลระบบเท่านั้นที่ระงับหรือปลดระงับบัญชีได้",
  FLAG_NOT_FROZEN: "รายการนี้ไม่ได้อยู่ในสถานะระงับ กรุณารีเฟรช",
  FRAUD_TARGET_NOT_USER: "เป้าหมายของรายการนี้ไม่ใช่บัญชีผู้ใช้ จึงระงับบัญชีไม่ได้",
  CANNOT_SUSPEND_STAFF: "ระงับบัญชีเจ้าหน้าที่จากหน้านี้ไม่ได้ ให้จัดการที่หน้าสิทธิ์การใช้งาน",
};

/* ─── ApiError ───────────────────────────────────────────────────────────── */

export interface ApiErrorBody {
  error?: string | { code?: string; message?: string; details?: unknown; requestId?: string; [key: string]: unknown };
  message?: string;
  [key: string]: unknown;
}

/** Error thrown by the API client. `message` is Thai and safe to show in a toast. */
export class ApiError extends HttpError {
  /** Backend error code, e.g. "DRAFT_EXISTS" (or null). */
  code: string | null;
  /** Server's original (often English) message, for logs only. */
  serverMessage: string | null;
  details: unknown;
  requestId: string | null;

  constructor(status: number, body: unknown) {
    const parsed = parseErrorBody(body);
    super(status, messageFor(status, parsed.code, parsed.message), body);
    this.name = "ApiError";
    this.code = parsed.code;
    this.serverMessage = parsed.message;
    this.details = parsed.details;
    this.requestId = parsed.requestId;
  }
}

function parseErrorBody(body: unknown): { code: string | null; message: string | null; details: unknown; requestId: string | null } {
  const empty = { code: null, message: null, details: undefined, requestId: null };
  if (typeof body === "string") return { ...empty, message: body.trim() || null };
  if (!body || typeof body !== "object") return empty;
  const record = body as ApiErrorBody;
  const error = record.error;
  if (typeof error === "string") return { ...empty, message: error };
  if (error && typeof error === "object") {
    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : null,
      details: error.details ?? error,
      requestId: typeof error.requestId === "string" ? error.requestId : null,
    };
  }
  return { ...empty, code: typeof record.code === "string" ? record.code : null, message: typeof record.message === "string" ? record.message : null };
}

function statusMessage(status: number): string {
  if (status === 0) return t("api.networkError");
  if (status === 400 || status === 422) return t("api.status400");
  if (status === 401) return t("api.status401");
  if (status === 403) return t("api.status403");
  if (status === 404) return t("api.status404");
  if (status === 409) return t("api.status409");
  if (status === 429) return t("api.status429");
  if (status === 503) return t("api.status503");
  if (status >= 500) return t("api.status5xx");
  return t("api.genericError");
}

/**
 * User-facing Thai message: known error code → Thai; else the server message
 * when it is not a generic/technical one; else a status-based Thai message.
 */
export function messageFor(status: number, code: string | null, serverMessage: string | null): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (serverMessage && status < 500 && !/^(HTTP \d+|Internal Server Error|Unauthorized|Bad Request)$/i.test(serverMessage)) {
    return serverMessage;
  }
  return statusMessage(status);
}

/** Thai message for anything caught in a try/catch (ApiError, Error, unknown). */
export function errorMessage(error: unknown, fallback: string = t("api.genericError")): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/* ─── Request core ───────────────────────────────────────────────────────── */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

let unauthorizedHandled = false;

async function handleUnauthorized() {
  if (typeof window === "undefined" || unauthorizedHandled) return;
  unauthorizedHandled = true;
  try {
    const { clearResourceCache } = await import("./cachedResource");
    clearResourceCache(undefined, { revalidate: false });
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {
    console.error("Failed to clear session:", e);
  }
  if (window.location.pathname !== "/login") {
    const next = window.location.pathname + window.location.search;
    window.location.href = next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
  }
}

function toProxyUrl(url: string) {
  return url.startsWith("/v1/") || url === "/v1" ? `/api/proxy${url}` : url;
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body (serialised for you) or FormData/Blob/string. */
  body?: unknown;
  /** Query params appended to the path (undefined/null/"" values are skipped). */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Reuse a key when retrying the same user action. Auto-generated for mutations. */
  idempotencyKey?: string;
}

function withQuery(path: string, query?: ApiRequestOptions["query"]) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  if (!qs) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${qs}`;
}

async function send(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { body, query, idempotencyKey, headers: rawHeaders, ...init } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(rawHeaders);
  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof FormData !== "undefined" && body instanceof FormData) payload = body;
    else if (typeof Blob !== "undefined" && body instanceof Blob) payload = body;
    else if (typeof body === "string") payload = body;
    else payload = JSON.stringify(body);
  }
  if (payload !== undefined && !headers.has("Content-Type") && !(typeof FormData !== "undefined" && payload instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (MUTATING.has(method) && !headers.has("Idempotency-Key")) {
    headers.set("Idempotency-Key", idempotencyKey ?? newIdempotencyKey());
  }
  let response: Response;
  try {
    response = await fetch(toProxyUrl(withQuery(path, query)), { cache: "no-store", ...init, method, headers, body: payload });
  } catch {
    throw new ApiError(0, undefined);
  }
  if (response.status === 401) {
    void handleUnauthorized();
  }
  return response;
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const isJson = response.headers.get("content-type")?.includes("application/json");
  try {
    return isJson ? await response.json() : await response.text();
  } catch {
    return undefined;
  }
}

/** Request JSON through the proxy; throws ApiError on non-2xx. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const data = await readBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as T;
}

/** Same-origin JSON fetcher for useCachedResource (alias of api.get). */
export function fetchJson<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, options);
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiRequestOptions, "method" | "body">) => apiRequest<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<ApiRequestOptions, "method">) => apiRequest<T>(path, { ...options, method: "DELETE" }),
  /** GET a file (CSV export) and save it. Filename from Content-Disposition, else `fallbackName`. */
  download: async (path: string, fallbackName: string, options?: Omit<ApiRequestOptions, "method" | "body">) => {
    const response = await send(path, { ...options, method: "GET" });
    if (!response.ok) throw new ApiError(response.status, await readBody(response));
    const disposition = response.headers.get("content-disposition") ?? "";
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
    downloadBlob(await response.blob(), match ? decodeURIComponent(match[1]) : fallbackName);
  },
};

/* ─── Legacy helpers (unmigrated pages) ──────────────────────────────────── */

/**
 * @deprecated Use `api.get/post/...`. Kept API-compatible: returns parsed
 * JSON (or text), throws an Error (ApiError) whose message is user-facing.
 * Mutations now also send an Idempotency-Key.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body && typeof FormData !== "undefined" && options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const response = await send(url, { ...options, headers, body: options.body ?? undefined });
  const data = await readBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** @deprecated Use `api.download()`. */
export async function fetchBlobWithAuth(url: string, options: RequestInit = {}) {
  const response = await send(url, { ...options, body: options.body ?? undefined });
  if (!response.ok) throw new ApiError(response.status, await readBody(response));
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

/**
 * @deprecated Display hints only (never for authorization). In components
 * under the shell use `useAdminSession()` from "@/components/app" instead.
 */
export function getAdminRole(): string {
  return readCookie("admin_role");
}
/** @deprecated see getAdminRole */
export function getAdminEmail(): string {
  return readCookie("admin_email");
}
/** @deprecated see getAdminRole */
export function getAdminUserId(): string {
  return readCookie("admin_user_id");
}
/** @deprecated see getAdminRole */
export function getAdminName(): string {
  return readCookie("admin_name");
}
/** @deprecated see getAdminRole */
export function getAdminPicture(): string {
  return readCookie("admin_picture");
}
