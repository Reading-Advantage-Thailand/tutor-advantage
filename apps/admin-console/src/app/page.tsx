"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FilePenLine,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Users,
  TrendingUp,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";
import { t } from "@/lib/i18n";

interface Overview {
  stats: {
    totalSettlementsLast30Days: number;
    pendingApprovals: number;
    pendingAdjustments: number;
    pendingVerificationUsers: number;
    unresolvedExceptions: number;
    activeFraudFlags: number;
  };
  workQueues: Record<string, number>;
  recentActivity: {
    auditId: string;
    actionType: string;
    entityType: string;
    targetId: string;
    createdAt: string;
  }[];
  health: {
    api: string;
    database: string;
  };
}

const QUEUES = [
  {
    key: "settlements",
    title: "Settlements",
    description: "Finance approvals",
    href: "/settlements",
    icon: ReceiptText,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    key: "adjustments",
    title: "Adjustments",
    description: "Ledger reviews",
    href: "/adjustments",
    icon: FilePenLine,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "verifications",
    title: "Verifications",
    description: "Tutor onboarding",
    href: "/users",
    icon: Users,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    key: "exceptions",
    title: "Exceptions",
    description: "System errors",
    href: "/operations/exceptions",
    icon: AlertTriangle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    key: "fraudFlags",
    title: "Fraud Flags",
    description: "Risk alerts",
    href: "/fraud",
    icon: ShieldAlert,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
];

function StatSkeleton() {
  return (
    <Card className="overflow-hidden border-none bg-card shadow-sm">
      <div className="h-2 w-full bg-muted animate-pulse" />
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-16" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("admin_role"));
  }, []);

  useEffect(() => {
    const loadOverview = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchWithAuth("/v1/admin/overview");
        setOverview(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load overview");
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-8 text-white shadow-2xl shadow-brand-500/20">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("dashboard.welcomePrefix")} {role || t("layout.defaultRole")}{t("dashboard.welcomeSuffix")}
            </h2>
            <p className="mt-2 text-brand-100/90 font-medium">
              {t("dashboard.welcomeBase")} {loading ? t("dashboard.loadingSummary") : t("dashboard.systemNormal")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md border border-white/10 text-center min-w-[120px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-200">{t("dashboard.systemStatus")}</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span className="text-xl font-bold">100%</span>
              </div>
            </div>
          </div>
        </div>
        {/* Background Decorations */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 left-10 h-64 w-64 rounded-full bg-brand-400/10 blur-3xl" />
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-2 shadow-lg animate-in slide-in-from-top-4 duration-300">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold">{t("dashboard.connectionError")}</AlertTitle>
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {loading
          ? QUEUES.map((queue) => <StatSkeleton key={queue.key} />)
          : QUEUES.map((queue) => {
              const Icon = queue.icon;
              const count = overview?.workQueues?.[queue.key] ?? 0;
              return (
                <Card key={queue.key} className="group overflow-hidden border-none bg-card shadow-sm transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className={`h-1.5 w-full ${queue.bgColor} group-hover:opacity-100 transition-opacity`} />
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className={`rounded-xl ${queue.bgColor} p-2 ${queue.color} dark:opacity-80`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    {count > 0 && (
                      <Badge variant="secondary" className="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-none font-bold">
                        {t("dashboard.pending")}
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-tight">{queue.title}</p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-4xl font-extrabold tracking-tight tabular-nums text-foreground">
                        {count}
                      </p>
                      <span className="text-xs font-medium text-muted-foreground">{t("dashboard.itemUnit")}</span>
                    </div>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="mt-4 h-9 w-full justify-between rounded-xl px-2 font-semibold group-hover:bg-brand-50 dark:group-hover:bg-brand-900/20 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors"
                    >
                      <Link href={queue.href}>
                        {t("dashboard.reviewItems")}
                        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 overflow-hidden border-none shadow-sm rounded-3xl">
          <CardHeader className="bg-muted/30 pb-6 pt-8 px-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <Clock className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  {t("dashboard.activityTitle")}
                </CardTitle>
                <CardDescription className="text-sm font-medium">
                  {t("dashboard.activityDescription")}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl font-bold" asChild>
                <Link href="/audit">{t("dashboard.viewAll")}</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 space-y-4">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
                <Skeleton className="h-16 w-full rounded-2xl" />
              </div>
            ) : !overview?.recentActivity || overview.recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <p className="font-bold text-muted-foreground">{t("dashboard.noActivity")}</p>
                <p className="text-sm text-muted-foreground/60">{t("dashboard.noActivityDescription")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {overview.recentActivity.map((event) => (
                  <div
                    key={event.auditId}
                    className="flex items-center justify-between gap-4 p-6 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-xs shadow-sm">
                        {event.actionType.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {event.actionType}
                        </p>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {event.entityType} • {event.targetId.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold text-muted-foreground tabular-nums">
                        {new Date(event.createdAt).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground/60">
                        {new Date(event.createdAt).toLocaleDateString("th-TH")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Finance Insights */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-none shadow-sm rounded-3xl bg-gradient-to-b from-card to-muted/20 dark:from-card dark:to-muted/5">
            <CardHeader className="pb-4 pt-8 px-8">
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {t("dashboard.financeSummary")}
              </CardTitle>
              <CardDescription className="text-sm font-medium">{t("dashboard.financeDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-6">
              <div className="p-6 rounded-2xl bg-brand-50/50 border border-brand-100/50 dark:bg-brand-900/10 dark:border-brand-800/50">
                <p className="text-xs font-bold text-brand-700 dark:text-brand-400 uppercase tracking-widest">
                  {t("dashboard.createdPayments")}
                </p>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-4xl font-black text-brand-900 dark:text-brand-50 tabular-nums">
                    {overview?.stats.totalSettlementsLast30Days ?? "--"}
                  </p>
                  <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full mb-1">
                    <TrendingUp className="h-3 w-3" />
                    +12%
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-amber-50/50 border border-amber-100/50 dark:bg-amber-900/10 dark:border-amber-800/50">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                  {t("dashboard.pendingApproval")}
                </p>
                <div className="mt-2 flex items-end justify-between">
                  <p className="text-4xl font-black text-amber-900 dark:text-amber-50 tabular-nums">
                    {(overview?.stats.pendingApprovals ?? 0) +
                      (overview?.stats.pendingAdjustments ?? 0)}
                  </p>
                  <Badge variant="outline" className="mb-1 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold bg-white dark:bg-amber-950/20">
                    {t("dashboard.actionNeeded")}
                  </Badge>
                </div>
              </div>

              <Button className="w-full rounded-2xl h-12 font-bold bg-foreground text-background hover:bg-foreground/90 group transition-all" asChild>
                <Link href="/settlements">
                  {t("dashboard.manageFinance")}
                  <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Quick Support / Links */}
          <Card className="border-none shadow-sm rounded-3xl p-6 bg-brand-900 dark:bg-brand-900/20 text-white dark:text-foreground relative overflow-hidden group">
            <div className="relative z-10">
              <h3 className="font-bold text-lg mb-2">{t("dashboard.helpTitle")}</h3>
              <p className="text-brand-200 dark:text-muted-foreground text-sm mb-4">{t("dashboard.helpDescription")}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" className="rounded-xl font-bold bg-white text-brand-900 hover:bg-brand-50 dark:bg-brand-600 dark:text-white dark:hover:bg-brand-700" asChild>
                  <Link href="/docs">{t("dashboard.docs")}</Link>
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl font-bold bg-transparent border-white/20 hover:bg-white/10 text-white dark:border-border dark:text-foreground dark:hover:bg-muted" asChild>
                  <Link href="https://lin.ee/zqTz6feg" target="_blank">{t("dashboard.support")}</Link>
                </Button>
              </div>
            </div>
            <ShieldCheck className="absolute -right-4 -bottom-4 h-24 w-24 text-white/5 dark:text-brand-500/10 -rotate-12 group-hover:rotate-0 transition-transform duration-500" />
          </Card>
        </div>
      </div>
    </div>
  );
}
