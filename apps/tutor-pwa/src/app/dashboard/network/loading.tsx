import { CardSkeleton, ListSkeleton, LoadingAnnouncement, Page, PageHeaderSkeleton } from "@/components/app";
import { StatementSkeleton, StatStripSkeleton } from "../earnings/money-skeletons";

/**
 * Mirrors the network page: header, summary strip, then share card, volume + tree, upline in
 * DOM (phone) order; from lg volume + tree on the left, share card + upline on the right.
 */
export default function NetworkLoading() {
  return (
    <Page>
      <LoadingAnnouncement />
      <PageHeaderSkeleton actions={false} />
      <StatStripSkeleton cells={4} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-6">
        <CardSkeleton lines={2} className="lg:col-start-2 lg:row-start-1" />
        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:gap-6">
          <StatementSkeleton rows={2} />
          <ListSkeleton rows={3} />
        </div>
        <ListSkeleton rows={2} className="lg:col-start-2 lg:row-start-2 lg:self-start" />
      </div>
    </Page>
  );
}
