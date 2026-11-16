import { CatalogPageSkeleton } from "@/components/courses/CatalogSkeletons";

/**
 * Shown at once while the server loads the public catalogue (it can take a few seconds).
 * It lives in the (catalog) route group so it does not wrap /courses/[classId]: a loading
 * boundary there would stream the shell first and turn an unknown course's notFound()
 * into an HTTP 200 (soft 404). The detail route therefore has no loading.tsx.
 */
export default function CoursesLoading() {
  return <CatalogPageSkeleton />;
}
