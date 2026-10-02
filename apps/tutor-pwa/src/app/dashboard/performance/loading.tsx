import {
  CardSkeleton,
  ListSkeleton,
  LoadingAnnouncement,
  Page,
  PageHeaderSkeleton,
  StatGridSkeleton,
} from "@/components/app";

/** Mirrors the performance page: header, KPI row, 4 quality cards, tier + goal, badges. */
export default function PerformanceLoading() {
  return (
    <Page>
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <StatGridSkeleton />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
      <ListSkeleton rows={3} />
    </Page>
  );
}
