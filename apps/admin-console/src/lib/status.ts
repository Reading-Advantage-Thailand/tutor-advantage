/**
 * Admin status → Thai label + tone, per domain. Use with
 * `<AdminStatusChip domain="settlementRun" status={run.status} />` or
 * `statusLabel("payment", p.status)` in text. Never render raw enum strings.
 *
 * Values come from the backend (finance_mlm / learning / identity) as of
 * 2026-10. Unknown values fall back to a humanised neutral chip.
 * Page groups: append missing values to the right domain (append-only).
 */
import { humanizeStatus, USER_ROLE_STATUS } from "./statusRole";

export type StatusTone = "brand" | "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Optional one-line explanation (tooltips, filter hints). */
  hint?: string;
}

export const ADMIN_STATUS = {
  /** finance_mlm.payment_intents.status */
  payment: {
    PENDING: { label: "รอชำระ", tone: "warning" },
    PROCESSING: { label: "กำลังดำเนินการ", tone: "info" },
    SUCCESS: { label: "ชำระแล้ว", tone: "success" },
    PAID: { label: "ชำระแล้ว", tone: "success" },
    FAILED: { label: "ไม่สำเร็จ", tone: "danger" },
    EXPIRED: { label: "หมดเวลา", tone: "neutral" },
    CANCELLED: { label: "ยกเลิก", tone: "neutral" },
    REFUNDED: { label: "คืนเงินแล้ว", tone: "info" },
    CHARGEBACKED: { label: "ถูกเรียกเงินคืน", tone: "danger" },
  },
  /** learning.enrollments.status */
  enrollment: {
    PENDING_PAYMENT: { label: "รอชำระเงิน", tone: "warning" },
    ACTIVE: { label: "กำลังเรียน", tone: "success" },
    COMPLETED: { label: "เรียนจบแล้ว", tone: "info" },
    FINISHED: { label: "เรียนจบแล้ว", tone: "info" },
    CANCELLED: { label: "ยกเลิก", tone: "neutral" },
    EXPIRED: { label: "หมดเวลาชำระ", tone: "neutral" },
    REFUNDED: { label: "คืนเงินแล้ว", tone: "info" },
    TRANSFERRED: { label: "ย้ายคลาสแล้ว", tone: "info" },
  },
  /** finance_mlm.settlement_runs.status */
  settlementRun: {
    DRAFT: { label: "ฉบับร่าง", tone: "neutral", hint: "คำนวณแล้ว ยังไม่ส่งตรวจ" },
    REFRESHING: { label: "กำลังคำนวณใหม่", tone: "info" },
    ADJUSTMENT_PENDING: { label: "รอปรับปรุงยอด", tone: "warning", hint: "มีรายการปรับปรุงยอดรออนุมัติ" },
    SUBMITTED: { label: "รออนุมัติ", tone: "warning", hint: "ส่งให้ผู้ตรวจสอบการเงินอนุมัติแล้ว" },
    APPROVING: { label: "กำลังอนุมัติ", tone: "info" },
    APPROVED: { label: "อนุมัติแล้ว", tone: "success" },
    REJECTED: { label: "ตีกลับ", tone: "danger" },
    PAID: { label: "จ่ายครบแล้ว", tone: "success" },
  },
  /** finance_mlm.payout_documents.transfer_status (payout lines) */
  payoutTransfer: {
    NOT_SENT: { label: "ยังไม่โอน", tone: "neutral" },
    PENDING_TRANSFER: { label: "กำลังโอน", tone: "info" },
    SENT: { label: "ส่งคำสั่งโอนแล้ว", tone: "info" },
    PAID: { label: "โอนสำเร็จ", tone: "success" },
    TRANSFER_FAILED: { label: "โอนไม่สำเร็จ", tone: "danger" },
    PROVIDER_FAILED: { label: "ผู้ให้บริการขัดข้อง", tone: "danger" },
    // G2 additions
    CREATED: { label: "สร้างคำสั่งโอนแล้ว", tone: "info" },
    SENT_PENDING: { label: "รอธนาคารยืนยัน", tone: "info" },
    NO_TRANSFER_REQUIRED: { label: "ไม่ต้องโอน", tone: "neutral" },
    FAILED: { label: "โอนไม่สำเร็จ", tone: "danger" },
  },
  /** payout_lines.eligibility_status */
  payoutEligibility: {
    ELIGIBLE: { label: "มีสิทธิ์รับเงิน", tone: "success" },
    ELIGIBLE_BASE: { label: "มีสิทธิ์ (ค่าสอนพื้นฐาน)", tone: "success" },
    ELIGIBLE_BASE_ADJUSTED: { label: "มีสิทธิ์ (มีปรับยอด)", tone: "success" },
    ADJUSTMENT_ONLY: { label: "เฉพาะยอดปรับปรุง", tone: "info" },
    INELIGIBLE_NOT_VERIFIED: { label: "ยังไม่ยืนยันตัวตน", tone: "warning" },
    INELIGIBLE_NO_PV: { label: "ไม่มียอดขาย", tone: "neutral" },
    INELIGIBLE_SPONSOR_CYCLE: { label: "สายงานวนซ้ำ", tone: "danger" },
    // G2 additions
    ELIGIBLE_ADJUSTED: { label: "มีสิทธิ์รับเงิน (มีปรับยอด)", tone: "success" },
    INELIGIBLE_NO_PV_ADJUSTED: { label: "ไม่มียอดขาย (มีปรับยอด)", tone: "neutral" },
    INELIGIBLE_SPONSOR_CYCLE_ADJUSTED: { label: "สายงานวนซ้ำ (มีปรับยอด)", tone: "danger" },
  },
  /** finance_mlm.adjustments.status */
  adjustment: {
    PENDING: { label: "รออนุมัติ", tone: "warning" },
    APPROVED: { label: "อนุมัติแล้ว", tone: "success" },
    REJECTED: { label: "ไม่อนุมัติ", tone: "danger" },
  },
  /** finance_mlm.exceptions.status */
  exception: {
    UNRESOLVED: { label: "รอดำเนินการ", tone: "warning" },
    RESOLVED: { label: "แก้ไขแล้ว", tone: "success" },
    VOIDED: { label: "ยกเลิกแล้ว", tone: "neutral" },
  },
  /** finance_mlm.exceptions.type */
  exceptionType: {
    PAYMENT_WEBHOOK_MISMATCH: { label: "ยอดชำระไม่ตรงกับ webhook", tone: "danger" },
    ORPHAN_PAYMENT_EVENT: { label: "รับเงินแต่ไม่พบรายการ", tone: "warning" },
    ENROLLMENT_ACTIVATION_FAILED: { label: "เปิดสิทธิ์เรียนไม่สำเร็จ", tone: "danger" },
    REFUND_REQUESTED: { label: "ขอคืนเงิน", tone: "info" },
    PAYMENT_TIMEOUT: { label: "ชำระเงินหมดเวลา", tone: "neutral" },
    // G3: legacy seed / older producers
    WEBHOOK_FAILED: { label: "ประมวลผล webhook ไม่สำเร็จ", tone: "danger" },
    ENROLLMENT_MISMATCH: { label: "สถานะการลงเรียนไม่ตรงกับการชำระ", tone: "warning" },
  },
  /** finance_mlm.fraud_flags.status */
  fraudFlag: {
    OPEN: { label: "รอตรวจสอบ", tone: "warning" },
    INVESTIGATING: { label: "กำลังตรวจสอบ", tone: "warning" },
    MONITORING: { label: "เฝ้าระวัง", tone: "info" },
    FROZEN: { label: "ระงับไว้", tone: "danger" },
    CLEARED: { label: "ไม่พบความผิดปกติ", tone: "success" },
  },
  /** finance_mlm.fraud_flags.severity */
  fraudSeverity: {
    LOW: { label: "ต่ำ", tone: "neutral" },
    MEDIUM: { label: "ปานกลาง", tone: "warning" },
    HIGH: { label: "สูง", tone: "danger" },
    CRITICAL: { label: "วิกฤต", tone: "danger" },
  },
  /** finance_mlm.fraud_flags.type */
  fraudType: {
    SELF_REFERRAL: { label: "แนะนำตัวเอง", tone: "neutral" },
    MULTI_ACCOUNT: { label: "หลายบัญชี", tone: "neutral" },
    VELOCITY: { label: "ทำรายการถี่ผิดปกติ", tone: "neutral" },
    CHARGEBACK: { label: "ถูกเรียกเงินคืน", tone: "neutral" },
  },
  /** identity.users.verification_status and per-field verification */
  verification: {
    UNVERIFIED: { label: "ยังไม่ส่งเอกสาร", tone: "neutral" },
    PENDING: { label: "รอตรวจสอบ", tone: "warning" },
    VERIFIED: { label: "ยืนยันแล้ว", tone: "success" },
    REJECTED: { label: "ไม่ผ่าน", tone: "danger" },
  },
  /** finance_mlm.coupons.status */
  coupon: {
    ACTIVE: { label: "ใช้งานได้", tone: "success" },
    REDEEMED: { label: "ใช้แล้ว", tone: "info" },
    VOID: { label: "ยกเลิกแล้ว", tone: "neutral" },
    EXPIRED: { label: "หมดอายุ", tone: "neutral" },
  },
  /** identity.users.role (lib/statusRole.ts, shared with the shell) */
  userRole: USER_ROLE_STATUS,
  /** identity.users.is_active (pass "ACTIVE" / "SUSPENDED") */
  account: {
    ACTIVE: { label: "ใช้งานอยู่", tone: "success" },
    SUSPENDED: { label: "ถูกระงับ", tone: "danger" },
    ANONYMIZED: { label: "ลบข้อมูลแล้ว", tone: "neutral" },
  },
  /** learning.classes.status (G4 addition) */
  classStatus: {
    DRAFT: { label: "ฉบับร่าง", tone: "neutral" },
    OPEN: { label: "เปิดรับสมัคร", tone: "info" },
    PUBLISHED: { label: "เผยแพร่แล้ว", tone: "info" },
    FULL: { label: "เต็มแล้ว", tone: "warning" },
    ACTIVE: { label: "กำลังสอน", tone: "success" },
    IN_PROGRESS: { label: "กำลังสอน", tone: "success" },
    COMPLETED: { label: "จบแล้ว", tone: "neutral" },
    CANCELLED: { label: "ยกเลิก", tone: "neutral" },
  },
} as const satisfies Record<string, Record<string, StatusMeta>>;

export type StatusDomain = keyof typeof ADMIN_STATUS;

/** "PENDING_TRANSFER" → "Pending transfer" (fallback for unknown values only). */
export function statusMeta(domain: StatusDomain, status: string | null | undefined): StatusMeta {
  const key = (status ?? "").toUpperCase();
  const table = ADMIN_STATUS[domain] as Record<string, StatusMeta>;
  return table[key] ?? { label: key ? humanizeStatus(key) : "–", tone: "neutral" };
}

export function statusLabel(domain: StatusDomain, status: string | null | undefined): string {
  return statusMeta(domain, status).label;
}

export function statusToneFor(domain: StatusDomain, status: string | null | undefined): StatusTone {
  return statusMeta(domain, status).tone;
}

/** Options for a status filter <SelectField>, in map order. */
export function statusOptions(domain: StatusDomain, { all }: { all?: string } = {}): { value: string; label: string }[] {
  const entries = Object.entries(ADMIN_STATUS[domain] as Record<string, StatusMeta>).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));
  return all ? [{ value: "", label: all }, ...entries] : entries;
}
