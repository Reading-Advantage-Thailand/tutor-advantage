import { TrendingUp } from "lucide-react";
import { ProgressBar } from "@/components/app";
import { formatPercent } from "@/lib/format";
import { t } from "@/lib/i18n";
import { openingCycleProgress, type BookCycle } from "./book-cycles";
import { PanelCard } from "./PanelCard";

/**
 * Overview: how far the class is in the book the lesson picker opens on
 * (patterns.md T3 "progress"). Renders nothing when the API sent no progress
 * or its total would contradict the lesson list (openingCycleProgress).
 * Server-compatible.
 */
export function ClassProgressCard({ bookCycles, articleCount }: { bookCycles: BookCycle[]; articleCount?: number | null }) {
  const opening = openingCycleProgress(bookCycles, articleCount);
  if (!opening) return null;
  const { cycle, progress } = opening;
  const percent = Math.round(progress.percent ?? (progress.completedArticles / progress.totalArticles) * 100);
  const doneLine = `${t("tutorClass.detailView.progressDonePrefix")} ${progress.completedArticles} ${t("tutorClass.detailView.progressDoneMiddle")} ${progress.totalArticles} ${t("tutorClass.lessons.lessonsUnit")}`;
  return (
    <PanelCard
      id="class-progress-title"
      icon={TrendingUp}
      tone="brand"
      title={t("tutorClass.detailView.progressTitle")}
      description={cycle.title}
      action={<span className="type-stat text-fg">{formatPercent(percent, { isRatio: false })}</span>}
    >
      <ProgressBar value={percent} label={`${t("tutorClass.detailView.progressTitle")} ${doneLine}`} />
      <p className="mt-2 text-sm leading-[1.6] text-fg-muted tabular">{doneLine}</p>
    </PanelCard>
  );
}
