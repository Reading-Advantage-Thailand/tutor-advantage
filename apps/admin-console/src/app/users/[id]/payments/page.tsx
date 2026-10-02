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
import { api } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatPeriodMonth, formatThaiDateTime, PLACEHOLDER } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useUserDetail } from "../model";

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
};

export default function UserPaymentsTab() {
  const { data: user, me, userId } = useUserDetail();
  const { data, error, isLoading, refetch } = useCachedResource(
    me ? `${me.userId}:users:payments:${userId}` : null,
    () => api.get<{ payments: PaymentRow[]; payouts: PayoutRow[] }>(`/v1/users/${userId}/payments`),
  );
  if (!user) return null;
  if (error && !data) return <ErrorState onRetry={refetch} />;

  const paymentColumns: DataTableColumn<PaymentRow>[] = [
    {
      key: "createdAt",
      header: t("userDetail.colPaidAt"),
      mobile: "primary",
      cell: (row) => formatThaiDateTime(row.paidAt ?? row.createdAt),
    },
    {
      key: "direction",
      header: t("userDetail.colDirection"),
      mobile: "secondary",
      cell: (row) => (row.direction === "PAID_BY_USER" ? t("userDetail.directionPaid") : t("userDetail.directionEarned")),
    },
    { key: "method", header: t("userDetail.colMethod"), cell: (row) => METHOD_LABELS[row.method] ?? row.method },
    { key: "receipt", header: t("userDetail.colReceipt"), cell: (row) => row.receiptNumber ?? PLACEHOLDER },
    { key: "status", header: t("userDetail.colStatus"), cell: (row) => <AdminStatusChip domain="payment" status={row.status} /> },
    { key: "amount", header: t("userDetail.colAmount"), align: "right", mobile: "trailing", cell: (row) => <Money satang={row.amountMinor} /> },
  ];

  const payoutColumns: DataTableColumn<PayoutRow>[] = [
    {
      key: "period",
      header: t("userDetail.colPeriod"),
      mobile: "primary",
      cell: (row) => <span className="font-medium text-fg">{formatPeriodMonth(row.periodMonth)}</span>,
    },
    { key: "run", header: t("userDetail.colStatus"), mobile: "secondary", cell: (row) => <AdminStatusChip domain="settlementRun" status={row.runStatus} /> },
    { key: "gross", header: t("userDetail.colGross"), align: "right", cell: (row) => <Money satang={row.grossVolumeMinor} /> },
    { key: "tax", header: t("userDetail.colTax"), align: "right", cell: (row) => <Money satang={row.withholdingTaxMinor} /> },
    {
      key: "transfer",
      header: t("userDetail.colTransfer"),
      cell: (row) =>
        row.transferStatus ? <AdminStatusChip domain="payoutTransfer" status={row.transferStatus} /> : <span className="text-fg-muted">{t("userDetail.transferNone")}</span>,
    },
    { key: "net", header: t("userDetail.colNet"), align: "right", mobile: "trailing", cell: (row) => <Money satang={row.netPayoutMinor} /> },
  ];

  return (
    <>
      <Section title={t("userDetail.paymentsTitle")}>
        <DataTable
          caption={t("userDetail.paymentsTitle")}
          columns={paymentColumns}
          rows={data?.payments ?? []}
          loading={isLoading}
          getRowKey={(row) => row.id}
          empty={<EmptyState icon={Wallet} title={t("userDetail.paymentsEmpty")} compact />}
        />
      </Section>
      {user.role === "TUTOR" ? (
        <Section title={t("userDetail.payoutsTitle")}>
          <DataTable
            caption={t("userDetail.payoutsTitle")}
            columns={payoutColumns}
            rows={data?.payouts ?? []}
            loading={isLoading}
            getRowKey={(row) => row.id}
            rowHref={(row) => `/settlements/${encodeURIComponent(row.settlementRunId)}`}
            empty={<EmptyState icon={Banknote} title={t("userDetail.payoutsEmpty")} compact />}
          />
        </Section>
      ) : null}
    </>
  );
}
