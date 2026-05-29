import { cookies } from "next/headers";
import {
  ArrowUpRight,
  GitBranch,
  TrendingUp,
  UserRoundCheck,
  Users,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLinkCard } from "./invite-link-card";
import { InteractiveNetwork } from "./interactive-network";
import { t } from "@/lib/i18n";
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCounter, AnimatedCurrencyCounter } from "@/components/ui/animated-counter";

type TutorSummary = {
  userId: string;
  displayName: string;
  email: string | null;
  sponsorLockedAt: string | null;
  joinedAt: string;
  personalVolumeTHB: number;
  groupVolumeTHB: number;
  currentRate: number;
  estimatedPayoutTHB: number;
  totalDownlines?: number;
};

type NetworkTreeNode = TutorSummary & {
  children: NetworkTreeNode[];
};

type NetworkResponse = {
  periodMonth: string;
  inviteUrl: string;
  sponsor: TutorSummary | null;
  upline: TutorSummary[];
  networkTree: NetworkTreeNode;
  summary: {
    directDownlines: number;
    totalDownlines: number;
    activeDownlines: number;
    personalVolumeTHB: number;
    groupVolumeTHB: number;
    currentRate: number;
    estimatedPayoutTHB: number;
    badgeBonusTHB?: number;
    level1Count: number;
    level2PlusCount: number;
  };
  downlines: TutorSummary[];
};

async function getNetworkData(token: string): Promise<NetworkResponse | null> {
  if (!token) return null;

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003";
  const res = await fetch(`${baseUrl}/v1/tutors/network`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

function formatCurrencyTHB(value: number) {
  return value.toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const emptySummary: NetworkResponse["summary"] = {
  directDownlines: 0,
  totalDownlines: 0,
  activeDownlines: 0,
  personalVolumeTHB: 0,
  groupVolumeTHB: 0,
  currentRate: 0,
  estimatedPayoutTHB: 0,
  badgeBonusTHB: 0,
  level1Count: 0,
  level2PlusCount: 0,
};

export default async function NetworkPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const response = await getNetworkData(token);
  const summary = response?.summary || emptySummary;
  const commissionPercent = Number((summary.currentRate * 100).toFixed(2));
  const networkEstimatedWHT = summary.estimatedPayoutTHB > 0
    ? Math.round(summary.estimatedPayoutTHB * 0.03)
    : 0;
  const networkEstimatedNet = summary.estimatedPayoutTHB - networkEstimatedWHT;

  return (
    <PageTransition variant="slide-up" stagger className="max-w-5xl mx-auto space-y-6 lg:space-y-8 pb-24 sm:pb-12">
      <div className="flex flex-col gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{t("dashboardNetwork.title")}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            {t("dashboardNetwork.subtitlePrefix")}{" "}
            {response?.periodMonth || "-"}
          </p>
        </div>
        {response?.inviteUrl ? (
          <InviteLinkCard inviteUrl={response.inviteUrl} />
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 stagger">
        <MetricCard
          icon={Users}
          label={t("dashboardNetwork.direct")}
          value={summary.directDownlines}
          delay={50}
        />
        <MetricCard
          icon={GitBranch}
          label={t("dashboardNetwork.totalNetwork")}
          value={summary.totalDownlines}
          delay={100}
        />
        <MetricCard
          icon={UserRoundCheck}
          label={t("dashboardNetwork.activeThisMonth")}
          value={summary.activeDownlines}
          delay={150}
        />
        <MetricCard
          icon={TrendingUp}
          label={t("dashboardNetwork.currentRate")}
          value={commissionPercent}
          isPercent
          delay={200}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12 stagger">
        <div className="lg:col-span-8 flex flex-col animate-slide-up" style={{ animationDelay: '250ms' }}>
          <Card className="border border-border/40 hover:shadow-lg rounded-3xl shadow-sm bg-card bg-gradient-to-br from-card via-card to-brand-500/1 dark:to-brand-500/3 transition-all duration-300 overflow-hidden h-full flex flex-col justify-center">
            <CardHeader className="py-4 px-5 border-b border-border/30">
              <CardTitle className="text-sm font-bold text-foreground">
                {t("dashboardNetwork.volumeAndPayout")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 p-5 items-stretch">
              <AmountBlock label={t("dashboardNetwork.personalVolume")} value={summary.personalVolumeTHB} />
              <AmountBlock label={t("dashboardNetwork.groupVolume")} value={summary.groupVolumeTHB} />
              <AmountBlock
                label={t("dashboardNetwork.estimatedPayout")}
                value={summary.estimatedPayoutTHB}
                badgeBonusTHB={summary.badgeBonusTHB}
                estimatedWHT={networkEstimatedWHT}
                estimatedNet={networkEstimatedNet}
                isPayout
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Narrower Right Column inside Grid, Combined Card */}
        <div className="lg:col-span-4 flex flex-col animate-slide-up" style={{ animationDelay: '300ms' }}>
          <Card className="border border-border/40 hover:shadow-lg rounded-3xl shadow-sm bg-card h-full flex flex-col divide-y divide-border/30 overflow-hidden transition-all duration-300">
            {/* Section 1: Sponsor */}
            <div className="p-5 hover:bg-brand-500/2 transition-colors">
              <h3 className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t("dashboardNetwork.sponsor")}</h3>
              {response?.sponsor ? (
                <TutorLine tutor={response.sponsor} />
              ) : (
                <p className="text-xs font-semibold text-muted-foreground/60">{t("dashboardNetwork.noSponsor")}</p>
              )}
            </div>

            {/* Section 2: Upline */}
            <div className="p-5 flex-1 flex flex-col min-h-0 hover:bg-brand-500/2 transition-colors">
              <h3 className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">Upline</h3>
              <div className="space-y-3 overflow-y-auto max-h-[140px] flex-1 pr-1 scrollbar-thin">
                {response?.upline?.length ? (
                  response.upline.map((tutor, index) => (
                    <div key={tutor.userId} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/10 text-[10px] font-black text-brand-600 dark:text-brand-400">
                        {index + 1}
                      </div>
                      <TutorLine tutor={tutor} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground/60">{t("dashboardNetwork.noUpline")}</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* FULL WIDTH CHART SPANNING ALL 12 COLUMNS */}
      <Card className="border border-border/40 hover:shadow-lg rounded-3xl bg-card overflow-hidden shadow-sm transition-all duration-300 w-full animate-slide-up" style={{ animationDelay: '350ms' }}>
        <CardHeader className="pb-3 px-5 pt-5 border-b border-border/30">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
            <GitBranch className="h-4 w-4 text-brand-500 animate-float" />
            {t("dashboardNetwork.networkStructure")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {response?.networkTree && (response.networkTree.children?.length ?? 0) > 0 ? (
            <div className="w-full h-[650px]">
              <InteractiveNetwork tree={response.networkTree} />
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-3xl border border-dashed border-border/60 p-12 text-center bg-muted/10 flex flex-col items-center justify-center gap-4">
                <GitBranch className="h-10 w-10 text-muted-foreground/40" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-foreground">ยังไม่มีเครือข่าย</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {t("dashboardNetwork.emptyDirectTutors")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </PageTransition>
  );
}




function MetricCard({
  icon: Icon,
  label,
  value,
  isPercent,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  isPercent?: boolean;
  delay: number;
}) {
  return (
    <Card 
      className="hover-lift press-scale border border-border/40 hover:shadow-md hover:border-brand-500/20 transition-all duration-300 bg-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">{label}</p>
            <p className="mt-1 text-xl sm:text-2xl font-black text-foreground">
              {isPercent ? (
                <span>
                  <AnimatedCounter value={value} fractionDigits={2} />%
                </span>
              ) : (
                <AnimatedCounter value={value} />
              )}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 border border-brand-500/10 text-brand-600 dark:text-brand-400 group-hover:scale-110 transition-transform">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AmountBlock({
  label,
  value,
  isPayout,
  badgeBonusTHB,
  estimatedWHT,
  estimatedNet,
}: {
  label: string;
  value: number;
  isPayout?: boolean;
  badgeBonusTHB?: number;
  estimatedWHT?: number;
  estimatedNet?: number;
}) {
  const hasBadge = isPayout && (badgeBonusTHB ?? 0) > 0;

  return (
    <div className={`rounded-2xl border ${isPayout ? "border-brand-500/20 bg-brand-500/5 shadow-[0_0_15px_rgba(6,199,85,0.05)]" : "border-border/40 bg-background/50"} p-4 flex flex-col justify-between hover-lift transition-all duration-300`}>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
      <AnimatedCurrencyCounter
        value={value}
        className={`text-lg sm:text-xl font-black ${isPayout ? "text-brand-600 dark:text-brand-400" : "text-foreground"}`}
      />
      {hasBadge && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400">
          <span className="font-medium flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400" />
            {t("dashboardEarnings.badgeBonus")}
          </span>
          <span className="font-bold">+{(badgeBonusTHB ?? 0).toLocaleString("th-TH")}</span>
        </div>
      )}
      {isPayout && estimatedWHT !== undefined && estimatedNet !== undefined && (
        <div className="mt-3 pt-3 border-t border-brand-500/15 space-y-1.5">
          {estimatedWHT > 0 && (
            <div className="flex items-center justify-between text-[10px] text-destructive/70">
              <span className="font-medium">{t("dashboardNetwork.estimatedWHT")}</span>
              <span className="font-semibold">−{estimatedWHT.toLocaleString("th-TH")}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold text-foreground">{t("dashboardNetwork.estimatedNetPayout")}</span>
            <AnimatedCurrencyCounter value={estimatedNet} className="font-black text-brand-600 dark:text-brand-400" />
          </div>
        </div>
      )}
    </div>
  );
}

function TutorLine({ tutor }: { tutor: TutorSummary }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 group cursor-pointer">
        <p className="truncate font-bold text-sm text-foreground group-hover:text-brand-500 transition-colors">{tutor.displayName}</p>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-brand-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
      <p className="truncate text-xs text-muted-foreground/75 font-semibold mt-0.5">
        {tutor.email || tutor.userId}
      </p>
      <p className="mt-1 text-[10px] font-bold text-muted-foreground/60 tracking-wider">
        {t("dashboardNetwork.lockedPrefix")} {formatDate(tutor.sponsorLockedAt)}
      </p>
    </div>
  );
}
