import { ListGroup, ListRowSkeleton, LoadingAnnouncement, PageHeader, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Profile placeholder: header, avatar card and the settings groups. Server-compatible. */
export function ProfileSkeleton() {
  return (
    <Screen>
      <PageHeader title={t("profile.title")} />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-6 px-4 pb-6" aria-hidden="true">
        <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-hairline bg-surface p-5 shadow-[var(--shadow-card)]">
          <Skeleton className="size-20 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <Skeleton className="h-6 w-2/3 rounded-full" />
            <Skeleton className="h-[30px] w-40 rounded-full" />
          </div>
        </div>
        {[3, 2, 3].map((count, index) => (
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
    </Screen>
  );
}
