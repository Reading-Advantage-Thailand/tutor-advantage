import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Download, AlertCircle } from "lucide-react";
import Link from "next/link";

const mockEarnings = {
  directSales: 8400,
  networkBonus: 1200,
  clawback: -500,
  total: 9100,
};

const mockHistory = [
  {
    date: "มี.ค. 2026",
    direct: 8400,
    network: 1200,
    clawback: -500,
    status: "pending",
  },
  {
    date: "ก.พ. 2026",
    direct: 7500,
    network: 900,
    clawback: 0,
    status: "approved",
  },
  {
    date: "ม.ค. 2026",
    direct: 6000,
    network: 500,
    clawback: 0,
    status: "approved",
  },
];

const clawbacks = [
  {
    date: "ก.พ. 2026",
    amount: -500,
    reason: "นักเรียน Refund — น้องโอ (Origins 1 กลุ่ม A)",
  },
];

const statusMap: Record<string, { label: string; className: string }> = {
  pending: {
    label: "รอการอนุมัติ",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  approved: {
    label: "อนุมัติแล้ว",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

export default function EarningsPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">รายได้ของฉัน</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          สรุปรายได้จากการสอนและโบนัสเครือข่าย ตรวจสอบได้ทุกรายการ
        </p>
      </div>

      {/* Current month breakdown */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            เดือนนี้ (มี.ค. 2026)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/60 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">รายได้จากการสอน</p>
              <p className="text-xl font-bold text-foreground">
                ฿{mockEarnings.directSales.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">โบนัสเครือข่าย</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                +฿{mockEarnings.networkBonus.toLocaleString()}
              </p>
            </div>
          </div>
          {/* Clawback row */}
          {mockEarnings.clawback !== 0 && (
            <div className="flex items-center justify-between rounded-lg bg-destructive/5 border border-destructive/15 px-3 py-2.5 text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                หักคืน (Clawback)
              </span>
              <span className="font-semibold text-destructive">
                ฿{mockEarnings.clawback.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-border/60">
            <span className="text-sm font-semibold text-foreground">
              รวมสุทธิ
            </span>
            <span className="text-lg font-bold text-foreground">
              ฿{mockEarnings.total.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Commission progress */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              ความคืบหน้าคอมมิชชั่น
            </p>
            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
              <TrendingUp className="h-3 w-3" />
              เรทปัจจุบัน 35%
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>฿8,400 / เป้า ฿20,000</span>
              <span className="font-medium text-foreground">42%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: "42%" }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-xs">
            <p className="font-semibold text-primary">
              🎯 รับนักเรียนอีก ~5 คน
            </p>
            <p className="text-muted-foreground mt-0.5">
              เพื่อปลดล็อกเรทคอมมิชชั่น{" "}
              <strong className="text-foreground">45%</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Clawback log */}
      {clawbacks.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-destructive" />
              การปรับยอด (Clawback / Refund)
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            {clawbacks.map((c, i) => (
              <div
                key={i}
                className="flex items-start justify-between py-2.5 gap-3"
              >
                <div>
                  <p className="text-sm text-foreground">{c.reason}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.date}
                  </p>
                </div>
                <span className="text-sm font-semibold text-destructive shrink-0">
                  ฿{c.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            ประวัติการจ่ายเงิน
          </CardTitle>
          <Button
            id="btn-download-payslip"
            variant="outline"
            size="sm"
            className="gap-2 h-7 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            ดาวน์โหลด Pay Slip
          </Button>
        </CardHeader>
        <CardContent className="divide-y divide-border/50">
          {mockHistory.map((h) => {
            const total = h.direct + h.network + h.clawback;
            const s = statusMap[h.status];
            return (
              <div key={h.date} className="py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">
                    {h.date}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      ฿{total.toLocaleString()}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.className}`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>สอนสด ฿{h.direct.toLocaleString()}</span>
                  <span>โบนัสทีม +฿{h.network.toLocaleString()}</span>
                  {h.clawback !== 0 && (
                    <span className="text-destructive">
                      หัก ฿{h.clawback.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
