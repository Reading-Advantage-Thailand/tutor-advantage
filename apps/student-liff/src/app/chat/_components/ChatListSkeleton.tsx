import { AppBar, ListGroup, LoadingAnnouncement, Screen, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";

function SectionTitleSkeleton({ width }: { width: string }) {
  return (
    <div className="flex min-h-11 items-center">
      <Skeleton className={`h-5 rounded-full ${width}`} />
    </div>
  );
}

/** Chat-list body placeholder in the final layout: recent conversations + one "start a chat" class card. */
export function ChatListSkeletonBody() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-3 pb-6" aria-hidden="true">
      <section className="flex flex-col gap-2">
        <SectionTitleSkeleton width="w-28" />
        <ListGroup>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="list-row flex min-h-[76px] items-center gap-3.5 px-4 py-3 [--row-divider-inset:78px]"
              data-leading=""
            >
              <Skeleton className="size-12 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <Skeleton className={index % 2 ? "h-4 w-1/2 rounded-full" : "h-4 w-2/3 rounded-full"} />
                  <Skeleton className="ml-auto h-3 w-9 shrink-0 rounded-full" />
                </div>
                <Skeleton className="h-3 w-4/5 rounded-full" />
              </div>
            </div>
          ))}
        </ListGroup>
      </section>
      <section className="flex flex-col gap-2">
        <SectionTitleSkeleton width="w-32" />
        <Skeleton className="mx-4 mb-1 h-3.5 w-36 rounded-full" />
        <ListGroup>
          {[0, 1].map((index) => (
            <div key={index} className="list-row flex min-h-16 items-center gap-3.5 px-4 py-2.5" data-leading="">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-1/2 rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full" />
              </div>
            </div>
          ))}
        </ListGroup>
      </section>
    </div>
  );
}

/** Full chat-list loading screen (route loading.tsx and the page's own loading branch). */
export function ChatListSkeleton() {
  return (
    <Screen>
      <AppBar
        title={t("chat.title")}
        back
        fallbackHref="/dashboard"
        bottom={<Skeleton className="h-[52px] w-full rounded-[var(--radius-field)]" />}
      />
      <LoadingAnnouncement />
      <ChatListSkeletonBody />
    </Screen>
  );
}
