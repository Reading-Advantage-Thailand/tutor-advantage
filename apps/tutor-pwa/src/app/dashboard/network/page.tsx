import { cookies } from "next/headers";
import {
  ArrowUpRight,
  CircleDollarSign,
  GitBranch,
  TrendingUp,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteLinkCard } from "./invite-link-card";
import { InteractiveNetwork } from "./interactive-network";

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
    level1Count: number;
    level2PlusCount: number;
  };
  downlines: TutorSummary[];
};

async function getNetworkData(token: string): Promise<NetworkResponse | null> {
  if (!token) return null;

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003/v1";
  const res = await fetch(`${baseUrl}/tutors/network`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
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
  level1Count: 0,
  level2PlusCount: 0,
};

export default async function NetworkPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";
  const response = await getNetworkData(token);
  const summary = response?.summary || emptySummary;

  return (
    <div className="max-w-5xl mx-auto space-y-6 lg:space-y-8 pb-20 sm:pb-0">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">เครือข่าย</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ภาพรวมสายงาน tutor และยอดขายที่ใช้คำนวณ differential payout เดือน{" "}
            {response?.periodMonth || "-"}
          </p>
        </div>
        {response?.inviteUrl ? (
          <InviteLinkCard inviteUrl={response.inviteUrl} />
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          icon={Users}
          label="สายตรง"
          value={summary.directDownlines.toLocaleString("th-TH")}
        />
        <MetricCard
          icon={GitBranch}
          label="ทั้งเครือข่าย"
          value={summary.totalDownlines.toLocaleString("th-TH")}
        />
        <MetricCard
          icon={UserRoundCheck}
          label="มี volume เดือนนี้"
          value={summary.activeDownlines.toLocaleString("th-TH")}
        />
        <MetricCard
          icon={TrendingUp}
          label="เรทปัจจุบัน"
          value={formatPercent(summary.currentRate)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col">
          <Card className="border-border/60 shadow-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Volume และ payout
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 flex-1 items-center">
              <AmountBlock label="PV ส่วนตัว" value={summary.personalVolumeTHB} />
              <AmountBlock label="GV เครือข่าย" value={summary.groupVolumeTHB} />
              <AmountBlock
                label="payout ประมาณการ"
                value={summary.estimatedPayoutTHB}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Narrower Right Column inside Grid, Combined Card */}
        <div className="lg:col-span-4 flex flex-col">
          <Card className="border-border/60 shadow-sm h-full flex flex-col divide-y divide-border/40">
            {/* Section 1: Sponsor */}
            <div className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">ผู้แนะนำ</h3>
              {response?.sponsor ? (
                <TutorLine tutor={response.sponsor} />
              ) : (
                <p className="text-xs text-muted-foreground">ไม่มีผู้แนะนำ</p>
              )}
            </div>

            {/* Section 2: Upline */}
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Upline</h3>
              <div className="space-y-2 overflow-y-auto max-h-[100px] flex-1">
                {response?.upline?.length ? (
                  response.upline.map((tutor, index) => (
                    <div key={tutor.userId} className="flex items-start gap-3">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {index + 1}
                      </div>
                      <TutorLine tutor={tutor} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">ไม่มี upline</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* FULL WIDTH CHART SPANNING ALL 12 COLUMNS */}
      <Card className="border-border/60 shadow-sm w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <GitBranch className="h-4 w-4 text-primary" />
            โครงสร้างเครือข่าย
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {response?.networkTree ? (
            <div className="w-full h-[650px]">
              <InteractiveNetwork tree={response.networkTree} />
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                ยังไม่มี tutor ในสายตรง
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}




function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AmountBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">
        ฿{formatTHB(value)}
      </p>
    </div>
  );
}

function TutorLine({ tutor }: { tutor: TutorSummary }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2">
        <p className="truncate font-medium text-foreground">{tutor.displayName}</p>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {tutor.email || tutor.userId}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        locked {formatDate(tutor.sponsorLockedAt)}
      </p>
    </div>
  );
}
