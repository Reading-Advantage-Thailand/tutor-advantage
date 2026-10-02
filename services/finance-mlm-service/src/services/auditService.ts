import { logger } from "@tutor-advantage/shared-config";
import { prisma } from "@tutor-advantage/database";
import type { Prisma } from "@tutor-advantage/database";

/**
 * Shared audit-event writer for finance-mlm-service (owner: admin G1).
 *
 * Every admin action that changes money, identity, roles or access must write
 * ONE row to finance_mlm.audit_events through this helper so the admin
 * "/audit" page can find it. Rows are append-only.
 *
 * @example (non-blocking, after the change succeeded)
 *   await recordAuditEvent({
 *     actorId: req.user?.userId,
 *     action: AUDIT_ACTIONS.USER_VERIFY,
 *     entityType: AUDIT_ENTITY.USER,
 *     entityId: id,
 *     payload: { field, status, previousStatus, newStatus, reason },
 *     requestId: req.id,
 *   });
 *
 * @example (atomic with the change: throws, so the transaction rolls back)
 *   await prisma.$transaction(async (tx) => {
 *     await tx.user.update(...);
 *     await recordAuditEvent({ ... }, { client: tx, strict: true });
 *   });
 */

/** Canonical action names. Keep in sync with apps/admin-console/src/app/audit/auditLabels.ts. */
export const AUDIT_ACTIONS = {
  // Settlements (already written by settlementController / auditTrailMiddleware)
  PREVIEW_SETTLEMENT: "PREVIEW_SETTLEMENT",
  SETTLEMENT_REFRESH: "SETTLEMENT_REFRESH",
  SUBMIT: "SUBMIT",
  SUBMIT_SETTLEMENT: "SUBMIT_SETTLEMENT",
  APPROVE: "APPROVE",
  APPROVE_SETTLEMENT: "APPROVE_SETTLEMENT",
  REJECT: "REJECT",
  EXPORT: "EXPORT",
  RETRY_PAYOUT_TRANSFER: "RETRY_PAYOUT_TRANSFER",
  // Adjustments
  ADJUST_CREATE: "ADJUST_CREATE",
  ADJUST_APPROVE: "ADJUST_APPROVE",
  ADJUST_REJECT: "ADJUST_REJECT",
  // Users / identity (G4 call sites)
  USER_VERIFY: "USER_VERIFY",
  USER_SUSPEND: "USER_SUSPEND",
  USER_UNSUSPEND: "USER_UNSUSPEND",
  USER_ANONYMIZE: "USER_ANONYMIZE",
  USER_OMISE_RECIPIENT_UPDATE: "USER_OMISE_RECIPIENT_UPDATE",
  USER_PII_REVEAL: "USER_PII_REVEAL",
  ROLE_CHANGE: "ROLE_CHANGE",
  // Coupons (G5)
  COUPON_CREATE: "COUPON_CREATE",
  COUPON_VOID: "COUPON_VOID",
  // Audit log itself
  AUDIT_EXPORT: "AUDIT_EXPORT",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS] | string;

/** Canonical entity types (PascalCase model names). */
export const AUDIT_ENTITY = {
  SETTLEMENT_RUN: "SettlementRun",
  PAYOUT_LINE: "PayoutLine",
  ADJUSTMENT: "Adjustment",
  USER: "User",
  EXCEPTION: "Exception",
  FRAUD_FLAG: "FraudFlag",
  COUPON: "Coupon",
  AUDIT_LOG: "AuditLog",
} as const;

export const SYSTEM_ACTOR = "SYSTEM";

const SENSITIVE_KEY = /(password|token|secret|cvv|cardnumber|^pan$|bankaccount|accountnumber|privatekey|nationalid|idcardnumber|taxid)/i;
const MAX_STRING = 2000;
const MAX_DEPTH = 5;

/** Deep copy with secrets/PII keys redacted and long strings truncated (JSON-safe). */
export function redactAuditPayload(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactAuditPayload(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      out[key] = SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactAuditPayload(item, depth + 1);
    }
    return out;
  }
  return String(value);
}

export interface AuditEventInput {
  /** Acting user id (req.user.userId). Falls back to "SYSTEM" (cron, webhooks). */
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /**
   * Facts for the reviewer: before/after status, amounts (satang), reason/note,
   * periodMonth for settlement events. Never raw bank account / national id.
   */
  payload?: Record<string, unknown> | null;
  /** req.id: lets support correlate the row with service logs. */
  requestId?: string | null;
}

type AuditClient = Pick<Prisma.TransactionClient, "auditEvent">;

export interface RecordAuditOptions {
  /** Pass a transaction client (`tx`) to write atomically with the change. */
  client?: AuditClient;
  /** Throw on failure (use inside transactions). Default: log and continue. */
  strict?: boolean;
}

/** Build the Prisma create payload (exported for tests). */
export function buildAuditEventData(input: AuditEventInput): Prisma.AuditEventUncheckedCreateInput {
  const payload = (redactAuditPayload(input.payload ?? {}) ?? {}) as Record<string, unknown>;
  if (input.requestId) payload.requestId = input.requestId;
  return {
    actorId: (input.actorId && String(input.actorId).trim()) || SYSTEM_ACTOR,
    action: String(input.action),
    entityType: input.entityType,
    entityId: String(input.entityId || "unknown"),
    payload: payload as Prisma.InputJsonValue,
  };
}

/**
 * Write one audit event. Non-strict calls never throw (an audit write must not
 * turn a completed action into a 500); failures are logged loudly instead.
 */
export async function recordAuditEvent(input: AuditEventInput, options: RecordAuditOptions = {}): Promise<boolean> {
  const client = options.client ?? prisma;
  try {
    await client.auditEvent.create({ data: buildAuditEventData(input) });
    return true;
  } catch (error) {
    if (options.strict) throw error;
    logger.error("Failed to write audit event", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error,
    });
    return false;
  }
}
