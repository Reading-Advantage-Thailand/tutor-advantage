import { LoadingAnnouncement, Page, PageHeaderSkeleton, TableSkeleton } from "@/components/app";
import { StatementSkeleton, StatStripSkeleton, WalletHeroSkeleton } from "./money-skeletons";

/** Mirrors the earnings page: header, wallet hero + strip | statement, notice, history table. */
export default function EarningsLoading() {
  return (
    <Page>
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <WalletHeroSkeleton />
          <StatStripSkeleton cells={4} />
        </div>
        <StatementSkeleton rows={5} />
      </div>
      <TableSkeleton rows={4} columns={6} />
    </Page>
  );
}
