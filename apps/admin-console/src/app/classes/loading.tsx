import { PageSkeleton } from "@/components/app";

/** Classes: header + table. */
export default function Loading() {
  return <PageSkeleton stats={false} variant="table" />;
}
