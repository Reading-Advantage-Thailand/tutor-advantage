import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Users,
  TrendingUp,
  Calendar,
  Plus,
  ChevronRight,
  ArrowUpRight,
  Star,
} from "lucide-react";
import { cookies } from "next/headers";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { t } from "@/lib/i18n";
import { AnimatedCounter, AnimatedCurrencyCounter } from "@/components/ui/animated-counter";
import { PageTransition } from "@/components/ui/page-transition";

async function getLearningData(token: string) {
  const base = process.env.LEARNING_API_BASE_URL || "http://localhost:3002";
  const res = await fetch(`${base}/v1/dashboard/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getFinanceData(token: string) {
  const base = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  const res = await fetch(`${base}/v1/tutors/earnings/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

// Map status from backend to UI status
const statusMap: Record<string, { label: string; className: string }> = {
  open: {
    label: t("tutorClass.classes.statusOpen"),
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-none",
  },
  full: {
    label: t("tutorClass.classes.statusFull"),
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-none",
  },
  closed: {
    label: t("tutorClass.classes.statusClosed"),
    className: "bg-muted text-muted-foreground border-none",
  },
};

function formatCurrencyTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [learning, finance] = await Promise.all([
    getLearningData(token),
    getFinanceData(token),
  ]);

  const weeklyCount: number = learning?.classesThisWeek ?? 0;
  const commissionRate = finance ? `${(finance.currentRate * 100).toFixed(0)}%` : "0%";

  const stats = [
    {
      label: t("dashboardHome.openClasses"),
      value: learning?.openClasses ?? 0,
      isCurrency: false,
      icon: BookOpen,
      bg: "bg-indigo-500/10 dark:bg-indigo-900/20",
      iconColor: "text-indigo-600 dark:text-indigo-400",
      gradient: "from-indigo-500/5 to-indigo-500/0 dark:from-indigo-500/10 dark:to-indigo-500/2",
      border: "border-indigo-500/10 dark:border-indigo-500/20",
      badgeText: null,
      badgeColor: "",
    },
    {
      label: t("dashboardHome.totalStudents"),
      value: learning?.totalStudents ?? 0,
      isCurrency: false,
      icon: Users,
      bg: "bg-emerald-500/10 dark:bg-emerald-900/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      gradient: "from-emerald-500/5 to-emerald-500/0 dark:from-emerald-500/10 dark:to-emerald-500/2",
      border: "border-emerald-500/10 dark:border-emerald-500/20",
      badgeText: null,
      badgeColor: "",
    },
    {
      label: t("dashboardHome.monthlyIncome"),
      value: finance?.estimatedCommissionTHB ?? 0,
      isCurrency: true,
      icon: TrendingUp,
      bg: "bg-amber-500/10 dark:bg-amber-900/20",
      iconColor: "text-amber-600 dark:text-amber-400",
      gradient: "from-amber-500/5 to-amber-500/0 dark:from-amber-500/10 dark:to-amber-500/2",
      border: "border-amber-500/10 dark:border-amber-500/20",
      // Show real commission rate from API
      badgeText: finance ? `Rate ${commissionRate}` : null,
      badgeColor: "text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/20",
    },
    {
      label: t("dashboardHome.weeklyClasses"),
      value: weeklyCount,
      isCurrency: false,
      icon: Calendar,
      bg: "bg-rose-500/10 dark:bg-rose-900/20",
      iconColor: "text-rose-600 dark:text-rose-400",
      gradient: "from-rose-500/5 to-rose-500/0 dark:from-rose-500/10 dark:to-rose-500/2",
      border: "border-rose-500/10 dark:border-rose-500/20",
      // Derived from real data: any classes this week = active
      badgeText: weeklyCount > 0 ? "กำลังสอน" : "ไม่มีคลาส",
      badgeColor: weeklyCount > 0
        ? "text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/20"
        : "text-muted-foreground bg-muted",
    },
  ];

  const recentClasses = learning?.recentClasses || [];
  
  const targetGoal = finance?.nextTierTargetTHB ?? 20000;

  const progressPercent = finance 
    ? targetGoal > 0
      ? Math.min(100, Math.round((finance.grossVolumeTHB / targetGoal) * 100))
      : 100
    : 0;

  return (
    <PageTransition variant="slide-up" stagger className="space-y-8 max-w-5xl mx-auto w-full">
      <VerificationBanner />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardHome.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardHome.subtitle")}
          </p>
        </div>
        <Link href="/dashboard/classes/new" className="hidden sm:block">
          <Button id="btn-create-class" size="sm" className="h-10 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            {t("tutorClass.classes.create")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map(({ label, value, isCurrency, icon: Icon, bg, iconColor, gradient, border, badgeText, badgeColor }) => (
          <div
            key={label}
            className={`rounded-3xl border ${border} p-5 sm:p-6 flex flex-col justify-between bg-card bg-gradient-to-br ${gradient} hover-lift press-scale shine-effect shadow-sm hover:shadow-md transition-all group`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl w-fit transition-transform group-hover:scale-110 ${bg}`}>
                  <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
                {badgeText && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {badgeText}
                  </span>
                )}
              </div>
              <p className="text-2xl sm:text-3xl font-black text-foreground tracking-tight tabular-nums">
                {isCurrency ? (
                  <AnimatedCurrencyCounter value={value} />
                ) : (
                  <AnimatedCounter value={value} />
                )}
              </p>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Commission Progress */}
        <Card className="border border-brand-500/10 shadow-sm rounded-3xl bg-gradient-to-br from-brand-500/10 via-brand-500/5 to-transparent relative overflow-hidden lg:order-last group hover:border-brand-500/20 transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-brand-500/20 rounded-full blur-3xl group-hover:bg-brand-500/30 transition-colors" />

          <CardHeader className="pb-4 relative z-10">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2 uppercase tracking-widest">
              <Star className="h-5 w-5 text-amber-500 fill-amber-500 drop-shadow-sm animate-float" />
              {t("dashboardHome.nextRateGoal")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 relative z-10 pb-6 px-6">
            <div className="bg-card/85 backdrop-blur-sm p-4 rounded-2xl border border-white/20 dark:border-white/5 shadow-inner">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("dashboardHome.currentRate")}</span>
                <span className="text-2xl font-black text-primary drop-shadow-sm">
                  {commissionRate}
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-foreground">{formatCurrencyTHB(finance?.grossVolumeTHB ?? 0)}</span>
                <span className="text-muted-foreground">
                  {targetGoal > 0
                    ? `${t("dashboardHome.targetPrefix")} ${formatCurrencyTHB(targetGoal)}`
                    : t("dashboardHome.maxRate")}
                </span>
              </div>
              <div className="w-full bg-background/50 backdrop-blur-sm rounded-full h-4 overflow-hidden border border-border/50 shadow-inner relative">
                <div
                  className="bg-gradient-to-r from-brand-400 to-brand-600 dark:from-brand-500 dark:to-brand-300 h-4 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_12px_rgba(6,199,85,0.4)]"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-shimmer-cta" />
                </div>
              </div>
            </div>

            {/* Unlock nudge */}
            <div className="rounded-2xl bg-card/70 backdrop-blur-sm border border-border/40 shadow-sm p-5 space-y-2 hover-lift">
              {targetGoal <= 0 ? (
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot inline-block" />
                  {t("dashboardHome.alreadyMaxRate")}
                </p>
              ) : progressPercent >= 100 ? (
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot inline-block" />
                  {t("dashboardHome.reachedGoal")}
                </p>
              ) : (
                <p className="font-bold text-primary flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-brand-500 pulse-dot inline-block" />
                  {t("dashboardHome.remainingPrefix")}{" "}
                  <AnimatedCurrencyCounter value={finance ? targetGoal - finance.grossVolumeTHB : targetGoal} />
                </p>
              )}
              <p className="text-muted-foreground text-[10px] font-medium leading-relaxed">
                {t("dashboardHome.unlockHint")}
              </p>
            </div>

            {/* Breakdown Mini */}
            <div className="pt-4 border-t border-border/50">
              <Link
                href="/dashboard/earnings"
                className="flex items-center justify-between w-full group/link bg-background/50 hover:bg-background p-3 rounded-xl transition-colors border border-transparent hover:border-border/50"
              >
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("dashboardHome.netTotal")}</p>
                  <p className="font-black text-lg text-foreground">
                    <AnimatedCurrencyCounter value={finance?.estimatedCommissionTHB ?? 0} />
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-primary">
                  {t("dashboardHome.viewDetails")} <ArrowUpRight className="h-4 w-4 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 transition-transform" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Classes List */}
        <Card className="lg:col-span-2 border border-border/40 shadow-sm rounded-3xl bg-card flex flex-col overflow-hidden">
          <CardHeader className="pb-4 bg-muted/20 border-b px-6 sm:px-8 py-6 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground">
              {t("dashboardHome.recentClasses")}
            </CardTitle>
            <Link
              href="/dashboard/classes"
              className="text-xs font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              {t("dashboardHome.viewAll")} <ChevronRight className="h-4 w-4 animate-float" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <div className="divide-y divide-border/50 flex-1 stagger">
              {recentClasses.length === 0 && (
                <div className="py-16 text-center text-muted-foreground font-medium flex flex-col items-center justify-center gap-3">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                  {t("dashboardHome.emptyClasses")}
                </div>
              )}
              {recentClasses.map((cls: any, index: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
                const s = statusMap[cls.status] || statusMap["closed"];
                return (
                  <Link
                    key={cls.id}
                    href={`/dashboard/classes/${cls.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-6 group hover:bg-brand-50/20 dark:hover:bg-brand-900/10 hover:translate-x-1.5 transition-all duration-300 gap-4 animate-slide-up"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <p className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {cls.name}
                        </p>
                        <span
                          className={`sm:hidden px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.className}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-3">
                        <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                          <Calendar className="h-4 w-4 shrink-0" />
                          {cls.nextSession}
                        </span>
                        <span className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md">
                          <Users className="h-4 w-4 shrink-0" />
                          {cls.students} {t("tutorClass.classes.peopleUnit")}
                        </span>
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                      <span
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${s.className}`}
                      >
                        {s.label}
                      </span>
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="p-6 sm:hidden mt-auto border-t border-border/30 bg-muted/10">
              <Link href="/dashboard/classes/new" className="block w-full">
                <Button
                  className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {t("tutorClass.classes.create")}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
