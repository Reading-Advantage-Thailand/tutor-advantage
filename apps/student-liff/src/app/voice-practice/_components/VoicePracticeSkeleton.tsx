import { AppBar, LoadingAnnouncement, Skeleton } from "@/components/mobile";
import { t } from "@/lib/i18n";
import styles from "../voice-practice.module.css";

/** Voice-practice placeholder in its final layout (app bar, lesson title, Reedy's stage, status, mic, transcript card). */
export function VoicePracticeSkeleton() {
  return (
    <main className={styles.page}>
      <AppBar title={t("interactivePlay.voicePracticeTitle")} back fallbackHref="/progress" className="shrink-0 border-b-[1.5px] border-clay-rim" />
      <LoadingAnnouncement />
      <div aria-hidden="true" className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-3.5 px-4 pt-3">
        <Skeleton className="h-3.5 w-28 rounded-full" />
        <Skeleton className="h-6 w-3/5 rounded-full" />
        <Skeleton className="h-[200px] w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-9 w-44 rounded-full" />
        <Skeleton className="mt-1 size-[72px] rounded-full" />
        <Skeleton className="h-4 w-32 rounded-full" />
        <Skeleton className="h-16 w-full rounded-[var(--radius-card)]" />
      </div>
    </main>
  );
}
