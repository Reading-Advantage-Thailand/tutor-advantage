import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  BookOpen,
  TrendingUp,
  Target,
  Zap,
  Star,
  Users,
  CircleDollarSign,
  Trophy,
  MessageCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";
import {
  AnimatedCounter,
  AnimatedCurrencyCounter,
} from "@/components/ui/animated-counter";

type MetricSource = "actual" | "historical" | "unavailable";

type MetricValue = {
  value: number | null;
  source: MetricSource;
  sampleSize: number;
};

type StudentBenchmark = MetricValue & {
  current: number | null;
  target: number;
  level: string;
  correctAnswers: number | null;
  totalAnswers: number | null;
};

type PerformanceData = {
  metrics?: {
    studentBenchmark?: StudentBenchmark;
    engagement?: {
      responseTimeMinutes?: MetricValue;
      rating?: MetricValue;
      completedClasses?: number;
    };
    activity?: {
      completedClasses?: number;
      completedHours?: number;
      interactiveSessions?: number;
      referralCount?: number;
      reviews?: {
        total?: number;
        average?: number | null;
      };
      answers?: {
        total?: number;
        correct?: number;
      };
    };
  };
  badges?: {
    unlocked?: Badge[];
    nextGoal?: NextGoal | null;
  };
};

type Badge = {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  unlockedAt: string;
};

type NextGoal = {
  code: string;
  label: string;
  description: string;
  icon: string;
  progress: number;
};

async function getPerformanceData(
  token: string,
): Promise<PerformanceData | null> {
  try {
    const baseUrl =
      process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
    const res = await fetch(`${baseUrl}/v1/tutors/performance`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
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
      process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
    const res = await fetch(`${baseUrl}/v1/tutors/earnings/summary`, {
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

const sourceLabel: Record<MetricSource, string> = {
  actual: "ข้อมูลจริง",
  historical: "ข้อมูลย้อนหลัง",
  unavailable: "ยังไม่มีข้อมูล",
};

const sourceClass: Record<MetricSource, string> = {
  actual:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  historical:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  unavailable: "border-slate-500/15 bg-muted text-muted-foreground",
};

function SourceBadge({ source }: { source: MetricSource }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${sourceClass[source]}`}
    >
      {sourceLabel[source]}
    </span>
  );
}

function numberOrZero(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function metricValue(metric: MetricValue | undefined) {
  return typeof metric?.value === "number" ? metric.value : null;
}

function MetricPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
      <CardHeader className="space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-black">
          <Icon className="h-4 w-4 text-brand-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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

  const [performanceData, earningsData] = await Promise.all([
    getPerformanceData(token),
    getEarningsSummary(token),
  ]);

  const IconMap: Record<string, LucideIcon> = {
    Star,
    Zap,
    TrendingUp,
    Award,
    Target,
    Users,
    Trophy,
  };

  const badges = performanceData?.badges?.unlocked || [];
  const nextGoal = performanceData?.badges?.nextGoal;
  const metrics = performanceData?.metrics;
  const activity = metrics?.activity;
  const studentBenchmark = metrics?.studentBenchmark;
  const rating = metrics?.engagement?.rating;
  const responseTime = metrics?.engagement?.responseTimeMinutes;
  const ratingValue = metricValue(rating);
  const responseTimeValue = metricValue(responseTime);
  const studentSuccess =
    typeof studentBenchmark?.current === "number"
      ? studentBenchmark.current
      : null;
  const NextGoalIcon = nextGoal ? IconMap[nextGoal.icon] || Award : Award;

  const grossVolume = earningsData?.grossVolumeTHB || 0;
  const nextTier = earningsData?.nextTierTargetTHB || 0;
  const currentRate = earningsData?.currentRate || 0;
  const commissionPercent = Number((currentRate * 100).toFixed(2));
  const hasMetricData =
    studentSuccess !== null ||
    ratingValue !== null ||
    responseTimeValue !== null;
  const hasActivityData =
    numberOrZero(activity?.completedClasses) > 0 ||
    numberOrZero(activity?.completedHours) > 0 ||
    numberOrZero(activity?.interactiveSessions) > 0 ||
    numberOrZero(activity?.referralCount) > 0 ||
    numberOrZero(activity?.reviews?.total) > 0 ||
    numberOrZero(activity?.answers?.total) > 0;
  const hasPerformanceSignal =
    Boolean(performanceData) &&
    (hasMetricData || hasActivityData || badges.length > 0 || Boolean(nextGoal));

  let prevTier = 0;
  if (grossVolume >= 500000) prevTier = 500000;
  else if (grossVolume >= 100000) prevTier = 100000;
  else if (grossVolume >= 20000) prevTier = 20000;

  const effectiveTarget = nextTier > 0 ? nextTier : prevTier || 20000;
  const volumeRemaining = Math.max(0, effectiveTarget - grossVolume);
  const tierProgress =
    nextTier === 0 || effectiveTarget === prevTier
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((grossVolume - prevTier) / (effectiveTarget - prevTier)) * 100,
            ),
          ),
        );

  return (
    <PageTransition
      variant="slide-up"
      stagger
      className="mx-auto max-w-6xl space-y-6 pb-24 sm:pb-12 lg:space-y-8"
    >
      <section className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-[linear-gradient(140deg,#06c755_0%,#049a42_44%,#101827_100%)] p-6 text-white shadow-xl shadow-brand-900/10 sm:p-8">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-24 left-12 h-60 w-60 rounded-full bg-white/5"
        />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_28rem] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-black text-white/90 backdrop-blur">
              <Award className="h-4 w-4" />
              แดชบอร์ดผลงานครู
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {t("dashboardPerformance.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-white/75 sm:text-base">
              แสดงข้อมูลจากคลาสจริง คำตอบ Interactive Session
              และสรุปย้อนหลังที่ระบบมีอยู่ โดยไม่เติมคะแนนจำลองให้ครูใหม่
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/65">
                {t("dashboardPerformance.currentCommissionRate")}
              </p>
              <div className="mt-2 text-3xl font-black">
                <AnimatedCounter value={commissionPercent} fractionDigits={2} />%
              </div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/65">
                {t("dashboardPerformance.grossVolume")}
              </p>
              <AnimatedCurrencyCounter
                value={grossVolume}
                className="mt-2 block text-2xl font-black"
              />
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/65">
                คลาสที่สอนจบ
              </p>
              <div className="mt-2 text-3xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.completedClasses)}
                />
              </div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/15 p-4 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/65">
                Interactive Sessions
              </p>
              <div className="mt-2 text-3xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.interactiveSessions)}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {!performanceData && (
        <Card className="rounded-2xl border-destructive/20 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-5">
            <HelpCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-black text-foreground">
                ยังโหลดข้อมูลผลงานครูไม่ได้
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                ระบบจะไม่แสดงเลขศูนย์แทนผลงานจริง กรุณาลองใหม่อีกครั้งเมื่อ
                Learning API พร้อมใช้งาน
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {performanceData && !hasPerformanceSignal && (
        <Card className="rounded-2xl border-border/60 bg-muted/20">
          <CardContent className="flex items-start gap-3 p-5">
            <HelpCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-black text-foreground">
                ยังไม่มีข้อมูลผลงานจริงสำหรับหน้านี้
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                เมื่อมีคลาสที่สอนจบ รีวิว แชท หรือคำตอบจาก Interactive Session
                ระบบจะแสดงคะแนน ความก้าวหน้า เหรียญ และเป้าหมายถัดไปให้โดยอัตโนมัติ
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasPerformanceSignal && (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricPanel icon={Target} title="คุณภาพการสอน">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-3xl font-black text-foreground">
                {studentSuccess === null ? (
                  "N/A"
                ) : (
                  <>
                    <AnimatedCounter value={studentSuccess} />%
                  </>
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {studentBenchmark?.source === "actual" &&
                studentBenchmark.totalAnswers !== null
                  ? `คำตอบถูก ${studentBenchmark.correctAnswers ?? 0} / ${studentBenchmark.totalAnswers} ข้อ`
                  : studentBenchmark?.source === "historical"
                    ? "ใช้ค่าเฉลี่ยย้อนหลังจาก TutorPerformance"
                    : "ยังไม่มีข้อมูลคำตอบนักเรียน"}
              </p>
            </div>
            <SourceBadge source={studentBenchmark?.source || "unavailable"} />
          </div>
          <Progress value={studentSuccess ?? 0} className="mt-4 h-2" />
        </MetricPanel>

        <MetricPanel
          icon={Star}
          title={t("dashboardPerformance.averageRating")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1 text-3xl font-black text-foreground">
                {ratingValue === null ? "N/A" : ratingValue.toFixed(1)}
                {ratingValue !== null && (
                  <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {ratingValue === null
                  ? "ยังไม่มีข้อมูลรีวิว"
                  : rating?.source === "actual"
                    ? `เฉลี่ยจากรีวิวจริง ${rating.sampleSize} รายการ`
                    : "มาจาก overallRating ล่าสุดใน TutorPerformance"}
              </p>
            </div>
            <SourceBadge source={rating?.source || "unavailable"} />
          </div>
        </MetricPanel>

        <MetricPanel
          icon={MessageCircle}
          title={t("dashboardPerformance.fastResponse")}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-3xl font-black text-foreground">
                {responseTimeValue === null ? (
                  "N/A"
                ) : (
                  <>
                    <AnimatedCounter value={responseTimeValue} />
                    <span className="ml-1 text-sm font-black text-muted-foreground">
                      {t("dashboardPerformance.minuteUnit")}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {responseTimeValue === null
                  ? "ยังไม่มีข้อมูลเวลาตอบกลับ"
                  : responseTime?.source === "actual"
                    ? `คำนวณจากการตอบกลับจริง ${responseTime.sampleSize} ครั้ง`
                    : "มาจาก avgResponseTime ล่าสุดใน TutorPerformance"}
              </p>
            </div>
            <SourceBadge source={responseTime?.source || "unavailable"} />
          </div>
        </MetricPanel>

        <MetricPanel icon={CheckCircle2} title="กิจกรรมจริง">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                ชั่วโมงสอน
              </p>
              <p className="mt-1 text-xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.completedHours)}
                />
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Referral
              </p>
              <p className="mt-1 text-xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.referralCount)}
                />
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                คำตอบทั้งหมด
              </p>
              <p className="mt-1 text-xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.answers?.total)}
                />
              </p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                คำตอบถูก
              </p>
              <p className="mt-1 text-xl font-black">
                <AnimatedCounter
                  value={numberOrZero(activity?.answers?.correct)}
                />
              </p>
            </div>
          </div>
        </MetricPanel>
      </div>
      )}

      {hasPerformanceSignal && (
      <Card className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-card shadow-sm">
        <div className="absolute -right-10 -top-10 text-brand-500/[0.04] pointer-events-none">
          <Trophy className="h-44 w-44" />
        </div>
        <CardHeader className="relative z-10 pb-4">
          <div className="flex justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                <CircleDollarSign className="h-5 w-5 text-brand-500" />
                {t("dashboardPerformance.currentCommissionRate")}
              </CardTitle>
              <CardDescription className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {t("dashboardPerformance.networkCommission")}{" "}
                {commissionPercent.toFixed(2)}%
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black tracking-tight text-brand-500">
                <AnimatedCounter value={commissionPercent} fractionDigits={2} />%
              </div>
              <div className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Current Rate
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative z-10 space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("dashboardPerformance.grossVolume")}
              </span>
              <AnimatedCurrencyCounter
                value={grossVolume}
                className="block text-xl font-black text-foreground"
              />
            </div>
            <div className="text-right">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {nextTier > 0
                  ? t("dashboardPerformance.nextGoalPrefix")
                  : t("dashboardPerformance.maxTier")}
              </span>
              {nextTier > 0 && (
                <AnimatedCurrencyCounter
                  value={nextTier}
                  className="text-sm font-bold text-foreground"
                />
              )}
            </div>
          </div>
          <Progress value={tierProgress} className="h-3 bg-brand-500/10" />
          {nextTier > 0 ? (
            <p className="flex w-fit items-center gap-1.5 rounded-xl border border-brand-500/10 bg-brand-500/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
              <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {t("dashboardPerformance.remainingPrefix")}{" "}
              <AnimatedCurrencyCounter
                value={volumeRemaining}
                className="font-bold text-foreground"
              />{" "}
              {t("dashboardPerformance.remainingSuffix")}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400">
              <Star className="h-3.5 w-3.5 fill-brand-500 text-brand-500" />
              {t("dashboardPerformance.maxTierCongrats")}
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {hasPerformanceSignal && (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="rounded-3xl border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              {t("dashboardPerformance.badgesTitle")}
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground/80">
              {t("dashboardPerformance.badgesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {badges.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
                <p className="text-sm font-semibold text-muted-foreground">
                  {t("dashboardPerformance.noBadges")}
                </p>
              </div>
            )}
            {badges.map((badge) => {
              const Icon = IconMap[badge.icon] || Award;
              const classes = badge.color.split(" ");
              const textClass =
                classes.find((c) => c.startsWith("text-")) || "text-foreground";
              const bgClass =
                classes.find((c) => c.startsWith("bg-")) || "bg-muted";

              return (
                <div
                  key={badge.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card p-3.5 transition-colors hover:bg-brand-500/5"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/20 ${bgClass}`}
                  >
                    <Icon className={`h-5 w-5 ${textClass}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-bold leading-tight text-foreground">
                      {badge.label}
                    </h3>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">
                      {badge.description}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-md bg-muted/70 px-2 py-0.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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

        <Card className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(6,199,85,0.06),transparent)] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Target className="h-4 w-4 text-amber-500" />
              เป้าหมายถัดไป
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground/80">
              ทุกเป้าหมายพาไปจัดการคลาสเรียน เพื่อให้ปรับแผนสอนได้ทันที
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {nextGoal ? (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/15 shadow-sm">
                    <NextGoalIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black leading-tight text-foreground">
                        {nextGoal.label}
                      </h3>
                      <div className="rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                        <AnimatedCounter value={nextGoal.progress} />%
                      </div>
                    </div>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-muted-foreground">
                      {nextGoal.description}
                    </p>
                  </div>
                </div>
                <Progress
                  value={nextGoal.progress}
                  className="h-2 bg-amber-500/10"
                />
                <Link
                  href="/dashboard/classes"
                  prefetch={false}
                  className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-amber-500 px-5 text-sm font-black text-white shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-600"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("dashboardPerformance.goalLinks.classes")}
                </Link>
              </>
            ) : (
              <div className="rounded-3xl border border-dashed border-border/60 bg-muted/10 py-12 text-center">
                <p className="text-sm font-semibold text-muted-foreground">
                  ยังไม่มีเป้าหมายถัดไปจากระบบเหรียญรางวัล
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </PageTransition>
  );
}
