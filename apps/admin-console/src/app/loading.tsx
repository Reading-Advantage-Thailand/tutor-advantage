import { PageSkeleton } from "@/components/app";

/** Default route loading state (segments with a different shape add their own loading.tsx). */
export default function Loading() {
  return <PageSkeleton variant="table" />;
}
