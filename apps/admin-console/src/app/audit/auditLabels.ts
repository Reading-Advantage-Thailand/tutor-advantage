/**
 * Audit action / entity labels (owner: G1). Shared by /audit and the overview.
 * Action names mirror services/finance-mlm-service/src/services/auditService.ts
 * (AUDIT_ACTIONS) plus the dynamic EXCEPTION_* / FRAUD_* / COUPON_* actions.
 * Unknown actions fall back to a humanised label, never a raw enum.
 */
import type { Tone } from "@/components/app";
import { t, th } from "@/lib/i18n";
import type { StatusDomain } from "@/lib/status";

const ACTION_LABELS: Record<string, string> = th.audit.actions;
const ENTITY_LABELS: Record<string, string> = th.audit.entities;

export type AuditCategory = "settlement" | "adjustment" | "user" | "payment" | "risk" | "coupon" | "system";

/** Filter groups: one option per category (all its actions) + one per action. */
export const AUDIT_CATEGORIES: { id: AuditCategory; label: string; actions: string[] }[] = [
  {
    id: "settlement",
    label: t("audit.catSettlement"),
    actions: [
      "PREVIEW_SETTLEMENT",
      "PREVIEW",
      "SETTLEMENT_REFRESH",
      "SUBMIT",
      "SUBMIT_SETTLEMENT",
      "APPROVE",
      "APPROVE_SETTLEMENT",
      "REJECT",
      "EXPORT",
      "RETRY_PAYOUT_TRANSFER",
    ],
  },
  { id: "adjustment", label: t("audit.catAdjustment"), actions: ["ADJUST_CREATE", "ADJUST_APPROVE", "ADJUST_REJECT"] },
  {
    id: "user",
    label: t("audit.catUser"),
    actions: [
      "USER_VERIFY",
      "USER_VERIFY_APPROVE",
      "USER_VERIFY_REJECT",
      "USER_SUSPEND",
      "USER_UNSUSPEND",
      "USER_ANONYMIZE",
      "USER_OMISE_RECIPIENT_UPDATE",
      "USER_PII_REVEAL",
      "ROLE_CHANGE",
      "ROLE_PROVISION",
      "ROLE_REVOKE",
    ],
  },
  {
    id: "payment",
    label: t("audit.catPayment"),
    actions: [
      "RECONCILIATION_VERIFY_PAYMENT",
      "RECONCILIATION_ACTIVATE_ENROLLMENT",
      "RECONCILIATION_ORPHAN_LINK",
      "RECONCILIATION_ORPHAN_DISMISS",
    ],
  },
  {
    id: "risk",
    label: t("audit.catRisk"),
    actions: [
      "FRAUD_CLEAR",
      "FRAUD_MONITOR",
      "FRAUD_FREEZE",
      "FRAUD_RELEASE",
      "FRAUD_UNFREEZE",
      "EXCEPTION_ACTIVATE_ENROLLMENT",
      "EXCEPTION_MARK_RESOLVED",
      "EXCEPTION_DISMISS",
      "EXCEPTION_RESOLVE",
      "EXCEPTION_VOID",
    ],
  },
  { id: "coupon", label: t("audit.catCoupon"), actions: ["COUPON_CREATE", "COUPON_UPDATE", "COUPON_VOID"] },
  { id: "system", label: t("audit.catSystem"), actions: ["AUDIT_EXPORT"] },
];

/** Same-label duplicates (legacy + new names) collapse into one filter option. */
export function actionFilterOptions(category: (typeof AUDIT_CATEGORIES)[number]) {
  const byLabel = new Map<string, string[]>();
  for (const action of category.actions) {
    const label = auditActionLabel(action);
    byLabel.set(label, [...(byLabel.get(label) ?? []), action]);
  }
  return [...byLabel.entries()].map(([label, actions]) => ({ value: actions.join(","), label }));
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function auditActionLabel(action: string | null | undefined): string {
  if (!action) return t("audit.noDetail");
  return ACTION_LABELS[action] ?? humanize(action);
}

export function auditEntityLabel(entityType: string | null | undefined): string {
  if (!entityType) return t("audit.noDetail");
  return ENTITY_LABELS[entityType] ?? humanize(entityType);
}

export function auditCategory(action: string): AuditCategory {
  for (const category of AUDIT_CATEGORIES) if (category.actions.includes(action)) return category.id;
  if (action.startsWith("RECONCILIATION_")) return "payment";
  if (action.startsWith("FRAUD_") || action.startsWith("EXCEPTION_")) return "risk";
  if (action.startsWith("USER_") || action.startsWith("ROLE_")) return "user";
  if (action.startsWith("COUPON_")) return "coupon";
  if (action.startsWith("ADJUST")) return "adjustment";
  return "system";
}

/** Chip tone by outcome: approvals green, rejections/suspensions red, creates blue. */
export function auditActionTone(action: string): Tone {
  if (/(UNSUSPEND|UNFREEZE|RELEASE|VERIFY_APPROVE)/.test(action)) return "success";
  if (/(REJECT|SUSPEND$|FREEZE|ANONYMIZE|VOID|DISMISS|REVOKE)/.test(action)) return "danger";
  if (/(APPROVE|UNSUSPEND|CLEAR|RESOLVE|ACTIVATE)/.test(action)) return "success";
  if (/(SUBMIT|ROLE_CHANGE|ROLE_PROVISION|OMISE|PII|RETRY|MONITOR)/.test(action)) return "warning";
  if (/(CREATE|PREVIEW|REFRESH|VERIFY)/.test(action)) return "info";
  return "neutral";
}

/** Which status map to use for previous/new status values of an event. */
export function auditStatusDomain(entityType: string, action: string): StatusDomain | null {
  if (action.startsWith("ROLE_")) return "userRole";
  switch (entityType) {
    case "SettlementRun":
      return "settlementRun";
    case "Adjustment":
      return "adjustment";
    case "User":
      return action === "USER_VERIFY" ? "verification" : "account";
    case "FraudFlag":
      return "fraudFlag";
    case "Exception":
      return "exception";
    case "Coupon":
      return "coupon";
    case "PaymentIntent":
      return "payment";
    case "PayoutLine":
      return "payoutTransfer";
    default:
      return null;
  }
}

/** Admin page that shows the affected record, when there is one. */
export function auditEntityHref(entityType: string, entityId: string): string | null {
  if (!entityId || entityId === "system" || entityId === "unknown") return null;
  switch (entityType) {
    case "User":
      return `/users/${encodeURIComponent(entityId)}`;
    case "SettlementRun":
      return `/settlements/${encodeURIComponent(entityId)}`;
    default:
      return null;
  }
}

/** Entity types offered in the filter. */
export const AUDIT_ENTITY_TYPES = ["SettlementRun", "Adjustment", "User", "PaymentIntent", "PaymentEvent", "FraudFlag", "Exception", "Coupon", "AuditLog"];
