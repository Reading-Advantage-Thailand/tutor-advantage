"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, QrCode, ReceiptText } from "lucide-react";
import { AppBar, Chip, EmptyState, ErrorState, IconTile, ListGroup, ListRow, Screen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatSatang, formatThaiDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  getPaymentBookLabel,
  getPaymentStatusDisplay,
  groupByMonth,
  normalizePaymentMethod,
  type PaymentHistoryRecord,
} from "@/lib/paymentFlow";
import { PaymentDetailSheet } from "./_components/PaymentDetailSheet";
import { PaymentHistorySkeleton } from "./_components/PaymentHistorySkeleton";

async function fetchPaymentHistory(): Promise<PaymentHistoryRecord[]> {
  const response = await studentApi.getPaymentHistory();
  return (response?.payments ?? []) as PaymentHistoryRecord[];
}

function PaymentRow({ payment, onOpen }: { payment: PaymentHistoryRecord; onOpen: () => void }) {
  const status = getPaymentStatusDisplay(payment.status);
  const isPromptPay = normalizePaymentMethod(payment.method) === "promptpay";
  const book = getPaymentBookLabel(payment) ?? t("payment.history.otherExpense");
  const date = formatThaiDate(payment.createdAt, "short");

  return (
    <ListRow
      onClick={onOpen}
      leading={<IconTile icon={isPromptPay ? QrCode : CreditCard} tone={isPromptPay ? "brand" : "blue"} />}
      title={payment.enrollment?.class?.title || t("payment.history.unnamedClass")}
      subtitle={date ? `${book} · ${date}` : book}
      trailing={
        <span className="flex flex-col items-end gap-1">
          <span className="text-[15px] leading-[1.4] font-bold text-fg tabular-nums">
            {formatSatang(payment.amountMinor)}
          </span>
          <Chip tone={status.tone}>{t(status.labelKey)}</Chip>
        </span>
      }
    />
  );
}

export default function PaymentHistoryPage() {
  const { isReady, profile, error: liffError, retry } = useLiff();
  // Fetched as soon as LIFF start-up finishes (the session cookie is the auth;
  // a 401 waits for the session and retries once inside the cache).
  const { data, error, isLoading, isValidating, refetch } = useCachedResource(
    isReady ? `${profile?.userId ?? "session"}:payments:history` : null,
    fetchPaymentHistory,
    { enabled: isReady },
  );
  const [selected, setSelected] = useState<PaymentHistoryRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isReady || isLoading) return <PaymentHistorySkeleton />;

  const header = <AppBar title={t("payment.history.title")} back fallbackHref="/profile" />;

  if (!data) {
    return (
      <Screen>
        {header}
        <ErrorState
          description={error || liffError ? t("payment.history.fetchFailed") : undefined}
          // LIFF start-up failed (no session): retry start-up; otherwise just refetch.
          onRetry={liffError && !profile ? retry : () => void refetch()}
          retrying={isValidating}
          className="flex-1 justify-center"
        />
      </Screen>
    );
  }

  if (data.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={ReceiptText}
          title={t("payment.history.emptyTitle")}
          description={t("payment.history.emptyDescription")}
          className="flex-1 justify-center"
          action={
            <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
              {t("payment.history.browseClasses")}
            </Link>
          }
        />
      </Screen>
    );
  }

  const groups = groupByMonth(data);

  return (
    <Screen>
      {header}
      <div className="flex flex-col gap-6 px-4 pt-3 pb-8">
        {groups.map((group) => (
          <ListGroup key={group.key} header={group.label || t("payment.history.unknownMonth")}>
            {group.items.map((payment) => (
              <PaymentRow
                key={payment.paymentIntentId}
                payment={payment}
                onOpen={() => {
                  setSelected(payment);
                  setSheetOpen(true);
                }}
              />
            ))}
          </ListGroup>
        ))}
        <p className="text-center text-xs leading-[1.5] text-fg-muted">{t("payment.history.endOfList")}</p>
      </div>
      <PaymentDetailSheet
        payment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onClosed={() => setSelected(null)}
      />
    </Screen>
  );
}
