import { BookOpen, ReceiptText } from "lucide-react";
import { ErrorState, IconTile, Skeleton } from "@/components/mobile";
import { formatSatang, noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getDiscountRowLabelKey, type DiscountQuote, type OrderDisplay } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import type { LoadStatus } from "./usePaymentFlow";

// Container card: 1.5px rim + soft shadow, no ledge (not tappable).
const cardClass =
  "overflow-hidden rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";

function SummaryRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.6]">
      <span className="min-w-0 text-fg-muted">{label}</span>
      <span className={cn("shrink-0 text-right font-semibold text-fg tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

/** Same footprint as the loaded card, so nothing jumps when the class arrives. */
export function OrderSummarySkeleton() {
  return (
    <div className={cardClass} aria-hidden="true">
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <Skeleton className="size-14 shrink-0 rounded-[18px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
          <Skeleton className="h-3 w-20 rounded-full" />
          <Skeleton className="h-5 w-3/4 rounded-full" />
          <Skeleton className="h-3.5 w-1/2 rounded-full" />
          <Skeleton className="h-4 w-36 rounded-full" />
        </div>
      </div>
      <div className="well mx-5 mb-5 flex flex-col gap-3.5 px-4 py-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
        <div className="h-[1.5px] bg-hairline" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export interface OrderSummaryCardProps {
  status: LoadStatus;
  display: OrderDisplay;
  /** An applied code: the rows use its amounts from the API (the total can be ฿0). */
  discount?: DiscountQuote | null;
  onRetry: () => void;
}

/**
 * The order first (patterns.md S12): book tile, class name, tutor and the
 * package chip, then the price rows in a well with the total in the reading
 * face (600, tabular). Never shows a made-up price.
 */
export function OrderSummaryCard({ status, display, discount = null, onRetry }: OrderSummaryCardProps) {
  if (status === "loading") return <OrderSummarySkeleton />;
  if (status === "error") {
    return (
      <ErrorState
        card
        title={t("payment.select.classLoadTitle")}
        description={t("payment.select.classLoadDescription")}
        onRetry={onRetry}
        className="py-8"
      />
    );
  }

  const priceSatang = discount ? discount.originalAmountSatang : display.priceSatang;
  const price = priceSatang === null ? null : formatSatang(priceSatang);
  const total = discount ? formatSatang(discount.finalAmountSatang) : price;

  return (
    <section className={cardClass} aria-labelledby="payment-order-title">
      <div className="flex items-start gap-3.5 p-5 pb-4">
        <IconTile icon={ReceiptText} tone="brand" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-[1.5] font-medium text-fg-muted">{t("payment.select.orderSummary")}</p>
          <h2 id="payment-order-title" className="t-title mt-0.5 break-words text-balance text-fg">
            {noOrphan(display.name)}
          </h2>
          <p className="mt-0.5 text-sm leading-[1.6] break-words text-fg-muted">{display.tutor}</p>
          {/* The package (book / level): a meta line, so a long book name wraps instead of truncating. */}
          <p className="mt-1 flex items-start gap-1.5 text-sm leading-[1.6] font-semibold break-words text-brand-fg">
            <BookOpen aria-hidden="true" className="mt-[3px] size-4 shrink-0" strokeWidth={2.4} />
            <span className="min-w-0">{display.cefr}</span>
          </p>
        </div>
      </div>
      <div className="well mx-5 mb-5 flex flex-col gap-2 px-4 py-3.5">
        {price ? <SummaryRow label={t("payment.select.tuition")} value={price} /> : null}
        {discount ? (
          <SummaryRow
            label={`${t(getDiscountRowLabelKey(discount))} (${discount.code})`}
            value={`−${formatSatang(discount.discountSatang)}`}
            valueClassName="text-success-fg"
          />
        ) : null}
        <SummaryRow label={t("payment.select.fee")} value={t("payment.select.noFee")} />
        <div className="my-1 h-[1.5px] bg-hairline" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-base leading-[1.5] font-semibold text-fg">{t("payment.select.total")}</span>
          {total ? (
            <span className="text-[28px] leading-[1.25] font-semibold text-brand-fg tabular-nums">{total}</span>
          ) : (
            <span className="text-right text-sm leading-[1.6] text-fg-muted">{t("payment.select.priceLater")}</span>
          )}
        </div>
      </div>
    </section>
  );
}
