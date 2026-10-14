export type IssueType =
  | "OK"
  | "ENROLLMENT_TARGET_NOT_FOUND"
  | "SUCCESS_NOT_ACTIVE"
  | "FAILED_ACTIVE"
  | "STALE_PENDING"
  | "MISSING_PAYMENT_REF";

export const ISSUE_TYPES: IssueType[] = [
  "SUCCESS_NOT_ACTIVE",
  "STALE_PENDING",
  "FAILED_ACTIVE",
  "ENROLLMENT_TARGET_NOT_FOUND",
  "MISSING_PAYMENT_REF",
];

export const ISSUE_TONE: Record<IssueType, "success" | "warning" | "danger" | "info" | "neutral"> = {
  OK: "success",
  ENROLLMENT_TARGET_NOT_FOUND: "danger",
  SUCCESS_NOT_ACTIVE: "danger",
  FAILED_ACTIVE: "danger",
  STALE_PENDING: "warning",
  MISSING_PAYMENT_REF: "info",
};

export type PaymentAction = "ACTIVATE_ENROLLMENT" | "VERIFY_WITH_PROVIDER";

export interface ReconPayment {
  paymentIntentId: string;
  enrollmentId: string;
  enrollmentPackageId: string | null;
  studentUserId: string;
  studentName: string | null;
  studentIsActive: boolean | null;
  amountMinor: number | null;
  currency: string;
  method: string;
  status: string;
  providerRef: string | null;
  receiptStatus: string | null;
  createdAt: string;
  paidAt: string | null;
  enrollmentStatus: string | null;
  packageStatus: string | null;
  classId: string | null;
  classTitle: string | null;
  tutorUserId: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  issue: { type: IssueType; severity: string; description: string };
  actions: PaymentAction[];
}

export interface ReconSummary {
  daysBack: number;
  totalPayments: number;
  successfulPayments: number;
  pendingPayments: number;
  failedPayments: number;
  successVolumeMinor: number;
  issueCount: number;
  paymentIssueCount: number;
  orphanEventCount: number;
  activeWithoutPaymentCount: number;
  issueCounts: Partial<Record<IssueType, number>>;
}

export interface PaymentsResponse {
  summary: ReconSummary;
  payments: ReconPayment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrphanEvent {
  paymentEventId: string;
  providerEventId: string | null;
  eventType: string;
  occurredAt: string;
  createdAt: string;
  chargeId: string | null;
  chargeStatus: string | null;
  amountMinor: number | null;
  currency: string | null;
  dismissed: boolean;
  dismissedAt: string | null;
  dismissedBy: string | null;
  dismissReason: string | null;
  candidate: {
    paymentIntentId: string;
    providerRef: string | null;
    status: string;
    amountMinor: number | null;
    studentUserId: string;
  } | null;
}

export interface ActiveWithoutPayment {
  enrollmentId: string;
  studentUserId: string;
  studentName: string | null;
  classId: string;
  classTitle: string | null;
  tutorUserId: string | null;
  status: string;
  paymentTransactionId: string | null;
  latestPaymentStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReconView = "payments" | "orphans" | "gaps";

export const DAY_OPTIONS = ["7", "30", "90", "180"] as const;
