import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import { WalletHero } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { thaiCopy } from "@/lib/thaiText";
import { fillTemplate, formatRatePercent } from "../_shared/text";
import type { RateGoal, WalletBreakdown } from "./home-data";

/**
 * Home wallet hero (patterns.md T1.3): this month's estimated income on the
 * one ink surface, the rate chip, then the goal block (GV vs the next-rate
 * target, sunshine bar, "ขาดอีก ฿X เพื่อขึ้นเรทถัดไป" and, quieter, how the
 * rate is unlocked). It replaces the old
 * separate "เป้าหมายเรทถัดไป" card; the link to earnings stays as a compact
 * on-ink action beside the amount. Server component.
 */
export function HomeWallet({
  goal,
  estimatedIncome,
  hasFinance,
  breakdown,
  className,
}: {
  goal: RateGoal;
  estimatedIncome: number;
  /** False when the finance summary failed to load (no rate chip and no commission line then). */
  hasFinance: boolean;
  /** Picks the commission line: solo, with network bonus, or none when unknown. */
  breakdown: WalletBreakdown;
  className?: string;
}) {
  const rate = formatRatePercent(goal.rate);
  const subline = !hasFinance
    ? undefined
    : breakdown.kind === "network"
      ? fillTemplate(t("dashboardHome.commissionWithNetwork"), {
          rate,
          personal: formatTHB(breakdown.personalVolume),
          bonus: formatTHB(breakdown.networkBonus, { fractionDigits: 0 }),
        })
      : breakdown.kind === "solo"
        ? fillTemplate(t("dashboardHome.commissionFrom"), { rate, amount: formatTHB(goal.grossVolume) })
        : undefined;
  return (
    <WalletHero
      className={className}
      label={t("dashboardHome.estimatedNet")}
      chip={hasFinance ? fillTemplate(t("dashboardHome.rateChip"), { rate }) : undefined}
      amount={formatTHB(estimatedIncome, { fractionDigits: 0 })}
      subline={subline}
      goal={{
        currentLabel: t("dashboardHome.grossVolumeLabel"),
        currentValue: formatTHB(goal.grossVolume),
        targetLabel: t("dashboardHome.nextRateGoal"),
        targetValue: goal.state === "max" ? t("dashboardHome.maxRate") : formatTHB(goal.target),
        progress: goal.progress,
        progressLabel: t("dashboardHome.progressLabel"),
        note: (
          <>
            {goal.state === "progress" ? (
              <>
                {t("dashboardHome.remainingPrefix")} <b>{formatTHB(goal.remaining)}</b> {t("dashboardHome.remainingSuffix")}
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                {goal.state === "max" ? t("dashboardHome.alreadyMaxRate") : t("dashboardHome.reachedGoal")}
              </span>
            )}
            {/* How the rate goes up (the old goal card's explanation), quiet under the goal line. */}
            <span className="mt-1 block text-[0.8125rem] leading-[1.6] font-normal text-ink-fg-muted">
              {thaiCopy(t("dashboardHome.unlockHint"))}
            </span>
          </>
        ),
      }}
      compactAction={
        <Button variant="on-ink" size="sm" render={<Link href="/dashboard/earnings" />} nativeButton={false}>
          {t("dashboardHome.viewDetails")}
          <ChevronRight aria-hidden="true" />
        </Button>
      }
    />
  );
}
