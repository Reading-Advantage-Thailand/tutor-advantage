import { AppBar, ListGroup, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** One placeholder payment row: tile, title + amount, meta line, status chip. */
function PaymentRowSkeleton({ index }: { index: number }) {
  return (
    <div className="list-row flex min-h-16 items-start gap-3.5 px-4 py-3.5" data-leading="" aria-hidden="true">
      <Skeleton className="mt-0.5 size-10 shrink-0 rounded-[12px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex justify-between gap-3">
          <Skeleton className={index % 2 ? "h-4 w-1/2 rounded-full" : "h-4 w-2/3 rounded-full"} />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-3/5 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Month header + rows in the final layout (loading.tsx and the page's loading branch). */
export function PaymentHistorySkeleton() {
  return (
    <Screen>
      <AppBar title={t("payment.history.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-8" aria-hidden="true">
        {[3, 2].map((rows, groupIndex) => (
          <div key={groupIndex}>
            <Skeleton className="mb-3 ml-4 h-3.5 w-28 rounded-full" />
            <ListGroup>
              {Array.from({ length: rows }, (_, index) => (
                <PaymentRowSkeleton key={index} index={index} />
              ))}
            </ListGroup>
          </div>
        ))}
      </div>
    </Screen>
  );
}
