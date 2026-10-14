import Link from "next/link";
import { ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { IconTile, ProgressBar, Surface } from "@/components/app";
import { formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatRatePercent } from "../_shared/text";
import type { RateGoal } from "./home-data";

/**
 * "Next rate goal" card on Home: current rate chip, GV → target progress and
 * a link to earnings with this month's estimated income. Server component.
 */
export function RateGoalCard({ goal, estimatedIncome }: { goal: RateGoal; estimatedIncome: number }) {
  return (
    <Surface padding="none" className="flex flex-col">
      <div className="p-4 md:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.8125rem] font-medium text-fg-muted">{t("dashboardHome.currentRate")}</p>
            <p className="tabular text-3xl leading-tight font-bold text-brand-fg">{formatRatePercent(goal.rate)}</p>
          </div>
          <IconTile icon={TrendingUp} tone="brand" size="sm" />
        </div>

        <div className="flex items-end justify-between gap-3 border-t border-hairline pt-4">
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-fg-muted">{t("dashboardHome.grossVolumeLabel")}</p>
            <p className="tabular text-lg font-semibold text-fg">{formatTHB(goal.grossVolume)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[0.8125rem] text-fg-muted">{t("dashboardHome.targetLabel")}</p>
            <p className="tabular text-sm font-semibold text-fg">
              {goal.state === "max" ? t("dashboardHome.maxRate") : formatTHB(goal.target)}
            </p>
          </div>
        </div>

        <ProgressBar value={goal.progress} label={t("dashboardHome.progressLabel")} className="mt-3" />

        <div className="mt-3 text-sm">
          {goal.state === "progress" ? (
            <p className="text-fg">
              {t("dashboardHome.remainingPrefix")}{" "}
              <span className="tabular font-semibold">{formatTHB(goal.remaining)}</span>{" "}
              <span className="text-fg-muted">{t("dashboardHome.remainingSuffix")}</span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 font-medium text-success-fg">
              <CheckCircle2 aria-hidden="true" className="size-4" />
              {goal.state === "max" ? t("dashboardHome.alreadyMaxRate") : t("dashboardHome.reachedGoal")}
            </p>
          )}
          <p className="mt-1 text-[0.8125rem] text-fg-muted">{t("dashboardHome.unlockHint")}</p>
        </div>
      </div>

      <Link
        href="/dashboard/earnings"
        className="pressable mt-auto flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 hover:bg-surface-muted md:px-5"
      >
        <span className="min-w-0">
          <span className="block text-[0.8125rem] text-fg-muted">{t("dashboardHome.estimatedNet")}</span>
          <span className="tabular block text-base font-semibold text-fg">{formatTHB(estimatedIncome)}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-fg">
          {t("dashboardHome.viewDetails")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </Link>
    </Surface>
  );
}
