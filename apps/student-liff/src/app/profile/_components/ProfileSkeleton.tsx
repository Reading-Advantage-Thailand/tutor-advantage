import { ListGroup, ListRowSkeleton, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Profile placeholder in the final layout: hero (title, avatar, name, chip), then the groups. Server-compatible. */
export function ProfileSkeleton() {
  return (
    <Screen>
      <header className="hero-surface px-4 pt-[calc(var(--safe-top)+20px)] pb-7">
        <h1 className="t-display">{t("profile.title")}</h1>
        <div className="mt-4 flex items-center gap-4" aria-hidden="true">
          <Skeleton className="size-[72px] shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Skeleton className="h-6 w-2/3 rounded-full" />
            <Skeleton className="h-8 w-40 rounded-full" />
          </div>
        </div>
      </header>
      <LoadingAnnouncement />
      <div className="grid gap-6 px-4 pt-5 pb-6 md:grid-cols-2 md:items-start" aria-hidden="true">
        {[
          [3, 3],
          [3, 4],
        ].map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-6">
            {column.map((count, index) => (
              <div key={index}>
                <div className="px-4 pb-2">
                  <Skeleton className="h-3.5 w-20 rounded-full" />
                </div>
                <ListGroup>
                  <ListRowSkeleton count={count} subtitle={false} />
                </ListGroup>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Screen>
  );
}
