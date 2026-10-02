"use client";

import { RefreshCw, Send } from "lucide-react";
import {
  AdminStatusChip,
  ColumnToggle,
  DataTable,
  IdCell,
  useColumnVisibility,
  type DataTableColumn,
} from "@/components/app";
import { Money } from "@/components/app/Money";
import { Button } from "@/components/ui/button";
import { formatPercent, formatThaiDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { ACTIVE_TRANSFER_STATUSES, bankLabel, satangNumber, type PayoutLineRow } from "../types";

export interface PayoutLinesTableProps {
  lines: PayoutLineRow[];
  runStatus: string;
  /** Only finance checkers may send a transfer (backend rule). */
  canSendTransfer: boolean;
  loading?: boolean;
  onSendTransfer: (line: PayoutLineRow) => void;
  onSyncTransfer: (line: PayoutLineRow) => void;
}

/**
 * Payout lines of one run: a dense table on desktop/tablet (column toggle,
 * sticky tutor column) and cards on phones (DataTable's mobile layout), so
 * net payout, WHT and transfer state are always reachable without sideways scrolling.
 */
export function PayoutLinesTable({
  lines,
  runStatus,
  canSendTransfer,
  loading,
  onSendTransfer,
  onSyncTransfer,
}: PayoutLinesTableProps) {
  const approved = runStatus === "APPROVED";

  const columns: DataTableColumn<PayoutLineRow>[] = [
    {
      key: "tutor",
      header: t("settlements.colTutor"),
      label: t("settlements.colTutor"),
      mobile: "primary",
      alwaysVisible: true,
      sticky: true,
      cell: (line) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-fg">{line.tutorName ?? t("settlements.noName")}</span>
          {line.tutorEmail ? <span className="truncate text-[0.8125rem] text-fg-muted">{line.tutorEmail}</span> : null}
          <IdCell id={line.tutorUserId} />
        </span>
      ),
    },
    {
      key: "eligibility",
      header: t("settlements.colEligibility"),
      label: t("settlements.colEligibility"),
      mobile: "secondary",
      cell: (line) => <AdminStatusChip domain="payoutEligibility" status={line.eligibilityStatus} />,
    },
    {
      key: "volume",
      header: t("settlements.colVolume"),
      label: t("settlements.colVolume"),
      align: "right",
      mobile: "field",
      cell: (line) => <Money satang={line.grossVolumeSatang} muted />,
    },
    {
      key: "rate",
      header: t("settlements.colRate"),
      label: t("settlements.colRate"),
      align: "right",
      mobile: "hidden",
      defaultHidden: true,
      cell: (line) => formatPercent(line.payoutRate, { fractionDigits: 1 }),
    },
    {
      key: "base",
      header: t("settlements.colBase"),
      label: t("settlements.colBase"),
      align: "right",
      mobile: "hidden",
      cell: (line) => <Money satang={line.basePayoutSatang} />,
    },
    {
      key: "adjustment",
      header: t("settlements.colAdjustment"),
      label: t("settlements.colAdjustment"),
      align: "right",
      mobile: "field",
      cell: (line) =>
        satangNumber(line.adjustmentSatang) === 0 ? (
          <span className="text-fg-subtle">–</span>
        ) : (
          <Money satang={line.adjustmentSatang} signed />
        ),
    },
    {
      key: "grossPayout",
      header: t("settlements.colGrossPayout"),
      label: t("settlements.colGrossPayout"),
      align: "right",
      mobile: "field",
      cell: (line) => <Money satang={line.grossPayoutSatang} />,
    },
    {
      key: "wht",
      header: t("settlements.colWht"),
      label: t("settlements.colWht"),
      align: "right",
      mobile: "field",
      cell: (line) =>
        satangNumber(line.whtSatang) === 0 ? <span className="text-fg-subtle">–</span> : <Money satang={line.whtSatang} muted />,
    },
    {
      key: "net",
      header: t("settlements.colNetPayout"),
      label: t("settlements.colNetPayout"),
      align: "right",
      mobile: "trailing",
      alwaysVisible: true,
      cell: (line) => <Money satang={line.netPayoutSatang} className="font-semibold text-fg" />,
    },
    {
      key: "bank",
      header: t("settlements.colBank"),
      label: t("settlements.colBank"),
      mobile: "field",
      defaultHidden: true,
      cell: (line) => (
        <span className="text-[0.8125rem]">
          {bankLabel(line) ?? <span className="text-fg-subtle">–</span>}
          {!line.hasRecipientSnapshot && satangNumber(line.netPayoutSatang) > 0 ? (
            <span className="block text-warning-fg">{t("settlements.noRecipient")}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "document",
      header: t("settlements.colDocument"),
      label: t("settlements.colDocument"),
      mobile: "hidden",
      defaultHidden: true,
      cell: (line) => <span className="font-mono text-xs text-fg-muted">{line.documentNumber ?? "–"}</span>,
    },
    {
      key: "transfer",
      header: t("settlements.colTransfer"),
      label: t("settlements.colTransfer"),
      mobile: "field",
      cell: (line) => <TransferCell line={line} approved={approved} canSend={canSendTransfer} onSend={onSendTransfer} onSync={onSyncTransfer} />,
    },
  ];

  const visibility = useColumnVisibility("settlement-lines", columns);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="hidden justify-end lg:flex">
        <ColumnToggle columns={columns} hidden={visibility.hidden} onToggle={visibility.toggle} />
      </div>
      <DataTable
        caption={t("settlements.linesTitle")}
        columns={columns}
        rows={lines}
        getRowKey={(line) => line.payoutLineId}
        hiddenColumns={visibility.hidden}
        density="compact"
        breakpoint="lg"
        loading={loading}
        empty={<p className="py-8 text-center text-sm text-fg-muted">{t("settlements.linesEmpty")}</p>}
      />
    </div>
  );
}

function TransferCell({
  line,
  approved,
  canSend,
  onSend,
  onSync,
}: {
  line: PayoutLineRow;
  approved: boolean;
  canSend: boolean;
  onSend: (line: PayoutLineRow) => void;
  onSync: (line: PayoutLineRow) => void;
}) {
  if (!approved) {
    return <span className="text-[0.8125rem] text-fg-subtle">{t("settlements.transferAfterApproval")}</span>;
  }
  const status = line.transferStatus ?? (satangNumber(line.netPayoutSatang) > 0 ? "NOT_SENT" : "NO_TRANSFER_REQUIRED");
  const moving = ACTIVE_TRANSFER_STATUSES.includes(status) && Boolean(line.transferId);
  const sendable = canSend && Boolean(line.canSendTransfer);
  return (
    <span className="flex flex-col items-start gap-1">
      <AdminStatusChip domain="payoutTransfer" status={status} />
      {line.transferredAt ? (
        <span className="text-xs text-fg-muted">{formatThaiDateTime(line.transferredAt, "short")}</span>
      ) : null}
      {line.transferFailureMessage ? (
        <span className="max-w-56 text-xs text-danger-fg">{line.transferFailureMessage}</span>
      ) : null}
      {!sendable && !moving && line.transferBlockedReason && status !== "NO_TRANSFER_REQUIRED" && status !== "PAID" ? (
        <span className="text-xs text-warning-fg">{t("settlements.noRecipient")}</span>
      ) : null}
      {(moving || sendable) && (
        <span className="flex flex-wrap gap-1.5">
          {moving ? (
            <Button size="xs" variant="outline" onClick={() => onSync(line)}>
              <RefreshCw aria-hidden="true" />
              {t("settlements.syncTransfer")}
            </Button>
          ) : null}
          {sendable ? (
            <Button size="xs" variant="destructive" onClick={() => onSend(line)}>
              <Send aria-hidden="true" />
              {status === "TRANSFER_FAILED" ? t("settlements.retryTransfer") : t("settlements.sendTransfer")}
            </Button>
          ) : null}
        </span>
      )}
    </span>
  );
}
