import { CardSkeleton } from "@/components/app";

/** Tab content placeholder (the [id] layout keeps the header and tabs on screen). */
export default function Loading() {
  return <CardSkeleton lines={6} />;
}
