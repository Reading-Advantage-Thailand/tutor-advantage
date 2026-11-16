"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Copy, LifeBuoy } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet, Chip, IconButton } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { buildNewRequestHref, isValidPaymentReference } from "@/app/support/_lib/form";
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
    <div className="flex min-h-12 items-center justify-between gap-4 py-2.5 text-[15px] leading-[1.6]">
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

/**
 * Full details of one payment: the amount and status first (a well with the
 * reading face 600 tabular amount and the status chip: dot + word), then the
 * facts, then the provider reference (tap to copy).
 */
export function PaymentDetailSheet({ payment, open, onOpenChange, onClosed }: PaymentDetailSheetProps) {
  const status = getPaymentStatusDisplay(payment?.status);
  const book = payment ? getPaymentBookLabel(payment) : null;
  const date = payment ? `${formatThaiDate(payment.createdAt, "long")} ${formatThaiTime(payment.createdAt, { suffix: true })}`.trim() : "";
  // "แจ้งปัญหา" opens a refund request with this payment's reference filled in.
  const reportHref = isValidPaymentReference(payment?.providerRef)
    ? buildNewRequestHref({ category: "REFUND", ref: payment?.providerRef })
    : null;

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      onClosed={onClosed}
      title={t("payment.history.detailTitle")}
      // The class title is data: as a node the sheet shows it as it is (a string would go through thaiCopy).
      description={payment?.enrollment?.class?.title ? <>{payment.enrollment.class.title}</> : t("payment.history.unnamedClass")}
    >
      {payment ? (
        <>
          <div className="well flex flex-col items-center gap-2 px-4 py-4 text-center">
            <p className="text-sm leading-[1.6] text-fg-muted">{t("payment.history.detailAmount")}</p>
            <p className="text-[32px] leading-[1.2] font-semibold text-fg tabular-nums">{formatSatang(payment.amountMinor)}</p>
            <p>
              <span className="sr-only">{t("payment.history.detailStatus")} </span>
              <Chip tone={status.tone} dot>
                {t(status.labelKey)}
              </Chip>
            </p>
          </div>
          <dl className="mt-2 divide-y-[1.5px] divide-hairline">
            <DetailRow label={t("payment.history.detailBook")}>{book ?? t("payment.history.otherExpense")}</DetailRow>
            {date ? <DetailRow label={t("payment.history.detailDate")}>{date}</DetailRow> : null}
            <DetailRow label={t("payment.history.detailMethod")}>{t(getPaymentMethodLabelKey(payment.method))}</DetailRow>
            {payment.providerRef ? (
              <div className="py-3">
                <dt className="text-[15px] leading-[1.6] text-fg-muted">{t("payment.history.detailRef")}</dt>
                <dd className="mt-1.5 flex items-center justify-between gap-3 rounded-[var(--radius-tile)] bg-surface-muted py-1 pr-1 pl-3.5">
                  <span className="min-w-0 font-mono text-sm leading-[1.6] break-all text-fg select-text">
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
        </>
      ) : null}
      {payment && reportHref ? (
        <Button
          variant="brandSoft"
          size="touch"
          className="mt-4 w-full"
          nativeButton={false}
          render={<Link href={reportHref} />}
        >
          <LifeBuoy aria-hidden="true" />
          {t("support.reportProblem")}
        </Button>
      ) : null}
    </BottomSheet>
  );
}
