import { LoadingAnnouncement, Skeleton } from "@/components/mobile";
import styles from "../voice-practice.module.css";

/** Voice-practice placeholder in its own layout (top bar, Reedy, cards, mic) instead of a full-screen spinner. */
export function VoicePracticeSkeleton() {
  return (
    <main className={styles.page}>
      <LoadingAnnouncement />
      <div aria-hidden="true" className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-4 px-5 pt-[calc(14px+var(--safe-top))]">
        <div className="flex w-full items-center justify-between">
          <Skeleton className="h-11 w-20 rounded-2xl" />
          <Skeleton className="h-12 w-28 rounded-2xl" />
        </div>
        <Skeleton className="mt-2 h-8 w-36 rounded-full" />
        <Skeleton className="h-8 w-4/5 rounded-full" />
        <Skeleton className="mt-2 size-52 rounded-full" />
        <Skeleton className="h-[58px] w-full rounded-[19px]" />
        <Skeleton className="h-[60px] w-full rounded-[17px]" />
        <Skeleton className="mt-2 size-24 rounded-full" />
      </div>
    </main>
  );
}
