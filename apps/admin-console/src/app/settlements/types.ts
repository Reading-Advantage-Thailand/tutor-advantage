import { ClockIcon, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { t } from "@/lib/i18n";

export interface PayoutLineRow {
  payoutLineId: string;
  tutorUserId: string;
  tutorName: string | null;
  tutorEmail: string | null;
  grossVolumeTHB: number;
  payoutRate: number;
  basePayoutTHB: number;
  adjustmentTHB: number;
  grossPayoutTHB: number;
  badgeBonusTHB: number;
  whtTHB: number;
  netPayoutTHB: number;
  eligibilityStatus: string;
  documentNumber: string | null;
  documentStatus: string | null;
  transferProvider: string | null;
  transferId: string | null;
  transferStatus: string | null;
  transferFailureCode: string | null;
  transferFailureMessage: string | null;
  transferredAt: string | null;
  canSendTransfer?: boolean;
  transferBlockedReason?: string | null;
}

export interface LinesData {
  snapshotId: string;
  periodMonth: string;
  status: string;
  totalNetPayoutTHB: number;
  lines: PayoutLineRow[];
}

export interface SettlementPreview {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang?: number;    // gross before WHT
  totalNetPayoutSatang?: number; // net after WHT — shown in result card
  status: string;
  createdBy?: string;
  createdAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  payoutLineCount?: number;
  pendingAdjustmentCount?: number;
}

export const ELIGIBILITY_CONFIG: Record<string, { label: string; className: string }> = {
  ELIGIBLE:                  { label: "ผ่านเกณฑ์",               className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  ELIGIBLE_ADJUSTED:         { label: "ผ่าน + ปรับยอด",          className: "bg-teal-500/10 text-teal-600 border border-teal-500/30" },
  ELIGIBLE_BASE:             { label: "ผ่าน (ค่าฐาน)",           className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" },
  ELIGIBLE_BASE_ADJUSTED:    { label: "ผ่าน (ค่าฐาน+ปรับยอด)", className: "bg-teal-500/10 text-teal-600 border border-teal-500/30" },
  INELIGIBLE_NO_PV:          { label: "ไม่ผ่าน (ไม่มียอดขาย)",  className: "bg-red-500/10 text-red-500 border border-red-500/30" },
  INELIGIBLE_NOT_VERIFIED:          { label: "ไม่ผ่าน (ยังไม่ยืนยันตัวตน)",           className: "bg-orange-500/10 text-orange-600 border border-orange-500/30" },
  INELIGIBLE_NOT_VERIFIED_ADJUSTED: { label: "ไม่ผ่าน (ยังไม่ยืนยัน — ปรับยอดถูกระงับ)", className: "bg-orange-500/10 text-orange-600 border border-orange-500/30" },
  ADJUSTMENT_ONLY:                  { label: "ปรับยอดเท่านั้น",                          className: "bg-amber-500/10 text-amber-600 border border-amber-500/30" },
};

export const TRANSFER_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NOT_SENT: {
    label: "ยังไม่ได้โอน",
    className: "bg-muted text-muted-foreground border border-border",
  },
  PENDING_TRANSFER: {
    label: "รอส่งโอน",
    className: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
  },
  CREATED: {
    label: "สร้างรายการโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  SENT_PENDING: {
    label: "ส่งรายการโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  SENT: {
    label: "ส่งโอนแล้ว",
    className: "bg-blue-500/10 text-blue-600 border border-blue-500/30",
  },
  PAID: {
    label: "โอนสำเร็จ",
    className: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30",
  },
  TRANSFER_FAILED: {
    label: "โอนไม่สำเร็จ",
    className: "bg-red-500/10 text-red-500 border border-red-500/30",
  },
  NO_TRANSFER_REQUIRED: {
    label: "ไม่ต้องโอน",
    className: "bg-muted text-muted-foreground border border-border",
  },
};

export const DOCUMENT_STATUS_CONFIG: Record<string, string> = {
  ISSUED: "ออกเอกสารแล้ว",
};

export const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
    icon: any;
  }
> = {
  DRAFT: {
    label: t("settlements.draft"),
    variant: "outline",
    icon: ClockIcon,
    className:
      "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  },
  SUBMITTED: {
    label: t("settlements.submitted"),
    variant: "outline",
    icon: ShieldCheck,
    className:
      "border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/10",
  },
  APPROVED: {
    label: t("settlements.approved"),
    variant: "outline",
    icon: CheckCircle2,
    className:
      "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  },
  REJECTED: {
    label: t("settlements.rejected"),
    variant: "outline",
    icon: XCircle,
    className: "border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10",
  },
};
