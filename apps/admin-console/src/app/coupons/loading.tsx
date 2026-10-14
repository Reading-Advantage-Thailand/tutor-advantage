import { PageSkeleton } from "@/components/app";

/** Coupons: header + 4 usage stats + table. */
export default function Loading() {
  return <PageSkeleton stats variant="table" />;
}
