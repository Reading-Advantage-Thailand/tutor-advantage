import {
  CardSkeleton,
  ListSkeleton,
  LoadingAnnouncement,
  Page,
  PageHeaderSkeleton,
  Skeleton,
  StatGridSkeleton,
} from "@/components/app";

/** Mirrors the network page: header, invite card, KPI row, volume + sponsor, graph. */
export default function NetworkLoading() {
  return (
    <Page>
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <CardSkeleton lines={1} />
      <StatGridSkeleton />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <CardSkeleton lines={4} />
        <ListSkeleton rows={2} />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </Page>
  );
}
