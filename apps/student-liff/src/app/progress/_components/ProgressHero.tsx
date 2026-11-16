import Link from "next/link";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { IconTile, ProgressBar } from "@/components/mobile";
import { buttonVariants } from "@/components/ui/button";
import { getLevelTone } from "@/lib/cefr";
import { noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { cn } from "@/lib/utils";
import {
  buildReadHref,
  getProgressPercent,
  getRemainingLessons,
  type ProgressArticle,
  type ProgressStats,
} from "./progressModel";

/**
 * Progress card of the selected class's current book (patterns.md S9): book
 * tile in the level colour, the book, percent, lessons done/left with the
 * bar, the next goal in a well, and the page's one primary "เรียนต่อ" (tonal
 * when a finished book's "ไปเรียนเล่มถัดไป" is the primary). Server-compatible.
 */
export function ProgressHero({
  stats,
  currentArticle,
  primary = true,
}: {
  stats: ProgressStats;
  currentArticle?: ProgressArticle;
  /** False when another button on the page is the primary (the finished book's "ไปเรียนเล่มถัดไป"). */
  primary?: boolean;
}) {
  const percent = getProgressPercent(stats);
  const remaining = getRemainingLessons(stats);
  const unit = t("progress.articleUnit");
  const tone = getLevelTone(stats.cefr);

  return (
    <section
      aria-labelledby="progress-book-title"
      className="rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface p-5 shadow-[var(--shadow-card)]"
    >
      {/* The title has the whole text column (the percent sits on the bar's
          row, as on the home card), so a long book name wraps in full. */}
      <div className="flex items-start gap-3.5">
        <IconTile icon={BookOpen} tone={tone} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-[1.6] font-medium text-fg-muted">{t("progress.currentBook")}</p>
          <h2 id="progress-book-title" className="t-title-l line-clamp-3 text-balance text-fg">
            {noOrphan(stats.level)}
          </h2>
        </div>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm leading-[1.6] text-fg-muted tabular-nums">
        <span className="min-w-0">
          {t("progress.readPrefix")} {stats.articlesRead} {t("progress.from")} {stats.totalArticles} {unit}
        </span>
        <span className="shrink-0 text-[17px] leading-[1.4] font-semibold text-brand-fg">{percent}%</span>
      </div>
      <ProgressBar value={percent} className="mt-2" label={t("progress.currentBook")} />
      <p className="mt-1.5 text-right text-sm leading-[1.6] text-fg-muted tabular-nums">
        {t("progress.remainingPrefix")} {remaining} {unit}
      </p>
      <div className="well mt-4 flex items-start gap-3 px-3.5 py-3">
        <Target aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-fg" strokeWidth={2.2} />
        <span className="line-clamp-2 min-w-0 text-sm leading-[1.6] text-fg">
          {thaiCopy(stats.isBookComplete ? t("progress.bookComplete") : `${t("progress.nextGoal")} · ${stats.nextMilestone.reward}`)}
        </span>
      </div>
      {currentArticle ? (
        <Link
          href={buildReadHref(currentArticle.id)}
          className={cn(
            buttonVariants({ variant: primary ? "brand" : "brandSoft", size: "cta-lg" }),
            "mt-4 w-full",
          )}
        >
          {stats.isBookComplete ? t("progress.review") : t("progress.continue")}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
