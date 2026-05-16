import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  TrendingUp,
  Target,
  Zap,
  Star,
  Users,
  CircleDollarSign,
  ArrowUpRight,
  Trophy,
} from "lucide-react";
import { cookies } from "next/headers";
import { GoalActionButton } from "./goal-action-button";
import { t } from "@/lib/i18n";

async function getPerformanceData(token: string) {
  try {
    const baseUrl =
      process.env.LEARNING_API_BASE_URL || "http://localhost:3002/v1";
    const res = await fetch(`${baseUrl}/tutors/performance`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { tags: ["performance"] },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch performance data:", error);
    return null;
  }
}

async function getEarningsSummary(token: string) {
  try {
    const baseUrl =
      process.env.FINANCE_API_BASE_URL || "http://localhost:3003/v1";
    const res = await fetch(`${baseUrl}/tutors/earnings/summary`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch earnings summary:", error);
    return null;
  }
}

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatCurrencyTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export default async function PerformancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        {t("dashboardPerformance.loginRequired")}
      </div>
    );
  }

  // Fetch both simultaneously
  const [performanceData, earningsData] = await Promise.all([
    getPerformanceData(token),
    getEarningsSummary(token),
  ]);

  // Mapping string icon names to Lucide components safely
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconMap: Record<string, any> = {
    Star: Star,
    Zap: Zap,
    TrendingUp: TrendingUp,
    Award: Award,
    Target: Target,
    Users: Users,
    Trophy: Trophy,
  };

  const badges = performanceData?.badges?.unlocked || [];
  const nextGoal = performanceData?.badges?.nextGoal;
  const metrics = performanceData?.metrics;

  const NextGoalIcon = nextGoal ? IconMap[nextGoal.icon] || Award : Award;

  // Earnings MLM visual math
  const grossVolume = earningsData?.grossVolumeTHB || 0;
  const nextTier = earningsData?.nextTierTargetTHB || 0;
  const currentRate = earningsData?.currentRate || 0;

  // Find the prior boundary based on commissionService logic
  let prevTier = 0;
  if (grossVolume >= 500000) prevTier = 500000;
  else if (grossVolume >= 100000) prevTier = 100000;
  else if (grossVolume >= 20000) prevTier = 20000;

  const effectiveTarget = nextTier > 0 ? nextTier : prevTier || 20000;
  const volumeRemaining = Math.max(0, effectiveTarget - grossVolume);
  const tierProgress =
    nextTier === 0
      ? 100
      : Math.min(
          100,
          Math.round(
            ((grossVolume - prevTier) / (effectiveTarget - prevTier)) * 100,
          ),
        );

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          {t("dashboardPerformance.title")} <Award className="h-6 w-6 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("dashboardPerformance.subtitle")}
        </p>
      </div>

      {/* MLM Tiers & Volume Progress Card (Added as per product guidelines) */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] via-background to-background shadow-md overflow-hidden relative">
        <div className="absolute -right-10 -top-10 text-primary/[0.05]">
          <Trophy className="h-40 w-40" />
        </div>
        <CardHeader className="pb-4 relative">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                {t("dashboardPerformance.currentCommissionRate")}
              </CardTitle>
              <CardDescription className="text-sm font-medium text-primary mt-1">
                {t("dashboardPerformance.networkCommission")} {formatPercent(currentRate)}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black tracking-tight text-primary">
                {formatPercent(currentRate)}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold">
                Current Rate
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 relative">
          <div>
            <div className="flex justify-between items-end mb-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {t("dashboardPerformance.grossVolume")}
                </span>
                <div className="text-xl font-bold">
                  {formatCurrencyTHB(grossVolume)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-muted-foreground">
                  {nextTier > 0
                    ? `${t("dashboardPerformance.nextGoalPrefix")} ${formatCurrencyTHB(nextTier)}`
                    : t("dashboardPerformance.maxTier")}
                </span>
              </div>
            </div>

            <div className="relative pt-1">
              <Progress value={tierProgress} className="h-3 bg-muted/50" />
              {/* Segment Markers for visual aesthetic */}
              <div className="absolute inset-0 flex justify-between pointer-events-none">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-full w-px bg-white/30 dark:bg-black/10"
                  />
                ))}
              </div>
            </div>

            {nextTier > 0 ? (
              <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1.5 bg-primary/5 p-2 rounded-lg border border-primary/10 w-fit">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                {t("dashboardPerformance.remainingPrefix")}{" "}
                <strong className="text-foreground">
                  {formatCurrencyTHB(volumeRemaining)}
                </strong>{" "}
                {t("dashboardPerformance.remainingSuffix")}
              </p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2.5 flex items-center gap-1.5 font-medium">
                <Star className="h-3 w-3 fill-emerald-500" />
                {t("dashboardPerformance.maxTierCongrats")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        {/* Badges & Gamification */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              {t("dashboardPerformance.badgesTitle")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("dashboardPerformance.badgesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {badges.length === 0 && (
              <div className="py-6 text-center border rounded-xl border-dashed bg-muted/10">
                <p className="text-muted-foreground text-sm">
                  {t("dashboardPerformance.noBadges")}
                </p>
              </div>
            )}
            {badges.map((badge: any) => {
              // eslint-disable-line @typescript-eslint/no-explicit-any
              const Icon = IconMap[badge.icon] || Award;
              const classes = badge.color.split(" ");
              const textClass =
                classes.find((c: string) => c.startsWith("text-")) ||
                "text-foreground";
              const bgClass =
                classes.find((c: string) => c.startsWith("bg-")) || "bg-muted";

              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 transition-all hover:shadow-sm"
                >
                  <div
                    className={`w-10 h-10 rounded-full ${bgClass} flex items-center justify-center shrink-0 shadow-inner`}
                  >
                    <Icon className={`h-5 w-5 ${textClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground leading-tight">
                      {badge.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {badge.description}
                    </p>
                  </div>
                  <div className="text-[9px] text-muted-foreground shrink-0 text-right whitespace-nowrap">
                    {new Date(badge.unlockedAt).toLocaleDateString("th-TH", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Student Benchmarks */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              {t("dashboardPerformance.benchmarksTitle")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("dashboardPerformance.benchmarksDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!metrics ? (
              <div className="py-6 text-center border rounded-xl border-dashed bg-muted/10">
                <p className="text-muted-foreground text-sm">
                  {t("dashboardPerformance.noBenchmarks")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="border border-border/50 bg-muted/10 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {t("dashboardPerformance.averageRating")}
                    </p>
                    <div className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
                      {metrics.engagement?.rating?.toFixed(1) || "0.0"}
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  <div className="border border-border/50 bg-muted/10 p-3 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {t("dashboardPerformance.fastResponse")}
                    </p>
                    <div className="text-xl font-bold text-foreground flex items-center justify-center gap-1">
                      {metrics.engagement?.responseTimeMinutes || 0}
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("dashboardPerformance.minuteUnit")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 p-3 rounded-xl border border-border/50 bg-indigo-500/[0.03]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">
                      {t("dashboardPerformance.overallBenchmark")}
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                      {metrics.studentBenchmark?.level || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">
                      {t("dashboardPerformance.studentSuccess")}
                    </span>
                    <div className="flex items-center gap-1 text-indigo-600 font-semibold">
                      {metrics.studentBenchmark?.current || 0}%
                      <TrendingUp className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Progress bar visual */}
                  <div className="w-full bg-muted rounded-full h-2 mt-1 overflow-hidden shadow-inner border border-border/20">
                    <div
                      className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.max(0, metrics.studentBenchmark?.current || 0))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                    <span>{t("dashboardPerformance.start")}</span>
                    <span>
                      {t("dashboardPerformance.target")} {metrics.studentBenchmark?.target || 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gamification Call to Action */}
      {nextGoal && (
        <Card className="bg-gradient-to-r from-amber-500/10 to-transparent border-amber-200 dark:border-amber-800 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 relative">
            <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 shadow-sm">
                <NextGoalIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground leading-tight">
                    {t("dashboardPerformance.nextGoalPrefix")} {nextGoal.label}
                  </h3>
                  <div className="px-1.5 py-0.5 text-[10px] bg-amber-500 text-white font-bold rounded">
                    {nextGoal.progress}%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-snug">
                  {nextGoal.description}
                </p>
                <div className="w-full bg-amber-500/10 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-1000 rounded-full"
                    style={{ width: `${nextGoal.progress}%` }}
                  />
                </div>
              </div>
            </div>
            <GoalActionButton goal={nextGoal} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
