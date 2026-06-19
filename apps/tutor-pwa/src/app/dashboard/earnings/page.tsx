import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Download, AlertCircle, Wallet, Star } from "lucide-react";
import { cookies } from "next/headers";
import VerificationBanner from "@/components/dashboard/verification-banner";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCurrencyCounter, AnimatedCounter } from "@/components/ui/animated-counter";
import { IDENTITY_URL } from "@/lib/service-urls";
import { Tawi50DownloadButton } from "./tawi50-download-button";
import { TransferStatusBadge } from "./transfer-status-badge";
import { SalesCsvDownloadButton } from "./sales-csv-download-button";

type EarningsHistoryItem = {
  date: string;
  payoutLineId?: string;
  direct: number;
  network: number;
  badgeBonus?: number;
  clawback: number;
  adjustments?: { amount: number; reason: string }[];
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
    adjustments?: { amount: number; reason: string }[];
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

type UserProfileResponse = {
  user?: {
    verificationStatus?: string;
    settings?: {
      taxName?: string;
      nationalId?: string;
      address?: string;
    };
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

async function getUserProfile(token: string): Promise<UserProfileResponse["user"] | null> {
  if (!token) return null;

  const res = await fetch(`${IDENTITY_URL}/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  const data = (await res.json()) as UserProfileResponse;
  return data.user ?? null;
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

export default async function EarningsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const [response, user] = await Promise.all([
    getEarningsHistoryData(token),
    getUserProfile(token),
  ]);

  const earnings = response?.currentProjection || emptyEarnings;
  const history = response?.history || [];
  const clawbacks = response?.clawbacks || [];
  const rateInfo = response?.rateInfo || emptyRateInfo;
  // Display rate to 1 decimal to match the actual backend payout rate
  // (admin console renders payoutRate with the same precision).
  const commissionPercent = Number((rateInfo.rate * 100).toFixed(2));

  // WHT for current projection — satang-precise to mirror backend calculateWithholdingTax:
  // (grossMinor * 3 + 50) / 100 with integer (floor) division, matching BigInt arithmetic.
  const projectionGross = earnings.total;
  const projectionGrossMinor = Math.round(projectionGross * 100);
  const projectionWHTMinor =
    projectionGrossMinor > 0 ? Math.floor((projectionGrossMinor * 3 + 50) / 100) : 0;
  const projectionEstimatedWHT = projectionWHTMinor / 100;
  const projectionEstimatedNet = (projectionGrossMinor - projectionWHTMinor) / 100;

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
        <SalesCsvDownloadButton
          periodMonth={response?.periodMonth || ""}
          label={t("dashboardEarnings.downloadCsv")}
          className="h-10 px-5 rounded-xl font-bold hover:bg-brand-50 dark:hover:bg-brand-900/20 hover:text-brand-600 hover:border-brand-500/30 shadow-sm transition-all gap-2 shrink-0 hidden sm:flex hover-lift press-scale"
          variant="outline"
        />
      </div>

      <div className="grid gap-6 lg:gap-8 md:grid-cols-12 stagger">
        {/* Left column */}
        <div className="md:col-span-7 animate-slide-up h-full" style={{ animationDelay: '50ms' }}>
          <Card className="h-full border border-border/40 hover:shadow-lg rounded-3xl shadow-sm bg-card bg-gradient-to-br from-card via-card to-brand-500/2 dark:to-brand-500/5 transition-all duration-300 overflow-hidden relative group">
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
                  fractionDigits={2}
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
                    fractionDigits={2}
                    className="text-lg sm:text-xl font-black text-foreground"
                  />
                </div>
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 backdrop-blur-sm p-3 sm:p-4">
                  <p className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider mb-1.5">{t("dashboardEarnings.networkBonus")}</p>
                  <div className="flex items-center text-lg sm:text-xl font-black text-brand-600 dark:text-brand-400">
                    <span>+</span>
                    <AnimatedCurrencyCounter value={earnings.networkBonus} fractionDigits={2} />
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
                    <AnimatedCurrencyCounter value={earnings.badgeBonus ?? 0} fractionDigits={2} />
                  </div>
                </div>
              )}

              {(!earnings.adjustments || earnings.adjustments.length === 0) && earnings.clawback !== 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-destructive/5 border border-destructive/15 px-4 py-3 text-sm animate-scale-in">
                  <span className="text-destructive/90 flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    {t("dashboardEarnings.clawback")}
                  </span>
                  <AnimatedCurrencyCounter
                    value={earnings.clawback}
                    fractionDigits={2}
                    className="font-bold text-destructive"
                  />
                </div>
              )}

              {earnings.adjustments && earnings.adjustments.length > 0 && earnings.adjustments.map((adj, i) => (
                <div key={`proj-adj-${i}`} className={`mt-4 flex items-center justify-between rounded-2xl ${adj.amount < 0 ? 'bg-destructive/5 border-destructive/15' : 'bg-brand-500/5 border-brand-500/20'} border px-4 py-3 text-sm animate-scale-in`}>
                  <span className={`${adj.amount < 0 ? 'text-destructive/90' : 'text-brand-600 dark:text-brand-400'} flex items-center gap-2 font-semibold`}>
                    {adj.amount < 0 ? <AlertCircle className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    {adj.reason || t("dashboardEarnings.clawback")}
                  </span>
                  <div className={`flex items-center font-bold ${adj.amount < 0 ? 'text-destructive' : 'text-brand-600 dark:text-brand-400'}`}>
                    {adj.amount > 0 ? "+" : ""}
                    <AnimatedCurrencyCounter
                      value={adj.amount}
                      fractionDigits={2}
                    />
                  </div>
                </div>
              ))}

              {/* WHT breakdown strip */}
              <div className="mt-4 rounded-2xl border border-border/30 bg-muted/30 divide-y divide-border/30 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="font-medium">{t("dashboardEarnings.grossBeforeWHT")}</span>
                  <AnimatedCurrencyCounter value={projectionGross} fractionDigits={2} className="font-semibold text-foreground" />
                </div>
                {projectionEstimatedWHT > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 text-xs text-destructive/80">
                    <span className="font-medium">{t("dashboardEarnings.withholdingTaxEstimated")}</span>
                    <span className="font-semibold flex items-center gap-0.5">
                      <span>−</span>
                      <AnimatedCurrencyCounter value={projectionEstimatedWHT} fractionDigits={2} />
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-3 bg-brand-500/5">
                  <span className="text-xs font-bold text-foreground">{t("dashboardEarnings.estimatedNetPayout")}</span>
                  <AnimatedCurrencyCounter value={projectionEstimatedNet} fractionDigits={2} className="text-sm font-black text-brand-600 dark:text-brand-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="md:col-span-5 animate-slide-up h-full" style={{ animationDelay: '100ms' }}>
          <Card className="h-full border border-border/40 hover:shadow-md rounded-3xl shadow-sm bg-card overflow-hidden transition-all duration-300 flex flex-col">
            <CardHeader className="py-4 px-5 flex flex-row items-center justify-between border-b border-border/40 shrink-0">
              <CardTitle className="text-sm font-bold text-foreground">
                {t("dashboardEarnings.payoutHistory")}
              </CardTitle>
              <SalesCsvDownloadButton
                periodMonth={response?.periodMonth || ""}
                label="CSV"
                className="h-8 gap-1 text-brand-500 hover:text-brand-600 hover:bg-brand-500/5 sm:hidden px-2 -mr-2 font-bold"
                variant="ghost"
                size="sm"
              />
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
                        fractionDigits={2}
                        className="text-xl font-black text-foreground block mb-3"
                      />

                      {/* Breakdown: accounting-style formula */}
                      <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden text-xs">
                        {/* Components */}
                        <div className="divide-y divide-border/20">
                          <div className="flex justify-between px-3 py-2 text-muted-foreground">
                            <span className="font-medium">{t("dashboardEarnings.settlementPayout")}</span>
                            <AnimatedCurrencyCounter value={item.direct} fractionDigits={2} className="font-semibold text-foreground" />
                          </div>
                          {item.network !== 0 && (
                            <div className="flex justify-between px-3 py-2 text-muted-foreground">
                              <span className="font-medium">{t("dashboardEarnings.networkBonus")}</span>
                              <span className="font-bold text-brand-600 dark:text-brand-400 flex items-center gap-0.5">
                                +<AnimatedCurrencyCounter value={item.network} fractionDigits={2} />
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
                                +<AnimatedCurrencyCounter value={item.badgeBonus ?? 0} fractionDigits={2} />
                              </span>
                            </div>
                          )}
                          {(!item.adjustments || item.adjustments.length === 0) && item.clawback !== 0 && (
                            <div className="flex justify-between px-3 py-2 text-destructive/80">
                              <span className="font-medium flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {t("dashboardEarnings.clawback")}
                              </span>
                              <AnimatedCurrencyCounter value={item.clawback} fractionDigits={2} className="font-bold text-destructive" />
                            </div>
                          )}
                          {item.adjustments && item.adjustments.length > 0 && item.adjustments.map((adj, i) => (
                            <div key={`adj-${i}`} className={`flex justify-between px-3 py-2 ${adj.amount < 0 ? 'text-destructive/80' : 'text-brand-600/80 dark:text-brand-400/80'}`}>
                              <span className="font-medium flex items-center gap-1">
                                {adj.amount < 0 ? <AlertCircle className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                                {adj.reason || t("dashboardEarnings.clawback")}
                              </span>
                              <span className={`font-bold flex items-center gap-0.5 ${adj.amount < 0 ? 'text-destructive' : 'text-brand-600 dark:text-brand-400'}`}>
                                {adj.amount > 0 ? "+" : ""}
                                <AnimatedCurrencyCounter value={adj.amount} fractionDigits={2} />
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Gross subtotal */}
                        <div className="flex justify-between px-3 py-2 bg-muted/40 border-t border-border/40 text-muted-foreground">
                          <span className="font-semibold">{t("dashboardEarnings.grossBeforeWHT")}</span>
                          <AnimatedCurrencyCounter
                            value={item.direct + item.network + (item.badgeBonus ?? 0) + item.clawback}
                            fractionDigits={2}
                            className="font-bold text-foreground"
                          />
                        </div>
                        {/* WHT */}
                        {item.withholdingTax !== undefined && item.withholdingTax > 0 && (
                          <div className="flex justify-between px-3 py-2 border-t border-border/40 text-destructive/80">
                            <span className="font-medium">{t("dashboardEarnings.withholdingTax")}</span>
                            <span className="font-semibold flex items-center gap-0.5">
                              −<AnimatedCurrencyCounter value={item.withholdingTax} fractionDigits={2} />
                            </span>
                          </div>
                        )}
                        {/* Net payout — highlighted */}
                        {item.netPayout !== undefined && (
                          <div className="flex justify-between px-3 py-2.5 bg-brand-500/5 border-t-2 border-brand-500/20">
                            <span className="font-black text-foreground">{t("dashboardEarnings.netPayout")}</span>
                            <AnimatedCurrencyCounter value={item.netPayout} fractionDigits={2} className="font-black text-brand-600 dark:text-brand-400" />
                          </div>
                        )}
                      </div>
                      {item.payoutDocument?.transferStatus && item.payoutLineId && (
                        <TransferStatusBadge
                          payoutLineId={item.payoutLineId}
                          initialStatus={item.payoutDocument.transferStatus}
                          initialTransferredAt={item.payoutDocument.transferredAt}
                        />
                      )}
                      {item.payoutDocument && (
                        <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
                          <div className="text-[10px] font-bold text-muted-foreground/60 tracking-wider">
                            {t("dashboardEarnings.documentPrefix")} {item.payoutDocument.documentNumber}
                          </div>
                          {item.status === "approved" && (item.withholdingTax ?? 0) > 0 && (
                            <Tawi50DownloadButton
                              href={`/api/documents/tawi50?documentNumber=${encodeURIComponent(item.payoutDocument.documentNumber)}&gross=${Math.round(item.direct + item.network + (item.badgeBonus ?? 0) + item.clawback)}&wht=${Math.round(item.withholdingTax ?? 0)}&net=${Math.round(item.netPayout ?? 0)}&period=${encodeURIComponent(item.date)}&issuedAt=${encodeURIComponent(item.payoutDocument.issuedAt ?? "")}&paidDate=${encodeURIComponent(item.payoutDocument.transferredAt ?? "")}`}
                              filename={`tawi50-${item.payoutDocument.documentNumber}.pdf`}
                              settings={user?.settings ?? null}
                              isVerified={user?.verificationStatus === "VERIFIED"}
                            />
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

        {/* Bottom row: Current Commission */}
        <div className="md:col-span-12 animate-slide-up" style={{ animationDelay: '150ms' }}>
          <Card className="border border-brand-500/20 bg-gradient-to-br from-brand-500/5 via-card to-card hover:shadow-lg rounded-3xl shadow-sm transition-all duration-300 overflow-hidden relative">
            <CardHeader className="pb-3 pt-5 px-5 sm:px-6">
              <CardTitle className="text-sm font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500 animate-float" />
                  {t("dashboardEarnings.currentCommission")}
                </span>
                <span className="text-xl font-black text-brand-500">
                  <AnimatedCounter value={commissionPercent} fractionDigits={2} />%
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
      </div>


    </PageTransition>
  );
}
