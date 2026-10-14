import { AppBar, LoadingAnnouncement, ListGroup, ListRowSkeleton, Screen, Skeleton, SkeletonText } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Reader placeholder in the final layout (loading.tsx + the page's loading branch). */
export function ReaderSkeleton() {
  return (
    <Screen>
      <AppBar title={t("articleReader.articleTitle")} back fallbackHref="/progress" />
      <LoadingAnnouncement />
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-4 pt-3 pb-10" aria-hidden="true">
        <Skeleton className="h-[76px] w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-4/5 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-xl" />
          <SkeletonText lines={5} />
          <SkeletonText lines={4} />
        </div>
        <ListGroup>
          <ListRowSkeleton count={3} />
        </ListGroup>
      </div>
    </Screen>
  );
}
