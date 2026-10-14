import { AppBar, BottomActionBar, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { OrderSummarySkeleton } from "./OrderSummaryCard";

/**
 * Method-screen placeholder in the final layout. Used by payment/loading.tsx
 * and the page's Suspense fallback (search params not read yet).
 */
export function PaymentSkeleton() {
  return (
    <Screen>
      <AppBar title={t("payment.select.title")} back fallbackHref="/classes" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-6" aria-hidden="true">
        <OrderSummarySkeleton />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-36 rounded-full" />
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="flex min-h-[76px] items-center gap-3.5 rounded-[var(--radius-card)] border border-hairline bg-surface p-4"
            >
              <Skeleton className="size-12 shrink-0 rounded-[14px]" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2 rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
              <Skeleton className="size-6 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <BottomActionBar>
        <Skeleton className="h-[52px] flex-1 rounded-2xl" />
      </BottomActionBar>
    </Screen>
  );
}
