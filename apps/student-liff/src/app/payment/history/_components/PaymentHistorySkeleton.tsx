import { AppBar, ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Month header + rows in the final layout (loading.tsx and the page's loading branch). */
export function PaymentHistorySkeleton() {
  return (
    <Screen>
      <AppBar title={t("payment.history.title")} back fallbackHref="/profile" />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pt-3 pb-8" aria-hidden="true">
        {[3, 2].map((rows, index) => (
          <div key={index}>
            <Skeleton className="mb-3 ml-4 h-3.5 w-28 rounded-full" />
            <ListGroup>
              <ListRowSkeleton count={rows} />
            </ListGroup>
          </div>
        ))}
      </div>
    </Screen>
  );
}
