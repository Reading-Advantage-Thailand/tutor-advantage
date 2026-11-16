import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { EarningsView, type TutorProfile } from "@/app/dashboard/earnings/earnings-view";
import type { EarningsResponse } from "@/app/dashboard/earnings/lib/earnings";
import { AppShell } from "@/components/app/AppShell";
import { SIDEBAR_COOKIE } from "@/components/app/constants";
import { devRoutesEnabled } from "@/lib/security";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Earnings preview (dev) - Tutor Advantage",
  robots: { index: false, follow: false },
};

/**
 * Worst-case payout history for the real earnings page: every column filled
 * with its widest content (six-digit amounts, network + badge bonus, three
 * adjustment lines with one long note, withholding tax, a document number, the
 * "รับเงินแล้ว · date" transfer chip with its refresh button and the 50 ทวิ
 * button), then the other statuses. Transfer statuses are final ones only: a
 * pending row would start the 15 s sync poll against the finance service with
 * ids that do not exist.
 */
const FIXTURE: EarningsResponse = {
  periodMonth: "2026-11",
  currentProjection: {
    directSales: 96400,
    networkBonus: 8450.25,
    badgeBonus: 1200,
    clawback: -650,
    adjustments: [{ amount: -650, reason: "refund:fixture" }],
    total: 105400.25,
  },
  history: [
    {
      date: "2026-10",
      payoutLineId: "fixture-line-2026-10",
      direct: 128450,
      network: 12345.67,
      badgeBonus: 1500,
      clawback: -1950,
      adjustments: [
        { amount: -1800, reason: "chargeback:fixture" },
        { amount: -500, reason: "ปรับยอดตามคำขอของผู้ปกครอง: ย้ายคลาสกลางเดือนและคืนค่าเรียนบางส่วน" },
        { amount: 350, reason: "chargeback-reversal:fixture" },
      ],
      withholdingTax: 4210.37,
      withholdingRatePercent: 3,
      netPayout: 136135.3,
      payoutDocument: {
        payoutDocumentId: "fixture-doc-2026-10",
        documentNumber: "50TAWI-20261105-a1b2c3d4",
        documentType: "PAY_SLIP_50_TAWI",
        status: "ISSUED",
        issuedAt: "2026-11-05T03:00:00.000Z",
        transferStatus: "PAID",
        transferredAt: "2026-11-05T03:00:00.000Z",
      },
      status: "approved",
    },
    {
      date: "2026-09",
      payoutLineId: "fixture-line-2026-09",
      direct: 84200,
      network: 0,
      badgeBonus: 0,
      clawback: 0,
      withholdingTax: 2526,
      withholdingRatePercent: 3,
      netPayout: 81674,
      payoutDocument: {
        payoutDocumentId: "fixture-doc-2026-09",
        documentNumber: "50TAWI-20261005-e5f6a7b8",
        documentType: "PAY_SLIP_50_TAWI",
        status: "ISSUED",
        issuedAt: "2026-10-05T03:00:00.000Z",
        transferStatus: "TRANSFER_FAILED",
        transferredAt: null,
      },
      status: "approved",
    },
    {
      date: "2026-08",
      payoutLineId: "fixture-line-2026-08",
      direct: 0,
      network: 0,
      badgeBonus: 0,
      clawback: -420,
      adjustments: [{ amount: -420, reason: "carry-forward:fixture" }],
      withholdingTax: 0,
      netPayout: -420,
      payoutDocument: {
        payoutDocumentId: "fixture-doc-2026-08",
        documentNumber: "50TAWI-20260905-c9d0e1f2",
        documentType: "PAY_SLIP_50_TAWI",
        status: "ISSUED",
        issuedAt: "2026-09-05T03:00:00.000Z",
        transferStatus: "NO_TRANSFER_REQUIRED",
        transferredAt: null,
      },
      status: "approved",
    },
    {
      date: "2026-07",
      payoutLineId: "fixture-line-2026-07",
      direct: 15600,
      network: 780.5,
      badgeBonus: 0,
      clawback: 0,
      withholdingTax: 491.42,
      netPayout: 15889.08,
      payoutDocument: null,
      status: "rejected",
    },
    {
      date: "2026-06",
      payoutLineId: "fixture-line-2026-06",
      direct: 42300,
      network: 1250,
      badgeBonus: 500,
      clawback: 0,
      withholdingTax: 1321.5,
      netPayout: 42728.5,
      payoutDocument: null,
      status: "pending",
    },
    // Legacy record: one clawback amount, no adjustment lines and no net payout.
    { date: "2026-05", direct: 9800, network: 0, clawback: -300, status: "draft" },
  ],
  clawbacks: [],
  rateInfo: { rate: 0.25, volume: 385600, nextTarget: 500000 },
  payoutPolicy: { cardHoldDays: 60, otherHoldDays: 7 },
};

/** Verified, with no tax details: the 50 ทวิ button opens its "missing details" sheet and downloads nothing. */
const FIXTURE_TUTOR: TutorProfile = { verificationStatus: "VERIFIED", identity: { taxResidency: "RESIDENT" }, settings: {} };

/**
 * Dev-only view of the real earnings page (EarningsView, unchanged) inside the
 * app shell with fixture payout history, for layout checks the test tutors
 * cannot give: the 8-column payout table only renders for a tutor who has been
 * paid. Gated like /dev/ui-kit. The side nav follows the same cookie as the
 * dashboard, so full sidebar, rail and collapsed widths can all be measured.
 */
export default async function EarningsPreviewPage() {
  if (!devRoutesEnabled()) notFound();
  const cookieStore = await cookies();
  return (
    <AppShell
      user={{ tutorId: "dev-earnings-preview", displayName: "ครูตัวอย่าง (dev)", verificationStatus: "VERIFIED" }}
      sidebarCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "rail"}
    >
      <EarningsView response={FIXTURE} user={FIXTURE_TUTOR} />
    </AppShell>
  );
}
