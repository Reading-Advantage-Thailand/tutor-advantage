import { ClassDetailSkeleton } from "./_components/ClassDetailSkeleton";

/** Route-level loading state for /classes/[id] (the list skeleton does not fit here). */
export default function ClassDetailLoading() {
  return <ClassDetailSkeleton />;
}
