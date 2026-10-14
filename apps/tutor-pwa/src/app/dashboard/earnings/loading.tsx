import {
  CardSkeleton,
  LoadingAnnouncement,
  PageHeaderSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from "@/components/app/Skeletons";

export default function EarningsLoading() {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8">
      <LoadingAnnouncement />
      <PageHeaderSkeleton />
      <StatGridSkeleton count={4} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={3} />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}
