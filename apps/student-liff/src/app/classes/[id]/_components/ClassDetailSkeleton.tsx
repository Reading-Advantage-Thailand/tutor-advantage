import { Share2 } from "lucide-react";
import {
  AppBar,
  BottomActionBar,
  CardSkeleton,
  IconButton,
  ListGroup,
  ListRowSkeleton,
  LoadingAnnouncement,
  Screen,
  Skeleton,
} from "@/components/mobile";
import { t } from "@/lib/i18n";

/**
 * The detail screen's app bar: back (to the catalog when there is no in-app
 * history) + share. Share is disabled until the class has loaded.
 */
export function ClassDetailAppBar({ onShare }: { onShare?: () => void }) {
  return (
    <AppBar
      title={t("classes.detail.title")}
      back
      fallbackHref="/classes"
      actions={
        <span id="btn-share-class" className="inline-flex">
          <IconButton icon={Share2} label={t("classes.detail.shareAria")} onClick={onShare} disabled={!onShare} />
        </span>
      }
    />
  );
}

/**
 * Loading state of /classes/[id] (route loading.tsx and the page's own
 * loading branch): app bar, hero, a card, a list and the bottom action bar —
 * the blocks both the enrolled and the sales layout start with.
 */
export function ClassDetailSkeleton() {
  return (
    <Screen>
      <ClassDetailAppBar />
      <LoadingAnnouncement />
      <div className="flex flex-col gap-5 px-4 pt-2 pb-6" aria-hidden="true">
        <div className="rounded-[var(--radius-card)] bg-fill-muted p-5">
          <div className="flex gap-2">
            <Skeleton className="h-[30px] w-24 rounded-full" />
            <Skeleton className="h-[30px] w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-6 w-3/4 rounded-full" />
          <Skeleton className="mt-3 h-4 w-1/2 rounded-full" />
        </div>
        <CardSkeleton lines={2} />
        <div>
          <Skeleton className="mb-3 h-5 w-1/3 rounded-full" />
          <ListGroup>
            <ListRowSkeleton count={3} />
          </ListGroup>
        </div>
      </div>
      <BottomActionBar>
        <Skeleton className="h-[52px] flex-1 rounded-2xl" />
      </BottomActionBar>
    </Screen>
  );
}
