"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Link2Off,
  RefreshCw,
  Search,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";
import { t } from "@/lib/i18n";

interface ReconciliationIssue {
  type: string;
  severity: string;
  description: string;
}

interface PaymentItem {
  paymentIntentId: string;
  enrollmentId: string;
  enrollmentPackageId: string | null;
  studentUserId: string;
  studentName: string;
  amountMinor: number | null;
  currency: string;
  method: string;
  status: string;
  providerRef: string | null;
  receiptStatus: string | null;
  createdAt: string;
  updatedAt: string;
  enrollmentStatus: string | null;
  packageStatus: string | null;
  classTitle: string | null;
  lastEventType: string | null;
  lastEventAt: string | null;
  issue: ReconciliationIssue;
}

interface OrphanEvent {
  paymentEventId: string;
  providerEventId: string | null;
  eventType: string;
  occurredAt: string;
  createdAt: string;
}

interface ActiveWithoutPayment {
  enrollmentId: string;
  studentUserId: string;
  classId: string;
  status: string;
  paymentTransactionId: string | null;
  updatedAt: string;
}

interface ReconciliationData {
  summary: {
    daysBack: number;
    totalPayments: number;
    successfulPayments: number;
    pendingPayments: number;
    failedPayments: number;
    successVolumeMinor: number;
    issueCount: number;
    orphanEventCount: number;
    activeWithoutPaymentCount: number;
    issueCounts: Record<string, number>;
  };
  payments: PaymentItem[];
  orphanEvents: OrphanEvent[];
  activeWithoutPayment: ActiveWithoutPayment[];
}

function formatMoney(amountMinor: number | null | undefined, currency = "THB") {
  if (amountMinor == null) return "-";
  return `${(amountMinor / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH");
}

function statusClass(status: string | null) {
  switch (status) {
    case "SUCCESS":
    case "ACTIVE":
    case "ISSUED":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "FAILED":
    case "CANCELLED":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function severityClass(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-600 text-white";
    case "HIGH":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    case "MEDIUM":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    default:
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
}

function shortId(value: string | null | undefined) {
  if (!value) return "-";
  return value.length > 16 ? `${value.slice(0, 12)}...` : value;
}

function MetricValue({ loading, children }: { loading: boolean; children: ReactNode }) {
  if (loading) return <Skeleton className="mt-4 h-10 w-32 rounded-xl" />;
  return <p className="mt-4 text-4xl font-black">{children}</p>;
}

function PanelSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}

export default function PaymentReconciliationPage() {
  const [data, setData] = useState<ReconciliationData | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: "30" });
      if (debouncedSearch.trim()) params.set("q", debouncedSearch.trim());
      const response = await fetchWithAuth(
        `/v1/reconciliation/payments?${params.toString()}`,
      );
      setData(response);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("reconciliation.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const issuePayments = useMemo(
    () => (data?.payments ?? []).filter((item) => item.issue.type !== "OK"),
    [data],
  );
  const healthyPayments = useMemo(
    () => (data?.payments ?? []).filter((item) => item.issue.type === "OK"),
    [data],
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            {t("reconciliation.title")}
          </h2>
          <p className="text-muted-foreground font-medium">
            {t("reconciliation.description")}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadData}
          disabled={loading}
          className="rounded-full font-bold shadow-sm h-12 px-6"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("reconciliation.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-none shadow-sm rounded-3xl bg-emerald-500/10 overflow-hidden">
          <CardContent className="p-7">
            <p className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
              <WalletCards className="h-4 w-4" />
              {t("reconciliation.successVolume")}
            </p>
            <div className="text-emerald-900 dark:text-emerald-50">
              <MetricValue loading={loading && !data}>
                {formatMoney(data?.summary.successVolumeMinor ?? 0)}
              </MetricValue>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-amber-500/10 overflow-hidden">
          <CardContent className="p-7">
            <p className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
              <Clock3 className="h-4 w-4" />
              {t("reconciliation.pending")}
            </p>
            <div className="text-amber-900 dark:text-amber-50">
              <MetricValue loading={loading && !data}>
                {data?.summary.pendingPayments ?? 0}
              </MetricValue>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-red-500/10 overflow-hidden">
          <CardContent className="p-7">
            <p className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-widest">
              <ShieldAlert className="h-4 w-4" />
              {t("reconciliation.actionNeeded")}
            </p>
            <div className="text-red-900 dark:text-red-50">
              <MetricValue loading={loading && !data}>
                {data?.summary.issueCount ?? 0}
              </MetricValue>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl bg-blue-500/10 overflow-hidden">
          <CardContent className="p-7">
            <p className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              <CreditCard className="h-4 w-4" />
              {t("reconciliation.totalPayments")}
            </p>
            <div className="text-blue-900 dark:text-blue-50">
              <MetricValue loading={loading && !data}>
                {data?.summary.totalPayments ?? 0}
              </MetricValue>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b px-8 py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {t("reconciliation.queueTitle")}
                  <Badge className="bg-red-500 text-white border-none">
                    {issuePayments.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="font-medium text-xs">
                  {t("reconciliation.queueDescription").replace(
                    "{days}",
                    String(data?.summary.daysBack ?? 30),
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="relative w-full max-w-md group">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") loadData();
                }}
                placeholder={t("reconciliation.searchPlaceholder")}
                className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-brand-500 font-medium bg-background"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-2xl" />
              <Skeleton className="h-36 w-full rounded-2xl" />
            </div>
          ) : issuePayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <CheckCircle2 className="h-12 w-12 text-emerald-500/50 mb-4" />
              <p className="font-bold text-muted-foreground">{t("reconciliation.noMismatchesTitle")}</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {t("reconciliation.noMismatchesDescription")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {issuePayments.map((item) => (
                <div
                  key={item.paymentIntentId}
                  className="rounded-2xl border border-border/60 bg-card p-6 transition-all hover:shadow-md hover:border-red-500/30"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`border-none font-bold ${severityClass(item.issue.severity)}`}>
                          {item.issue.severity}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.issue.type}
                        </Badge>
                        <Badge className={`border-none font-bold ${statusClass(item.status)}`}>
                          {item.status}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground ml-auto">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>

                      <div>
                        <p className="text-lg font-bold text-foreground">{item.studentName}</p>
                        <p className="text-sm text-muted-foreground">{item.classTitle ?? t("reconciliation.unknownClass")}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-5 bg-muted/30 p-4 rounded-xl border border-border/50">
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t("reconciliation.amount")}
                          </p>
                          <p className="font-black">{formatMoney(item.amountMinor, item.currency)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t("reconciliation.method")}
                          </p>
                          <p className="font-bold uppercase">{item.method}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t("reconciliation.enrollment")}
                          </p>
                          <Badge className={`border-none ${statusClass(item.enrollmentStatus)}`}>
                            {item.enrollmentStatus ?? "-"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t("reconciliation.package")}
                          </p>
                          <Badge className={`border-none ${statusClass(item.packageStatus)}`}>
                            {item.packageStatus ?? "-"}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {t("reconciliation.receipt")}
                          </p>
                          <Badge className={`border-none ${statusClass(item.receiptStatus)}`}>
                            {item.receiptStatus ?? "-"}
                          </Badge>
                        </div>
                      </div>

                      <p className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 text-sm font-medium text-red-800 dark:text-red-300">
                        {item.issue.description}
                      </p>
                    </div>

                    <div className="w-full xl:w-80 rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3 text-xs">
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest">{t("reconciliation.paymentId")}</p>
                        <p className="font-mono break-all">{item.paymentIntentId}</p>
                      </div>
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest">{t("reconciliation.enrollmentId")}</p>
                        <p className="font-mono break-all">{item.enrollmentPackageId ?? item.enrollmentId}</p>
                      </div>
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest">{t("reconciliation.providerRef")}</p>
                        <p className="font-mono break-all">{item.providerRef ?? "-"}</p>
                      </div>
                      <div>
                        <p className="font-bold text-muted-foreground uppercase tracking-widest">{t("reconciliation.lastEvent")}</p>
                        <p className="font-mono">{item.lastEventType ?? "-"}</p>
                        <p className="text-muted-foreground">{formatDate(item.lastEventAt)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-muted/20 border-b px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400">
                <Link2Off className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{t("reconciliation.unmappedWebhooksTitle")}</CardTitle>
                <CardDescription className="font-medium text-xs">
                  {t("reconciliation.unmappedWebhooksDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-3">
            {loading && !data ? (
              <PanelSkeleton />
            ) : (data?.orphanEvents.length ?? 0) === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">{t("reconciliation.noUnmappedWebhooks")}</p>
            ) : null}
            {!loading && (data?.orphanEvents ?? []).map((event) => (
              <div key={event.paymentEventId} className="rounded-2xl border border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {event.eventType}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(event.occurredAt)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground break-all">
                  {t("reconciliation.provider")}: {event.providerEventId ?? "-"}
                </p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {t("reconciliation.event")}: {shortId(event.paymentEventId)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-muted/20 border-b px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">{t("reconciliation.activeWithoutPaymentTitle")}</CardTitle>
                <CardDescription className="font-medium text-xs">
                  {t("reconciliation.activeWithoutPaymentDescription")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-3">
            {loading && !data ? (
              <PanelSkeleton />
            ) : (data?.activeWithoutPayment.length ?? 0) === 0 ? (
              <p className="text-sm font-medium text-muted-foreground">{t("reconciliation.noActiveGaps")}</p>
            ) : null}
            {!loading && (data?.activeWithoutPayment ?? []).map((item) => (
              <div key={item.enrollmentId} className="rounded-2xl border border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border-none ${statusClass(item.status)}`}>{item.status}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDate(item.updatedAt)}
                  </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground break-all">
                  {t("reconciliation.enrollment")}: {item.enrollmentId}
                </p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {t("reconciliation.student")}: {item.studentUserId}
                </p>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {t("reconciliation.paymentRef")}: {item.paymentTransactionId ?? "-"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b px-8 py-6">
          <CardTitle className="text-lg font-bold">{t("reconciliation.alignedTitle")}</CardTitle>
          <CardDescription className="font-medium text-xs">
            {t("reconciliation.alignedDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {loading && !data ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          ) : healthyPayments.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground">{t("reconciliation.noAlignedPayments")}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {healthyPayments.slice(0, 10).map((item) => (
              <div key={item.paymentIntentId} className="rounded-2xl border border-border/60 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`border-none ${statusClass(item.status)}`}>{item.status}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">{shortId(item.paymentIntentId)}</Badge>
                  <span className="text-xs font-bold ml-auto">{formatMoney(item.amountMinor, item.currency)}</span>
                </div>
                <p className="mt-2 font-bold truncate">{item.studentName}</p>
                <p className="text-xs text-muted-foreground truncate">{item.classTitle ?? t("reconciliation.unknownClass")}</p>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
