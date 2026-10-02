import { ErrorState, Skeleton } from "@/components/mobile";
import { formatSatang } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { OrderDisplay } from "@/lib/paymentFlow";
import type { LoadStatus } from "./usePaymentFlow";

const cardClass =
  "overflow-hidden rounded-[var(--radius-card)] border border-hairline bg-surface shadow-[var(--shadow-card)]";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[15px] leading-[1.5]">
      <span className="text-fg-muted">{label}</span>
      <span className="text-right font-semibold text-fg tabular-nums">{value}</span>
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
  onRetry: () => void;
}

/** Brand header with the class, then price rows. Never shows a made-up price. */
export function OrderSummaryCard({ status, display, onRetry }: OrderSummaryCardProps) {
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

  const price = display.priceSatang === null ? null : formatSatang(display.priceSatang);

  return (
    <section className={cardClass} aria-labelledby="payment-order-title">
      <div className="bg-gradient-brand px-5 py-[18px] text-white">
        <p className="text-[13px] leading-[1.5] font-semibold text-white/85">{t("payment.select.orderSummary")}</p>
        <h2 id="payment-order-title" className="mt-0.5 text-[17px] leading-[1.45] font-bold break-words">
          {display.name}
        </h2>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-white/85">
          {display.tutor} · {display.cefr}
        </p>
      </div>
      <div className="flex flex-col gap-2.5 px-5 py-4">
        {price ? <SummaryRow label={t("payment.select.tuition")} value={price} /> : null}
        <SummaryRow label={t("payment.select.fee")} value={t("payment.select.noFee")} />
        <div className="my-1 h-px bg-hairline" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-base leading-[1.5] font-bold text-fg">{t("payment.select.total")}</span>
          {price ? (
            <span className="text-2xl leading-[1.3] font-extrabold text-brand-fg tabular-nums">{price}</span>
          ) : (
            <span className="text-right text-sm leading-[1.5] text-fg-muted">{t("payment.select.priceLater")}</span>
          )}
        </div>
      </div>
    </section>
  );
}
