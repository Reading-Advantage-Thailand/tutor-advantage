import { CardSkeleton, ListSkeleton, LoadingAnnouncement, Page, PageHeaderSkeleton } from "@/components/app";
import { StatementSkeleton, StatStripSkeleton } from "../earnings/money-skeletons";

/** Mirrors the performance page: header, stat strip, quality chart | activity, tier + goal, badges. */
export default function PerformanceLoading() {
  return (
    <Page>
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <StatStripSkeleton cells={4} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:gap-6">
        <StatementSkeleton rows={3} />
        <CardSkeleton lines={4} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={3} />
      </div>
      <ListSkeleton rows={3} />
    </Page>
  );
}
