import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileDown, AlertCircle, Wallet, Star, BanknoteIcon, Clock, CheckCircle2, XCircle, Send } from "lucide-react";
import { cookies } from "next/headers";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCurrencyCounter, AnimatedCounter } from "@/components/ui/animated-counter";

type EarningsHistoryItem = {
  date: string;
  direct: number;
  network: number;
  badgeBonus?: number;
  clawback: number;
  withholdingTax?: number;
  netPayout?: number;
  payoutDocument?: {
    documentNumber: string;
    documentType: string;
    status: string;
    issuedAt: string;
    transferStatus?: string;
    transferredAt?: string | null;
  } | null;
  status: string;
};

type ClawbackItem = {
  date: string;
  amount: number;
  reason: string;
};

type EarningsResponse = {
  periodMonth: string;
  currentProjection: {
    directSales: number;
    networkBonus: number;
    badgeBonus?: number;
    clawback: number;
    total: number;
  };
  history: EarningsHistoryItem[];
  clawbacks: ClawbackItem[];
  rateInfo: {
    rate: number;
    volume: number;
    nextTarget: number;
  };
};

async function getEarningsHistoryData(token: string): Promise<EarningsResponse | null> {
  if (!token) return null;

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  const res = await fetch(`${baseUrl}/v1/tutors/earnings/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

const statusMap: Record<string, { label: string; className: string }> = {
  draft: {
    label: t("dashboardEarnings.statuses.draft"),
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: t("dashboardEarnings.statuses.pending"),
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  approved: {
    label: t("dashboardEarnings.statuses.approved"),
    className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
  },
  rejected: {
    label: t("dashboardEarnings.statuses.rejected"),
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const emptyEarnings: EarningsResponse["currentProjection"] = {
  directSales: 0,
  networkBonus: 0,
  badgeBonus: 0,
  clawback: 0,
  total: 0,
};

const emptyRateInfo: EarningsResponse["rateInfo"] = {
  rate: 0,
  volume: 0,
  nextTarget: 0,
};

function formatCurrencyTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

type TransferStatusConfig = {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
};

const transferStatusConfig: Record<string, TransferStatusConfig> = {
  PAID: {
    label: t("dashboardEarnings.transferStatuses.PAID"),
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    Icon: CheckCircle2,
  },
  SENT: {
    label: t("dashboardEarnings.transferStatuses.SENT"),
    className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    Icon: BanknoteIcon,
  },
  SENT_PENDING: {
    label: t("dashboardEarnings.transferStatuses.SENT_PENDING"),
    className: "bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/20",
    Icon: Send,
  },
  CREATED: {
    label: t("dashboardEarnings.transferStatuses.CREATED"),
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Icon: Clock,
  },
  PENDING_TRANSFER: {
    label: t("dashboardEarnings.transferStatuses.PENDING_TRANSFER"),
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Icon: Clock,
  },
  NOT_SENT: {
    label: t("dashboardEarnings.transferStatuses.NOT_SENT"),
    className: "bg-muted text-muted-foreground border-border",
    Icon: Clock,
  },
  TRANSFER_FAILED: {
    label: t("dashboardEarnings.transferStatuses.TRANSFER_FAILED"),
    className: "bg-destructive/10 text-destructive border-destructive/20",
    Icon: XCircle,
  },
  NO_TRANSFER_REQUIRED: {
    label: t("dashboardEarnings.transferStatuses.NO_TRANSFER_REQUIRED"),
    className: "bg-muted text-muted-foreground border-border",
    Icon: CheckCircle2,
  },
};

export default async function EarningsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getEarningsHistoryData(token);

  const earnings = response?.currentProjection || emptyEarnings;
  const history = response?.history || [];
  const clawbacks = response?.clawbacks || [];
  const rateInfo = response?.rateInfo || emptyRateInfo;
  const commissionPercent = Math.round(rateInfo.rate * 100);

  // Estimated WHT for current projection (3%, rounded)
  const projectionGross = earnings.total;
  const projectionEstimatedWHT = projectionGross > 0 ? Math.round(projectionGross * 0.03) : 0;
  const projectionEstimatedNet = projectionGross - projectionEstimatedWHT;

  const progressPercent = Math.min(
    100,
    rateInfo.nextTarget > 0
      ? Math.round((rateInfo.volume / rateInfo.nextTarget) * 100)
      : 100,
  );

  return (
    <PageTransition variant="slide-up" stagger className="max-w-3xl mx-auto space-y-6 lg:space-y-8 pb-24 sm:pb-12">
      <VerificationBanner />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardEarnings.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardEarnings.subtitle")}
          </p>
        </div>
        <Button
          id="btn-download-reports"
          variant="outline"
          className="h-10 px-5 rounded-xl font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 hover:border-brand-500/30 shadow-sm transition-all gap-2 shrink-0 hidden sm:flex hover-lift press-scale"
        >
          <Download className="h-4 w-4" />
          {t("dashboardEarnings.downloadCsv")}
        </Button>
      </div>

      <div className="grid gap-6 lg:gap-8 md:grid-cols-12 stagger">
        {/* Left column */}
        <div className="md:col-span-7 space-y-6 lg:space-y-8 animate-slide-up" style={{ animationDelay: '50ms' }}>
          <Card className="border border-border/40 hover:shadow-lg rounded-3xl shadow-sm bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 transition-all duration-300 overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-44 h-44 bg-brand-500/10 dark:bg-brand-500/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
            <CardContent className="p-5 sm:p-6 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-sm font-bold text-foreground">
                  {t("dashboardEarnings.projectedIncomePrefix")} ({response?.periodMonth || "N/A"})
                </h2>
              </div>
              
              <div className="flex items-baseline gap-2 mb-1">
                <AnimatedCurrencyCounter
                  value={projectionEstimatedNet}
                  className="text-4xl lg:text-5xl font-black tracking-tight text-foreground"
                />
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded-md">THB</span>
              </div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-5">
                {t("dashboardEarnings.estimatedNetPayout")} · {t("dashboardEarnings.projectionWHTNote")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border/40 bg-background/50 backdrop-blur-sm p-3 sm:p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{t("dashboardEarnings.directCommission")}</p>
                  <AnimatedCurrencyCounter
                    value={earnings.directSales}
                    className="text-lg sm:text-xl font-black text-foreground"
                  />
                </div>
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 backdrop-blur-sm p-3 sm:p-4">
                  <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1.5">{t("dashboardEarnings.networkBonus")}</p>
                  <div className="flex items-center text-lg sm:text-xl font-black text-brand-600 dark:text-brand-400">
                    <span>+</span>
                    <AnimatedCurrencyCounter value={earnings.networkBonus} />
                  </div>
                </div>
              </div>

              {(earnings.badgeBonus ?? 0) > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm px-4 py-3 animate-scale-in">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    {t("dashboardEarnings.badgeBonus")}
                  </span>
                  <div className="flex items-center text-lg font-black text-amber-600 dark:text-amber-400">
                    <span>+</span>
                    <AnimatedCurrencyCounter value={earnings.badgeBonus ?? 0} />
                  </div>
                </div>
              )}

              {earnings.clawback !== 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-destructive/5 border border-destructive/15 px-4 py-3 text-sm animate-scale-in">
                  <span className="text-destructive/90 flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t("dashboardEarnings.clawback")}</span>
                  </span>
                  <AnimatedCurrencyCounter
                    value={earnings.clawback}
                    className="font-black text-destructive"
                  />
                </div>
              )}

              {/* WHT breakdown strip */}
              <div className="mt-4 rounded-2xl border border-border/30 bg-muted/30 divide-y divide-border/30 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium">{t("dashboardEarnings.grossBeforeWHT")}</span>
                  <AnimatedCurrencyCounter value={projectionGross} className="font-semibold text-foreground" />
                </div>
                {projectionEstimatedWHT > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 text-xs text-destructive/80">
                    <span className="font-medium">{t("dashboardEarnings.withholdingTaxEstimated")}</span>
                    <span className="font-semibold flex items-center gap-0.5">
                      <span>−</span>
                      <AnimatedCurrencyCounter value={projectionEstimatedWHT} />
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 bg-brand-500/5">
                  <span className="text-xs font-bold text-foreground">{t("dashboardEarnings.estimatedNetPayout")}</span>
                  <AnimatedCurrencyCounter value={projectionEstimatedNet} className="text-sm font-black text-brand-600 dark:text-brand-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-brand-500/20 bg-gradient-to-br from-brand-500/5 via-card to-card hover:shadow-lg rounded-3xl shadow-sm transition-all duration-300 overflow-hidden relative">
            <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
              <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-float" />
                  {t("dashboardEarnings.currentCommission")}
                </span>
                <span className="text-xl font-black text-brand-500">
                  <AnimatedCounter value={commissionPercent} />%
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-5 sm:pb-6 px-5 sm:px-6">
              <div className="space-y-2.5">
                <div className="flex justify-between text-xs font-bold text-muted-foreground">
                  <AnimatedCurrencyCounter value={rateInfo.volume} className="text-foreground" />
                  <span>
                    {rateInfo.nextTarget > 0
                      ? `${t("dashboardEarnings.rateTargetPrefix")} ${formatCurrencyTHB(rateInfo.nextTarget)} ${t("dashboardEarnings.rateTargetSuffix")}`
                      : t("dashboardEarnings.maxRate")}
                  </span>
                </div>
                <div className="w-full bg-brand-500/10 rounded-full h-3 overflow-hidden border border-brand-500/5 p-[1px]">
                  <div
                    className="bg-gradient-to-r from-brand-400 to-brand-600 h-2 rounded-full transition-all duration-1000 ease-out relative shadow-[0_0_8px_rgba(6,199,85,0.4)]"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="md:col-span-5 space-y-6 lg:space-y-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <Card className="border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card overflow-hidden transition-all duration-300">
            <CardHeader className="py-4 px-5 flex flex-row items-center justify-between border-b border-border/40">
              <CardTitle className="text-sm font-bold text-foreground">
                {t("dashboardEarnings.payoutHistory")}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-brand-500 hover:text-brand-600 hover:bg-brand-500/5 sm:hidden px-2 -mr-2 font-bold"
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {history.length === 0 && (
                  <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
                    {t("dashboardEarnings.emptyPayoutHistory")}
                  </div>
                )}
                {history.map((item, idx) => {
                  // Use netPayout (post-WHT, includes all adjustments) when available.
                  // Fallback to gross sum only for legacy records without netPayout.
                  const total = item.netPayout !== undefined ? item.netPayout : item.direct + item.network + item.clawback;
                  const status = statusMap[item.status] || {
                    label: item.status,
                    className: "bg-muted",
                  };
                  return (
                    <div key={`${item.date}-${item.status}`} className="p-4 sm:p-5 hover:bg-brand-500/2 dark:hover:bg-brand-500/4 transition-colors relative group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-brand-500 transition-all duration-300" />
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-foreground">{item.date}</p>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <AnimatedCurrencyCounter
                        value={total}
                        className="text-xl font-black text-foreground block mb-3"
                      />

                      {/* Breakdown: accounting-style formula */}
                      <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden text-xs">
                        {/* Components */}
                        <div className="divide-y divide-border/20">
                          <div className="flex justify-between px-3 py-2 text-muted-foreground">
                            <span className="font-medium">{t("dashboardEarnings.settlementPayout")}</span>
                            <AnimatedCurrencyCounter value={item.direct} className="font-semibold text-foreground" />
                          </div>
                          {item.network !== 0 && (
                            <div className="flex justify-between px-3 py-2 text-muted-foreground">
                              <span className="font-medium">{t("dashboardEarnings.networkBonus")}</span>
                              <span className="font-bold text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
                                +<AnimatedCurrencyCounter value={item.network} />
                              </span>
                            </div>
                          )}
                          {(item.badgeBonus ?? 0) !== 0 && (
                            <div className="flex justify-between px-3 py-2 text-muted-foreground">
                              <span className="font-medium flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-400" />
                                {t("dashboardEarnings.badgeBonus")}
                              </span>
                              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                +<AnimatedCurrencyCounter value={item.badgeBonus ?? 0} />
                              </span>
                            </div>
                          )}
                          {item.clawback !== 0 && (
                            <div className="flex justify-between px-3 py-2 text-destructive/80">
                              <span className="font-medium flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {t("dashboardEarnings.clawback")}
                              </span>
                              <AnimatedCurrencyCounter value={item.clawback} className="font-bold text-destructive" />
                            </div>
                          )}
                        </div>
                        {/* Gross subtotal */}
                        <div className="flex justify-between px-3 py-2 bg-muted/40 border-t border-border/40 text-muted-foreground">
                          <span className="font-semibold">{t("dashboardEarnings.grossBeforeWHT")}</span>
                          <AnimatedCurrencyCounter
                            value={item.direct + item.network + (item.badgeBonus ?? 0) + item.clawback}
                            className="font-bold text-foreground"
                          />
                        </div>
                        {/* WHT */}
                        {item.withholdingTax !== undefined && item.withholdingTax > 0 && (
                          <div className="flex justify-between px-3 py-2 border-t border-border/40 text-destructive/80">
                            <span className="font-medium">{t("dashboardEarnings.withholdingTax")}</span>
                            <span className="font-semibold flex items-center gap-0.5">
                              −<AnimatedCurrencyCounter value={item.withholdingTax} />
                            </span>
                          </div>
                        )}
                        {/* Net payout — highlighted */}
                        {item.netPayout !== undefined && (
                          <div className="flex justify-between px-3 py-2.5 bg-brand-500/5 border-t-2 border-brand-500/20">
                            <span className="font-black text-foreground">{t("dashboardEarnings.netPayout")}</span>
                            <AnimatedCurrencyCounter value={item.netPayout} className="font-black text-brand-600 dark:text-brand-400" />
                          </div>
                        )}
                      </div>
                      {item.payoutDocument?.transferStatus && (() => {
                        const ts = item.payoutDocument.transferStatus!;
                        const cfg = transferStatusConfig[ts];
                        if (!cfg) return null;
                        const Icon = cfg.Icon;
                        return (
                          <div className={`mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold w-fit ${cfg.className}`}>
                            <Icon className="h-3 w-3 shrink-0" />
                            {cfg.label}
                            {ts === "PAID" && item.payoutDocument.transferredAt && (
                              <span className="opacity-60 font-medium">
                                · {new Date(item.payoutDocument.transferredAt).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {item.payoutDocument && (
                        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                          <div className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">
                            {t("dashboardEarnings.documentPrefix")} {item.payoutDocument.documentNumber}
                          </div>
                          {item.status === "approved" && (item.withholdingTax ?? 0) > 0 && (
                            <a
                              href={`/api/documents/tawi50?documentNumber=${encodeURIComponent(item.payoutDocument.documentNumber)}&gross=${Math.round(item.direct + item.network + (item.badgeBonus ?? 0) + item.clawback)}&wht=${Math.round(item.withholdingTax ?? 0)}&net=${Math.round(item.netPayout ?? 0)}&period=${encodeURIComponent(item.date)}&issuedAt=${encodeURIComponent(item.payoutDocument.issuedAt ?? "")}&paidDate=${encodeURIComponent(item.payoutDocument.transferredAt ?? "")}`}
                              download={`tawi50-${item.payoutDocument.documentNumber}.pdf`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 text-[10px] font-bold transition-colors border border-brand-500/20 hover:border-brand-500/40 press-scale"
                            >
                              <FileDown className="h-3 w-3" />
                              {t("dashboardEarnings.downloadTawi50")}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {clawbacks.length > 0 && (
        <Card className="border border-destructive/20 bg-destructive/5 rounded-3xl shadow-sm overflow-hidden animate-scale-in">
          <CardHeader className="pb-3 px-5 sm:px-6">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
              {t("dashboardEarnings.clawbackDetails")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6">
            <div className="divide-y divide-border/30 -mx-6 px-6 sm:mx-0 sm:px-0">
              {clawbacks.map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="flex items-start justify-between py-3 gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground leading-tight">{item.reason}</p>
                    <p className="text-[11px] font-semibold text-muted-foreground">{t("dashboardEarnings.billingPeriodPrefix")} {item.date}</p>
                  </div>
                  <AnimatedCurrencyCounter
                    value={item.amount}
                    className="text-sm font-black text-destructive shrink-0 bg-destructive/10 px-2.5 py-1 rounded-lg"
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground/60 mt-4 leading-relaxed">
              {t("dashboardEarnings.clawbackNote")}
            </p>
          </CardContent>
        </Card>
      )}
    </PageTransition>
  );
}
