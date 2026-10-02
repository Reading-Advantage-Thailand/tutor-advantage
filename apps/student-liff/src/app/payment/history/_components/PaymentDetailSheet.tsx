"use client";

import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, Chip, IconButton } from "@/components/mobile";
import { formatSatang, formatThaiDate, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  getPaymentBookLabel,
  getPaymentMethodLabelKey,
  getPaymentStatusDisplay,
  type PaymentHistoryRecord,
} from "@/lib/paymentFlow";

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2 text-[15px] leading-[1.5]">
      <dt className="shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words text-fg">{children}</dd>
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("payment.history.copied"));
  } catch {
    toast.error(t("payment.history.copyFailed"));
  }
}

export interface PaymentDetailSheetProps {
  /** The tapped payment; null keeps the sheet closed. */
  payment: PaymentHistoryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed: () => void;
}

/** Full details of one payment, including the provider reference (tap to copy). */
export function PaymentDetailSheet({ payment, open, onOpenChange, onClosed }: PaymentDetailSheetProps) {
  const status = getPaymentStatusDisplay(payment?.status);
  const book = payment ? getPaymentBookLabel(payment) : null;
  const date = payment ? `${formatThaiDate(payment.createdAt, "long")} ${formatThaiTime(payment.createdAt, { suffix: true })}`.trim() : "";

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={onClosed}
      title={t("payment.history.detailTitle")}
      description={payment?.enrollment?.class?.title || t("payment.history.unnamedClass")}
    >
      {payment ? (
        <dl className="divide-y divide-hairline">
          <DetailRow label={t("payment.history.detailBook")}>{book ?? t("payment.history.otherExpense")}</DetailRow>
          {date ? <DetailRow label={t("payment.history.detailDate")}>{date}</DetailRow> : null}
          <DetailRow label={t("payment.history.detailMethod")}>{t(getPaymentMethodLabelKey(payment.method))}</DetailRow>
          <DetailRow label={t("payment.history.detailAmount")}>
            <span className="tabular-nums">{formatSatang(payment.amountMinor)}</span>
          </DetailRow>
          <DetailRow label={t("payment.history.detailStatus")}>
            <Chip tone={status.tone}>{t(status.labelKey)}</Chip>
          </DetailRow>
          {payment.providerRef ? (
            <div className="py-2">
              <dt className="text-[15px] leading-[1.5] text-fg-muted">{t("payment.history.detailRef")}</dt>
              <dd className="mt-1 flex items-center justify-between gap-3">
                <span className="min-w-0 font-mono text-sm leading-[1.5] break-all text-fg select-text">
                  {payment.providerRef}
                </span>
                <IconButton
                  icon={Copy}
                  variant="tonal"
                  label={t("payment.history.copyRef")}
                  onClick={() => void copyText(payment.providerRef ?? "")}
                />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </BottomSheet>
  );
}
