"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, QrCode, ReceiptText, TicketPercent } from "lucide-react";
import { AppBar, Chip, EmptyState, ErrorState, IconTile, ListGroup, ListRow, Screen } from "@/components/mobile";
import { useLiff } from "@/components/providers/LiffProvider";
import { buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatSatang, formatThaiDate, NBSP } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  getPaymentBookLabel,
  getPaymentStatusDisplay,
  groupByMonth,
  isDiscountCodeMethod,
  normalizePaymentMethod,
  type PaymentHistoryRecord,
} from "@/lib/paymentFlow";
import { PaymentDetailSheet } from "./_components/PaymentDetailSheet";
import { PaymentHistorySkeleton } from "./_components/PaymentHistorySkeleton";

async function fetchPaymentHistory(): Promise<PaymentHistoryRecord[]> {
  const response = await studentApi.getPaymentHistory();
  return (response?.payments ?? []) as PaymentHistoryRecord[];
}

/**
 * One payment (patterns.md S4): the shared ListRow (flat, inset hairline,
 * press tint, chevron since it opens the detail sheet) with the method tile,
 * class name (t-row) and the amount (tabular) on the same line, book · date,
 * then the status chip (dot + word).
 */
function PaymentRow({ payment, onOpen }: { payment: PaymentHistoryRecord; onOpen: () => void }) {
  const status = getPaymentStatusDisplay(payment.status);
  const isPromptPay = normalizePaymentMethod(payment.method) === "promptpay";
  const isDiscountCode = isDiscountCodeMethod(payment.method);
  const book = getPaymentBookLabel(payment) ?? t("payment.history.otherExpense");
  const date = formatThaiDate(payment.createdAt, "short");
  const icon = isDiscountCode ? (
    <IconTile icon={TicketPercent} tone="brand" size="sm" />
  ) : (
    <IconTile icon={isPromptPay ? QrCode : CreditCard} tone={isPromptPay ? "teal" : "amber"} size="sm" />
  );

  return (
    <ListRow
      onClick={onOpen}
      chevron
      leading={icon}
      // Top-aligned like the other S4 rows (the text runs to 3+ lines); the chevron stays centred.
      className="items-start py-3.5 [&>svg]:self-center"
      title={
        <span className="flex items-start justify-between gap-3">
          <span className="line-clamp-2 min-w-0 break-words">
            {payment.enrollment?.class?.title || t("payment.history.unnamedClass")}
          </span>
          <span className="shrink-0 tabular-nums">{formatSatang(payment.amountMinor)}</span>
        </span>
      }
      subtitle={
        // A flex column inside the subtitle: ListRow's 2-line clamp never cuts the
        // status chip, and a long book name wraps instead of hiding it.
        <span className="mt-0.5 flex flex-col items-start gap-2">
          {/* "· 2 พ.ย." stays on one line with the word before it (no line starting with "·"). */}
          <span>{date ? `${book}${NBSP}·${NBSP}${date.replace(/ /g, NBSP)}` : book}</span>
          <Chip tone={status.tone} dot>
            {t(status.labelKey)}
          </Chip>
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
        <div className="px-4 pt-3 pb-8">
          <ErrorState
            card
            description={error || liffError ? t("payment.history.fetchFailed") : undefined}
            // LIFF start-up failed (no session): retry start-up; otherwise just refetch.
            onRetry={liffError && !profile ? retry : () => void refetch()}
            retrying={isValidating}
          />
        </div>
      </Screen>
    );
  }

  if (data.length === 0) {
    return (
      <Screen>
        {header}
        <div className="px-4 pt-3 pb-8">
          <EmptyState
            card
            icon={ReceiptText}
            tone="amber"
            title={t("payment.history.emptyTitle")}
            description={t("payment.history.emptyDescription")}
            action={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                {t("payment.history.browseClasses")}
              </Link>
            }
          />
        </div>
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
        <p className="flex items-center justify-center gap-3 text-[13px] leading-[1.6] text-fg-muted">
          <span aria-hidden="true" className="h-[1.5px] w-8 rounded-full bg-hairline" />
          {t("payment.history.endOfList")}
          <span aria-hidden="true" className="h-[1.5px] w-8 rounded-full bg-hairline" />
        </p>
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
