/** API shapes for /v1/settlements (finance-mlm-service settlementController). */

export interface SettlementRunRow {
  snapshotId: string;
  periodMonth: string;
  status: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  previewedAt: string | null;
  payoutLineCount: number;
  totalPayoutSatang: number;
  totalWithholdingSatang: number;
  totalNetPayoutSatang: number;
  pendingAdjustmentCount: number;
  /** null for runs that can no longer change (approved, rejected, holders). */
  stale: boolean | null;
  staleReasons: StaleReason[];
}

export interface SettlementListResponse {
  settlements: SettlementRunRow[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
  statusCounts: Array<{ status: string; count: number }>;
  omiseConfigured: boolean;
  devMakerCheckerOverride: boolean;
}

export interface SettlementPreviewResult {
  snapshotId: string;
  periodMonth: string;
  totalPayoutSatang: number;
  totalNetPayoutSatang: number;
  payoutLineCount: number;
  status: string;
}

export type StaleReason = "NOT_PREVIEWED" | "LINES_CHANGED" | "ADJUSTMENTS_CHANGED";

export interface RunFreshness {
  previewed: boolean;
  lineCount: number;
  stale: boolean;
  reasons: StaleReason[];
  changedTutorUserIds: string[];
  changedTutors: Array<{ userId: string; name: string | null }>;
  checkedAt: string;
}

export interface TimelineEntry {
  action: string;
  actorId: string | null;
  actorName: string | null;
  at: string;
  note: string | null;
  devOverride: boolean;
}

export interface TransferPlan {
  automatic: boolean;
  count: number;
  totalNetSatang: string;
  missingRecipientCount: number;
  missingRecipientTotalSatang: string;
}

export interface RunDetail {
  snapshotId: string;
  periodMonth: string;
  status: string;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  previewedAt: string | null;
  previewedBy: string | null;
  previewedByName: string | null;
  paymentCount: number | null;
  payoutLineCount: number;
  totalPayoutSatang: string;
  totalWithholdingSatang: string;
  totalNetPayoutSatang: string;
  pendingAdjustmentCount: number;
  approvedAdjustmentCount: number;
  transferPlan: TransferPlan;
  pendingTransferCount: number;
  freshness: RunFreshness | null;
  timeline: TimelineEntry[];
}

export interface PayoutLineRow {
  payoutLineId: string;
  tutorUserId: string;
  tutorName: string | null;
  tutorEmail: string | null;
  payoutRate: number;
  grossVolumeSatang: string;
  basePayoutSatang: string;
  adjustmentSatang: string;
  grossPayoutSatang: string;
  badgeBonusSatang: string;
  whtSatang: string;
  netPayoutSatang: string;
  eligibilityStatus: string;
  hasRecipientSnapshot: boolean;
  bankBrand: string | null;
  bankAccountLast4: string | null;
  bankAccountName: string | null;
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

export interface SettlementDetailResponse {
  snapshotId: string;
  periodMonth: string;
  status: string;
  lines: PayoutLineRow[];
  run: RunDetail;
  omiseConfigured: boolean;
  devMakerCheckerOverride: boolean;
}

/** Transfer states that are still moving at Omise (poll these). */
export const ACTIVE_TRANSFER_STATUSES = ["PENDING_TRANSFER", "CREATED", "SENT_PENDING", "SENT"];

/** Thai bank names for Omise bank brand codes (display only). */
export const BANK_NAMES: Record<string, string> = {
  bbl: "ธนาคารกรุงเทพ",
  kbank: "ธนาคารกสิกรไทย",
  ktb: "ธนาคารกรุงไทย",
  scb: "ธนาคารไทยพาณิชย์",
  bay: "ธนาคารกรุงศรีอยุธยา",
  tmb: "ธนาคารทหารไทยธนชาต",
  ttb: "ธนาคารทหารไทยธนชาต",
  gsb: "ธนาคารออมสิน",
  baac: "ธ.ก.ส.",
  uob: "ธนาคารยูโอบี",
  cimb: "ธนาคารซีไอเอ็มบี ไทย",
  lhb: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  kk: "ธนาคารเกียรตินาคินภัทร",
  tisco: "ธนาคารทิสโก้",
};

export function bankLabel(line: Pick<PayoutLineRow, "bankBrand" | "bankAccountLast4">): string | null {
  if (!line.bankBrand && !line.bankAccountLast4) return null;
  const bank = line.bankBrand ? (BANK_NAMES[line.bankBrand.toLowerCase()] ?? line.bankBrand.toUpperCase()) : "";
  return [bank, line.bankAccountLast4 ? `•••• ${line.bankAccountLast4}` : ""].filter(Boolean).join(" ");
}

/** Sum of satang strings/numbers as a number (safe below 2^53 satang). */
export function satangNumber(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}
