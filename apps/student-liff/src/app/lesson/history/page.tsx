"use client";

import Link from "next/link";
import { BookOpen, History, Star, Trophy } from "lucide-react";
import { useLiff } from "@/components/providers/LiffProvider";
import { RankBadge } from "@/components/lesson/RankBadge";
import { AppBar, EmptyState, ErrorState, ListGroup, ListRow, Screen, StatTile } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { studentApi } from "@/lib/api";
import { useCachedResource } from "@/lib/cachedResource";
import { formatRelativeDay, formatThaiTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { HistorySkeleton } from "./_components/HistorySkeleton";
import { groupHistoryByDay, summarizeHistory, type HistoryItem } from "./_components/historyModel";

interface HistoryResponse {
  history?: HistoryItem[];
}

export default function AllHistoryPage() {
  const { isReady, profile, error: liffError, errorCode, retry } = useLiff();
  const { data, error, isLoading, refetch, isValidating } = useCachedResource<HistoryResponse>(
    profile ? `${profile.userId}:lessonHistory` : null,
    () => studentApi.getLessonHistory(),
    { enabled: isReady },
  );

  if (!isReady || isLoading) return <HistorySkeleton />;

  const appBar = <AppBar title={t("lessonHistory.title")} back fallbackHref="/dashboard" />;

  if (liffError || !profile) {
    return (
      <Screen>
        {appBar}
        <ErrorState kind={errorCode === "network" ? "offline" : "error"} onRetry={retry} className="flex-1 justify-center" />
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        {appBar}
        <ErrorState
          description={t("lessonHistory.loadFailed")}
          onRetry={() => void refetch()}
          retrying={isValidating}
          className="flex-1 justify-center"
        />
      </Screen>
    );
  }

  const historyData = data?.history ?? [];
  const summary = summarizeHistory(historyData);
  const groups = groupHistoryByDay(historyData);

  return (
    <Screen>
      {appBar}
      <div className="flex flex-col gap-5 px-4 pt-3 pb-8">
        {historyData.length === 0 ? (
          <EmptyState
            icon={History}
            title={t("lessonHistory.emptyTitle")}
            description={t("lessonHistory.emptyDescription")}
            action={
              <Link href="/classes" className={buttonVariants({ variant: "brand", size: "touch" })}>
                {t("lessonHistory.emptyCta")}
              </Link>
            }
            className="py-16"
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile icon={BookOpen} tone="brand" value={summary.lessons} label={t("lessonHistory.lessonsStat")} />
              <StatTile icon={Star} tone="amber" value={summary.totalScore} label={t("lessonHistory.totalScoreStat")} />
              <StatTile
                icon={Trophy}
                tone="purple"
                value={summary.bestRank ?? "–"}
                label={t("lessonHistory.bestRankStat")}
              />
            </div>

            <div className="flex flex-col gap-5" aria-label={t("lessonHistory.listAria")}>
              {groups.map((group) => (
                <ListGroup key={group.dayKey} header={formatRelativeDay(group.date)}>
                  {group.items.map((hist) => (
                    <ListRow
                      key={hist.sessionId}
                      href={`/lesson/history/${hist.sessionId}`}
                      leading={<RankBadge rank={hist.rank} />}
                      title={hist.articleTitle}
                      subtitle={`${t("lessonHistory.tutorPrefix")} ${hist.tutorName} · ${formatThaiTime(hist.date, { suffix: true })}`}
                      trailing={
                        <span className="flex flex-col items-end">
                          <span className="text-[17px] leading-[1.4] font-bold text-brand-fg tabular-nums">{hist.score}</span>
                          <span className="text-xs leading-[1.4] text-fg-muted">{t("lessonHistory.pointsUnit")}</span>
                        </span>
                      }
                    />
                  ))}
                </ListGroup>
              ))}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}
