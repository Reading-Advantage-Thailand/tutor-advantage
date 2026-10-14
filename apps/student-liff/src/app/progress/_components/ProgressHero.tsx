import Link from "next/link";
import { ArrowRight, BookOpen, Target } from "lucide-react";
import { ProgressBar } from "@/components/mobile";
import { noOrphan } from "@/lib/format";
import { t } from "@/lib/i18n";
import {
  buildReadHref,
  getProgressPercent,
  getRemainingLessons,
  type ProgressArticle,
  type ProgressStats,
} from "./progressModel";

/**
 * Current book: percent, lessons done/left, next goal and the one
 * "เรียนต่อ" (or "ทบทวน" when the book is finished) button. Server-compatible.
 */
export function ProgressHero({ stats, currentArticle }: { stats: ProgressStats; currentArticle?: ProgressArticle }) {
  const percent = getProgressPercent(stats);
  const remaining = getRemainingLessons(stats);
  const unit = t("progress.articleUnit");

  return (
    <section
      aria-labelledby="progress-book-title"
      className="rounded-[var(--radius-card)] bg-hero p-5 text-hero-fg shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] leading-[1.5] font-medium text-hero-fg-muted">
          <BookOpen aria-hidden="true" className="size-4 shrink-0" />
          {t("progress.currentBook")}
        </span>
        <span className="shrink-0 text-2xl leading-[1.3] font-extrabold tabular-nums">{percent}%</span>
      </div>
      <h2 id="progress-book-title" className="mt-1 line-clamp-2 text-xl leading-[1.4] font-extrabold text-balance">
        {noOrphan(stats.level)}
      </h2>
      <div className="mt-4 flex items-center justify-between gap-3 text-[13px] leading-[1.5] text-hero-fg-muted">
        <span>
          {t("progress.readPrefix")} {stats.articlesRead} {t("progress.from")} {stats.totalArticles} {unit}
        </span>
        <span className="shrink-0">
          {t("progress.remainingPrefix")} {remaining} {unit}
        </span>
      </div>
      <ProgressBar value={percent} tone="onBrand" className="mt-2" label={t("progress.currentBook")} />
      <div className="mt-4 flex items-center gap-3 border-t border-hero-ring pt-4">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] leading-[1.5] text-hero-fg-muted">
          <Target aria-hidden="true" className="size-4 shrink-0" />
          <span className="line-clamp-2">
            {stats.isBookComplete ? t("progress.bookComplete") : `${t("progress.nextGoal")} · ${stats.nextMilestone.reward}`}
          </span>
        </span>
        {currentArticle ? (
          <Link
            href={buildReadHref(currentArticle.id)}
            className="pressable inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-solid px-4 text-[15px] leading-[1.4] font-bold text-white shadow-[0_3px_0_var(--brand-solid-edge)] active:bg-brand-solid-pressed"
          >
            {stats.isBookComplete ? t("progress.review") : t("progress.continue")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
