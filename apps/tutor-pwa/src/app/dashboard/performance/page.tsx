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
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCounter, AnimatedCurrencyCounter } from "@/components/ui/animated-counter";

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

function formatCurrencyTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

export default async function PerformancePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value;

  if (!token) {
    return (
      <div className="py-10 text-center font-bold text-muted-foreground">
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
  const commissionPercent = Math.round(currentRate * 100);

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
    <PageTransition variant="slide-up" stagger className="space-y-6 lg:space-y-8 max-w-4xl mx-auto pb-24 sm:pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            {t("dashboardPerformance.title")} <Award className="h-6 w-6 text-brand-500 animate-float" />
          </h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardPerformance.subtitle")}
          </p>
        </div>
      </div>

      {/* MLM Tiers & Volume Progress Card */}
      <Card className="border border-brand-500/20 bg-gradient-to-br from-brand-500/5 via-card to-card hover:shadow-lg rounded-3xl shadow-sm transition-all duration-300 overflow-hidden relative group animate-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="absolute -right-10 -top-10 text-brand-500/[0.04] pointer-events-none group-hover:scale-110 transition-transform duration-500">
          <Trophy className="h-44 w-44" />
        </div>
        <CardHeader className="pb-4 relative z-10">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-brand-500" />
                {t("dashboardPerformance.currentCommissionRate")}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {t("dashboardPerformance.networkCommission")} {commissionPercent}%
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black tracking-tight text-brand-500">
                <AnimatedCounter value={commissionPercent} />%
              </div>
              <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
                Current Rate
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 relative z-10">
          <div>
            <div className="flex justify-between items-end mb-2.5">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {t("dashboardPerformance.grossVolume")}
                </span>
                <AnimatedCurrencyCounter
                  value={grossVolume}
                  className="text-xl font-black text-foreground block"
                />
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  {nextTier > 0
                    ? t("dashboardPerformance.nextGoalPrefix")
                    : t("dashboardPerformance.maxTier")}
                </span>
                {nextTier > 0 && (
                  <AnimatedCurrencyCounter value={nextTier} className="text-sm font-bold text-foreground" />
                )}
              </div>
            </div>

            <div className="relative pt-1">
              <Progress value={tierProgress} className="h-3 bg-brand-500/10 border border-brand-500/5 p-[1px]" />
              {/* Segment Markers for visual aesthetic */}
              <div className="absolute inset-0 flex justify-between pointer-events-none p-[1px]">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-full w-px bg-white/20 dark:bg-black/10"
                  />
                ))}
              </div>
            </div>

            {nextTier > 0 ? (
              <p className="text-xs font-semibold text-muted-foreground mt-3 flex items-center gap-1.5 bg-brand-500/5 p-2 px-3 rounded-xl border border-brand-500/10 w-fit">
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 animate-pulse" />
                {t("dashboardPerformance.remainingPrefix")}{" "}
                <AnimatedCurrencyCounter
                  value={volumeRemaining}
                  className="text-foreground font-bold"
                />{" "}
                {t("dashboardPerformance.remainingSuffix")}
              </p>
            ) : (
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-3 flex items-center gap-1.5 font-bold">
                <Star className="h-3.5 w-3.5 fill-brand-500 text-brand-500" />
                {t("dashboardPerformance.maxTierCongrats")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 stagger">
        {/* Badges & Gamification */}
        <Card className="border border-border/40 hover:shadow-lg rounded-3xl bg-card shadow-sm transition-all duration-300 overflow-hidden animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="pb-3 px-5 sm:px-6 pt-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-float" />
              {t("dashboardPerformance.badgesTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground/80">
              {t("dashboardPerformance.badgesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 px-5 sm:px-6 pb-5 sm:pb-6">
            {badges.length === 0 && (
              <div className="py-12 text-center border rounded-3xl border-dashed border-border/60 bg-muted/10">
                <p className="text-muted-foreground text-sm font-semibold">
                  {t("dashboardPerformance.noBadges")}
                </p>
              </div>
            )}
            {badges.map((badge: any) => {
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
                  className="flex items-center gap-3 p-3.5 rounded-2xl border border-border/40 bg-card hover:bg-brand-500/5 transition-all duration-300 hover:shadow-sm hover:border-brand-500/10 group"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center shrink-0 border border-border/20 shadow-sm group-hover:scale-110 transition-transform`}
                  >
                    <Icon className={`h-5 w-5 ${textClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm text-foreground leading-tight">
                      {badge.label}
                    </h3>
                    <p className="text-[11px] font-semibold text-muted-foreground mt-0.5 truncate">
                      {badge.description}
                    </p>
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground shrink-0 text-right whitespace-nowrap uppercase tracking-wider bg-muted/70 px-2 py-0.5 rounded-md">
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
        <Card className="border border-border/40 hover:shadow-lg rounded-3xl bg-card shadow-sm transition-all duration-300 overflow-hidden animate-slide-up" style={{ animationDelay: '150ms' }}>
          <CardHeader className="pb-3 px-5 sm:px-6 pt-5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Target className="h-4 w-4 text-indigo-500" />
              {t("dashboardPerformance.benchmarksTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground/80">
              {t("dashboardPerformance.benchmarksDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 px-5 sm:px-6 pb-5 sm:pb-6">
            {!metrics ? (
              <div className="py-12 text-center border rounded-3xl border-dashed border-border/60 bg-muted/10">
                <p className="text-muted-foreground text-sm font-semibold">
                  {t("dashboardPerformance.noBenchmarks")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-border/40 bg-background/50 p-3 rounded-2xl text-center hover-lift transition-all">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {t("dashboardPerformance.averageRating")}
                    </p>
                    <div className="text-xl font-black text-foreground flex items-center justify-center gap-1">
                      {metrics.engagement?.rating?.toFixed(1) || "0.0"}
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400 animate-float" />
                    </div>
                  </div>
                  <div className="border border-border/40 bg-background/50 p-3 rounded-2xl text-center hover-lift transition-all">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      {t("dashboardPerformance.fastResponse")}
                    </p>
                    <div className="text-xl font-black text-foreground flex items-center justify-center gap-1">
                      <AnimatedCounter value={metrics.engagement?.responseTimeMinutes || 0} />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        {t("dashboardPerformance.minuteUnit")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-4 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.02]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-foreground">
                      {t("dashboardPerformance.overallBenchmark")}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/5 px-2.5 py-0.5 rounded-lg">
                      {metrics.studentBenchmark?.level || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground font-semibold">
                      {t("dashboardPerformance.studentSuccess")}
                    </span>
                    <div className="flex items-center gap-1 text-indigo-600 font-black">
                      <AnimatedCounter value={metrics.studentBenchmark?.current || 0} />%
                      <TrendingUp className="h-3 w-3 shrink-0" />
                    </div>
                  </div>

                  {/* Progress bar visual */}
                  <div className="w-full bg-indigo-500/10 rounded-full h-2.5 mt-1 overflow-hidden p-[1px] border border-indigo-500/5">
                    <div
                      className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-1.5 rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.min(100, Math.max(0, metrics.studentBenchmark?.current || 0))}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-muted-foreground px-0.5 mt-0.5">
                    <span>{t("dashboardPerformance.start")}</span>
                    <span>
                      {t("dashboardPerformance.target")} <AnimatedCounter value={metrics.studentBenchmark?.target || 0} />%
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
        <Card className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/25 shadow-md relative overflow-hidden group rounded-3xl animate-scale-in">
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 sm:p-6 relative">
            <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/10 flex items-center justify-center shrink-0 shadow-sm animate-float">
                <NextGoalIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg text-foreground leading-tight">
                    {t("dashboardPerformance.nextGoalPrefix")} {nextGoal.label}
                  </h3>
                  <div className="px-2 py-0.5 text-[10px] bg-amber-500 text-white font-black rounded-lg shadow-sm">
                    <AnimatedCounter value={nextGoal.progress} />%
                  </div>
                </div>
                <p className="text-sm font-medium text-muted-foreground mt-1.5 leading-snug">
                  {nextGoal.description}
                </p>
                <div className="w-full bg-amber-500/10 h-2 rounded-full mt-3.5 overflow-hidden p-[1px] border border-amber-500/5">
                  <div
                    className="h-1 bg-amber-500 transition-all duration-1000 rounded-full"
                    style={{ width: `${nextGoal.progress}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-auto shrink-0 flex justify-end">
              <GoalActionButton goal={nextGoal} />
            </div>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
