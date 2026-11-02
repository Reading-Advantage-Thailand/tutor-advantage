import { ErrorState, Skeleton } from "@/components/mobile";
import { formatSatang, noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { DiscountQuote, OrderDisplay } from "@/lib/paymentFlow";
import { cn } from "@/lib/utils";
import type { LoadStatus } from "./usePaymentFlow";

const cardClass =
  "overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]";

function SummaryRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.5]">
      <span className="text-fg-muted">{label}</span>
      <span className={cn("text-right font-semibold text-fg tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

/** Same footprint as the loaded card, so nothing jumps when the class arrives. */
export function OrderSummarySkeleton() {
  return (
    <div className={cardClass} aria-hidden="true">
      <div className="flex flex-col gap-2.5 bg-fill-muted px-5 py-[18px]">
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-5 w-3/4 rounded-full" />
        <Skeleton className="h-3.5 w-1/2 rounded-full" />
      </div>
      <div className="flex flex-col gap-3.5 px-5 py-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-4 w-10 rounded-full" />
        </div>
        <div className="h-px bg-hairline" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-7 w-28 rounded-full" />
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

/** Brand header with the class, then price rows. Never shows a made-up price. */
export function OrderSummaryCard({ status, display, discount = null, onRetry }: OrderSummaryCardProps) {
  if (status === "loading") return <OrderSummarySkeleton />;
  if (status === "error") {
    return (
      <div className={cardClass}>
        <ErrorState
          title={t("payment.select.classLoadTitle")}
          description={t("payment.select.classLoadDescription")}
          onRetry={onRetry}
          className="py-8"
        />
      </div>
    );
  }

  const priceSatang = discount ? discount.originalAmountSatang : display.priceSatang;
  const price = priceSatang === null ? null : formatSatang(priceSatang);
  const total = discount ? formatSatang(discount.finalAmountSatang) : price;

  return (
    <section className={cardClass} aria-labelledby="payment-order-title">
      <div className="bg-hero px-5 py-[18px] text-hero-fg">
        <p className="text-[13px] leading-[1.5] font-semibold text-hero-fg-muted">{t("payment.select.orderSummary")}</p>
        <h2 id="payment-order-title" className="mt-0.5 text-[17px] leading-[1.45] font-bold break-words text-balance">
          {noOrphan(display.name)}
        </h2>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-hero-fg-muted">
          {display.tutor} · {display.cefr}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 px-5 py-4">
        {price ? <SummaryRow label={t("payment.select.tuition")} value={price} /> : null}
        {discount ? (
          <SummaryRow
            label={`${t("payment.select.discount")} (${discount.code})`}
            value={`−${formatSatang(discount.discountSatang)}`}
            valueClassName="text-success-fg"
          />
        ) : null}
        <SummaryRow label={t("payment.select.fee")} value={t("payment.select.noFee")} />
        <div className="my-1 h-px bg-hairline" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-base leading-[1.5] font-bold text-fg">{t("payment.select.total")}</span>
          {total ? (
            <span className="text-2xl leading-[1.3] font-extrabold text-brand-fg tabular-nums">{total}</span>
          ) : (
            <span className="text-right text-sm leading-[1.5] text-fg-muted">{t("payment.select.priceLater")}</span>
          )}
        </div>
      </div>
    </section>
  );
}
