import { AppBar, BottomActionBar, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

/** Lobby placeholder in the final layout (used by loading.tsx and the page's loading branch). */
export function LobbySkeleton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  return (
    <Screen>
      <AppBar title={t("lessonLobby.lobbyTitle")} back fallbackHref={fallbackHref} />
      <LoadingAnnouncement label={t("lessonLobby.preparingTitle")} />
      <div className="flex flex-col gap-5 px-4 pt-3 pb-6" aria-hidden="true">
        <Skeleton className="h-[132px] w-full rounded-[var(--radius-card)]" />
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-hairline bg-surface p-4">
          <Skeleton className="size-12 shrink-0 rounded-xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-1/3 rounded-full" />
            <Skeleton className="h-4 w-1/2 rounded-full" />
            <Skeleton className="h-3 w-4/5 rounded-full" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-3 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <BottomActionBar>
        <Skeleton className="h-[52px] w-full rounded-2xl" />
      </BottomActionBar>
    </Screen>
  );
}
