import { PageSkeleton } from "@/components/app";

/** Class attendance: header + two tables. */
export default function Loading() {
  return <PageSkeleton variant="table" stats={false} />;
}
