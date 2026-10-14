import type { ReactNode } from "react";
import { ListGroup, ListRowSkeleton, LoadingAnnouncement, PageHeader, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

const cardClass = "rounded-[var(--radius-card)] border border-hairline bg-surface p-4 shadow-[var(--shadow-card)]";

/** Progress placeholder: header, chips, book hero, 3 stats, week chart and lesson rows. Server-compatible. */
export function ProgressSkeleton({ header }: { header?: ReactNode }) {
  return (
    <Screen>
      {header ?? <PageHeader title={t("progress.title")} />}
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pb-6" aria-hidden="true">
        {/* No chip-row placeholder: most students have one class and one book, so there are no chips. */}
        <Skeleton className="h-[228px] w-full rounded-[var(--radius-card)]" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`${cardClass} flex flex-col gap-2 p-3`}>
              <Skeleton className="size-8 rounded-[10px]" />
              <Skeleton className="h-5 w-10 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
          ))}
        </div>
        <div className={cardClass}>
          <Skeleton className="h-5 w-24 rounded-full" />
          <div className="mt-4 grid h-[104px] grid-cols-7 items-end gap-2">
            {[40, 70, 30, 55, 20, 35, 25].map((height, index) => (
              <Skeleton key={index} className="w-full rounded-lg" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex min-h-11 items-center">
            <Skeleton className="h-5 w-32 rounded-full" />
          </div>
          <ListGroup>
            <ListRowSkeleton count={5} />
          </ListGroup>
        </div>
      </div>
    </Screen>
  );
}
