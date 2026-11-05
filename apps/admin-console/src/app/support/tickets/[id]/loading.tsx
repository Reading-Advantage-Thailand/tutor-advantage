import { PageSkeleton } from "@/components/app";

/** Ticket detail: header + thread. */
export default function Loading() {
  return <PageSkeleton variant="list" stats={false} />;
}
