"use client";

import { Banknote, Wallet } from "lucide-react";
import {
  AdminStatusChip,
  DataTable,
  EmptyState,
  ErrorState,
  Money,
  Section,
  type DataTableColumn,
} from "@/components/app";
import { api, ApiError } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatNumber, formatPeriodMonth, formatThaiDateTime, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useUserDetail } from "../model";
import "@/locales/th/userDetail";

interface PaymentRow {
  id: string;
  direction: "PAID_BY_USER" | "EARNED_BY_TUTOR";
  amountMinor: string;
  method: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  receiptNumber: string | null;
}

interface PayoutRow {
  id: string;
  settlementRunId: string;
  periodMonth: string;
  runStatus: string;
  grossVolumeMinor: string;
  withholdingTaxMinor: string;
  netPayoutMinor: string;
  eligibilityStatus: string;
  documentNumber: string | null;
  transferStatus: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  PROMPTPAY: "พร้อมเพย์",
  promptpay: "พร้อมเพย์",
  CARD: "บัตร",
  card: "บัตร",
  COUPON: "คูปอง",
  MOCK: "ทดสอบ",
  DISCOUNT_CODE: "โค้ดส่วนลด",
};

export default function UserPaymentsTab() {
  const { data: user, me, userId } = useUserDetail();
  const { data, error, isLoading, refetch } = useCachedResource(
    me ? `${me.userId}:users:payments:${userId}` : null,
    () => api.get<{ payments: PaymentRow[]; payouts: PayoutRow[] }>(`/v1/users/${userId}/payments`),
  );
  if (!user) return null;
  if (error && !data) {
    return <ErrorState onRetry={refetch} digest={error instanceof ApiError ? (error.requestId ?? undefined) : undefined} />;
  }
  // Row count at the right of each section title ("14 รายการ").
  const itemsCount = (rows: unknown[] | undefined) =>
    rows?.length ? (
      <span className="text-[0.8125rem] text-fg-muted tabular">{t("shell.itemsCount", { count: formatNumber(rows.length) })}</span>
    ) : undefined;

  const paymentColumns: DataTableColumn<PaymentRow>[] = [
    {
      key: "createdAt",
      header: t("userDetail.colPaidAt"),
      mobile: "primary",
      cell: (row) => <span className="whitespace-nowrap tabular">{formatThaiDateTime(row.paidAt ?? row.createdAt)}</span>,
    },
    {
      key: "direction",
      header: t("userDetail.colDirection"),
      mobile: "secondary",
      // Short Thai phrases: kept whole, so a long receipt number never squeezes them into "ผู้ใช้ | ชำระ".
      cell: (row) => (
        <span className="whitespace-nowrap">
          {row.direction === "PAID_BY_USER" ? t("userDetail.directionPaid") : t("userDetail.directionEarned")}
        </span>
      ),
    },
    {
      key: "method",
      header: t("userDetail.colMethod"),
      cell: (row) => <span className="whitespace-nowrap">{METHOD_LABELS[row.method] ?? row.method}</span>,
    },
    {
      key: "receipt",
      header: t("userDetail.colReceipt"),
      // Receipt numbers can be long ids and no other screen shows them: always the full value,
      // wrapping anywhere when the column (or the phone card) is narrower than the number.
      cell: (row) =>
        row.receiptNumber ? (
          <span className="block font-mono text-[0.8125rem] text-fg-muted [overflow-wrap:anywhere] md:min-w-[9rem]" title={row.receiptNumber}>
            {row.receiptNumber}
          </span>
        ) : (
          <span className="text-fg-subtle">{PLACEHOLDER}</span>
        ),
    },
    // Phones: the status chip and the amount stack at the right of the row (list row, one status chip).
    { key: "status", header: t("userDetail.colStatus"), mobile: "trailing", cell: (row) => <AdminStatusChip domain="payment" status={row.status} /> },
    { key: "amount", header: t("userDetail.colAmount"), align: "right", mobile: "trailing", cell: (row) => <Money satang={row.amountMinor} fractionDigits={2} /> },
  ];

  const payoutColumns: DataTableColumn<PayoutRow>[] = [
    {
      key: "period",
      header: t("userDetail.colPeriod"),
      mobile: "primary",
      cell: (row) => <span className="font-medium whitespace-nowrap text-fg">{formatPeriodMonth(row.periodMonth)}</span>,
    },
    { key: "run", header: t("userDetail.colStatus"), mobile: "secondary", cell: (row) => <AdminStatusChip domain="settlementRun" status={row.runStatus} /> },
    { key: "gross", header: t("userDetail.colGross"), align: "right", cell: (row) => <Money satang={row.grossVolumeMinor} fractionDigits={2} /> },
    { key: "tax", header: t("userDetail.colTax"), align: "right", cell: (row) => <Money satang={row.withholdingTaxMinor} fractionDigits={2} /> },
    {
      key: "transfer",
      header: t("userDetail.colTransfer"),
      cell: (row) =>
        row.transferStatus ? <AdminStatusChip domain="payoutTransfer" status={row.transferStatus} /> : <span className="text-fg-muted">{t("userDetail.transferNone")}</span>,
    },
    { key: "net", header: t("userDetail.colNet"), align: "right", mobile: "trailing", cell: (row) => <Money satang={row.netPayoutMinor} fractionDigits={2} /> },
  ];

  return (
    <>
      <Section title={t("userDetail.paymentsTitle")} action={itemsCount(data?.payments)}>
        <DataTable
          caption={t("userDetail.paymentsTitle")}
          columns={paymentColumns}
          rows={data?.payments ?? []}
          loading={isLoading}
          getRowKey={(row) => row.id}
          empty={<EmptyState as="h3" icon={Wallet} title={t("userDetail.paymentsEmpty")} />}
        />
      </Section>
      {user.role === "TUTOR" ? (
        <Section title={t("userDetail.payoutsTitle")} action={itemsCount(data?.payouts)}>
          <DataTable
            caption={t("userDetail.payoutsTitle")}
            columns={payoutColumns}
            rows={data?.payouts ?? []}
            loading={isLoading}
            getRowKey={(row) => row.id}
            rowHref={(row) => `/settlements/${encodeURIComponent(row.settlementRunId)}`}
            empty={<EmptyState as="h3" icon={Banknote} title={t("userDetail.payoutsEmpty")} />}
          />
        </Section>
      ) : null}
    </>
  );
}
