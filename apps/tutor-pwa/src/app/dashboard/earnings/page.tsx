import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, AlertCircle, Wallet, Star } from "lucide-react";
import { cookies } from "next/headers";
import VerificationBanner from "@/components/dashboard/verification-banner";

type EarningsHistoryItem = {
  date: string;
  direct: number;
  network: number;
  clawback: number;
  withholdingTax?: number;
  netPayout?: number;
  payoutDocument?: {
    documentNumber: string;
    documentType: string;
    status: string;
    issuedAt: string;
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

  const baseUrl = process.env.FINANCE_API_BASE_URL || "http://localhost:3003/v1";
  const res = await fetch(`${baseUrl}/tutors/earnings/history`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) return null;
  return res.json();
}

const statusMap: Record<string, { label: string; className: string }> = {
  draft: {
    label: "ร่างรายการ",
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "รอพิจารณา",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  approved: {
    label: "อนุมัติแล้ว",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "ถูกปฏิเสธ",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const emptyEarnings: EarningsResponse["currentProjection"] = {
  directSales: 0,
  networkBonus: 0,
  clawback: 0,
  total: 0,
};

const emptyRateInfo: EarningsResponse["rateInfo"] = {
  rate: 0,
  volume: 0,
  nextTarget: 0,
};

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

export default async function EarningsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("tutor_session")?.value || "";

  const response = await getEarningsHistoryData(token);

  const earnings = response?.currentProjection || emptyEarnings;
  const history = response?.history || [];
  const clawbacks = response?.clawbacks || [];
  const rateInfo = response?.rateInfo || emptyRateInfo;
  const commissionPercent = Math.round(rateInfo.rate * 100);

  const progressPercent = Math.min(
    100,
    rateInfo.nextTarget > 0
      ? Math.round((rateInfo.volume / rateInfo.nextTarget) * 100)
      : 100,
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 lg:space-y-8 pb-20 sm:pb-0">
      <VerificationBanner />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">รายได้ของฉัน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            สรุปรายได้จาก payment และ settlement ที่บันทึกในฐานข้อมูลจริง
          </p>
        </div>
        <Button
          id="btn-download-reports"
          variant="outline"
          className="gap-2 shrink-0 hidden sm:flex"
        >
          <Download className="h-4 w-4" />
          ดาวน์โหลดรายงาน (CSV)
        </Button>
      </div>

      <div className="grid gap-6 lg:gap-8 md:grid-cols-12">
        <div className="md:col-span-7 space-y-6 lg:space-y-8">
          <Card className="border-border/60 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-foreground">
                  รายได้ประมาณการเดือนนี้ ({response?.periodMonth || "N/A"})
                </h2>
              </div>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                  ฿{formatTHB(earnings.total)}
                </span>
                <span className="text-sm font-medium text-muted-foreground">THB</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border/50 bg-background/50 p-3 sm:p-4">
                  <p className="text-xs text-muted-foreground mb-1">ค่าคอมมิชชันจากยอดชำระ</p>
                  <p className="text-lg sm:text-xl font-bold text-foreground">
                    ฿{formatTHB(earnings.directSales)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">โบนัสเครือข่าย</p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    +฿{formatTHB(earnings.networkBonus)}
                  </p>
                </div>
              </div>

              {earnings.clawback !== 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-destructive/5 border border-destructive/15 px-4 py-3 text-sm">
                  <span className="text-destructive/90 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">ยอดปรับหักคืน</span>
                  </span>
                  <span className="font-bold text-destructive">
                    ฿{formatTHB(earnings.clawback)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  คอมมิชชันปัจจุบัน
                </span>
                <span className="text-lg font-bold text-primary">{commissionPercent}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">฿{formatTHB(rateInfo.volume)}</span>
                  <span>
                    {rateInfo.nextTarget > 0
                      ? `เป้าหมาย ฿${formatTHB(rateInfo.nextTarget)} เพื่อปรับเรท`
                      : "อยู่ในเรทสูงสุดแล้ว"}
                  </span>
                </div>
                <div className="w-full bg-primary/10 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all duration-1000 ease-out relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-5 space-y-6 lg:space-y-8">
          <Card className="border-border/60 shadow-sm flex flex-col h-full">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border/40">
              <CardTitle className="text-sm font-semibold text-foreground">
                ประวัติการจ่ายเงิน
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-primary sm:hidden px-2 -mr-2"
              >
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {history.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    ยังไม่มีประวัติการจ่ายเงิน
                  </div>
                )}
                {history.map((item) => {
                  const total = item.direct + item.network + item.clawback;
                  const status = statusMap[item.status] || {
                    label: item.status,
                    className: "bg-muted",
                  };
                  return (
                    <div key={`${item.date}-${item.status}`} className="p-4 sm:p-5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-foreground">{item.date}</p>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wide border ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p className="text-lg font-bold text-foreground mb-3">
                        ฿{formatTHB(total)}
                      </p>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>ยอดจ่ายตาม settlement</span>
                          <span className="font-medium text-foreground">฿{formatTHB(item.direct)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>โบนัสเครือข่าย</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            +฿{formatTHB(item.network)}
                          </span>
                        </div>
                        {item.clawback !== 0 && (
                          <div className="flex justify-between pt-1 border-t border-border/40 mt-1">
                            <span className="text-destructive/80">ยอดปรับหักคืน</span>
                            <span className="font-semibold text-destructive">
                              ฿{formatTHB(item.clawback)}
                            </span>
                          </div>
                        )}
                        {item.withholdingTax !== undefined && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>หัก ณ ที่จ่าย 3%</span>
                            <span className="font-medium text-foreground">
                              ฿{formatTHB(item.withholdingTax)}
                            </span>
                          </div>
                        )}
                        {item.netPayout !== undefined && (
                          <div className="flex justify-between pt-1 border-t border-border/40 mt-1 text-muted-foreground">
                            <span>ยอดรับสุทธิ</span>
                            <span className="font-semibold text-foreground">
                              ฿{formatTHB(item.netPayout)}
                            </span>
                          </div>
                        )}
                        {item.payoutDocument && (
                          <div className="pt-1 text-[11px] text-muted-foreground">
                            เอกสาร: {item.payoutDocument.documentNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {clawbacks.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              รายละเอียดการปรับยอดหักคืน
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border/40 -mx-6 px-6 sm:mx-0 sm:px-0">
              {clawbacks.map((item, index) => (
                <div
                  key={`${item.date}-${index}`}
                  className="flex items-start justify-between py-3 gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground leading-tight">{item.reason}</p>
                    <p className="text-[11px] text-muted-foreground">รอบบิล: {item.date}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0 bg-destructive/10 px-2 py-1 rounded-md">
                    {formatTHB(item.amount)} THB
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              * ยอดปรับหักคืนจะแสดงเฉพาะรายการที่ได้รับการอนุมัติแล้วและถูกนำไปคำนวณกับรายได้ในรอบที่เกี่ยวข้อง
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
