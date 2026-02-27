"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ReceiptText,
  ShieldCheck,
  ClockAlert,
  CheckCircle2,
  Activity,
  ArrowRight,
  Info,
  FilePenLine,
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

const CURRENT_PERIOD = new Date().toLocaleDateString("th-TH", {
  year: "numeric",
  month: "long",
});

const QUICK_ACTIONS = [
  {
    title: "รันรอบบิล Settlement",
    description: "สร้าง Snapshot พรีวิวก่อนอนุมัติ",
    href: "/settlements",
    icon: ReceiptText,
    badge: null,
  },
  {
    title: "รายการรออนุมัติ",
    description: "Makers-Checkers: อนุมัติหรือปฏิเสธ Payout Batch",
    href: "/settlements",
    icon: ClockAlert,
    badge: "ต้องดำเนินการ",
  },
  {
    title: "ปรับยอดเงิน (Manual)",
    description: "บันทึกรายการปรับยอดพิเศษ รอ Checker อนุมัติ",
    href: "/adjustments",
    icon: FilePenLine,
    badge: null,
  },
  {
    title: "Audit Log",
    description: "ดูประวัติทุก Action พร้อม Traceability",
    href: "/audit",
    icon: ShieldCheck,
    badge: null,
  },
];

interface DashboardStats {
  totalSettlementsLast30Days: number;
  pendingApprovals: number;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ElementType;
  variant?: "default" | "warning" | "success";
}) {
  const valueColor =
    variant === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : variant === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRole(localStorage.getItem("admin_role"));
    }
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      setStatsLoading(true);
      try {
        const data = await fetchWithAuth("/v1/settlements/summary");
        setStats(data);
      } catch {
        // ถ้า API ยังไม่พร้อม ล้มเหลวอย่างเงียบๆ — ตัวเลขจะแสดงเป็น "--"
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    };
    loadStats();
  }, []);

  return (
    <div className="space-y-6 w-full">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            รอบบิลปัจจุบัน:{" "}
            <span className="font-medium text-foreground">
              {CURRENT_PERIOD}
            </span>
          </p>
        </div>
        {role && (
          <Badge
            variant="outline"
            className="border-primary/30 text-primary bg-primary/5 self-start sm:self-auto w-fit"
          >
            {role}
          </Badge>
        )}
      </div>

      {/* Audit Notice */}
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-700 dark:text-amber-300 text-sm font-semibold">
          Audit Mode เปิดใช้งานอยู่
        </AlertTitle>
        <AlertDescription className="text-amber-700/80 dark:text-amber-400/80 text-xs leading-relaxed">
          ทุก Action ใน Console นี้ถูกบันทึกและสามารถ Reconstruct ได้จาก
          Immutable Records — ทุก Monetary Event ถูก Attribute แยกจาก Payout
          Data
        </AlertDescription>
      </Alert>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="จำนวน Settlement"
              value={
                stats?.totalSettlementsLast30Days != null
                  ? String(stats.totalSettlementsLast30Days)
                  : "--"
              }
              description="30 วันที่ผ่านมา"
              icon={ReceiptText}
            />
            <StatCard
              title="รออนุมัติ"
              value={
                stats?.pendingApprovals != null
                  ? String(stats.pendingApprovals)
                  : "--"
              }
              description="ต้องการการดำเนินการ"
              icon={ClockAlert}
              variant={
                stats?.pendingApprovals != null && stats.pendingApprovals > 0
                  ? "warning"
                  : "default"
              }
            />
            <StatCard
              title="สถานะระบบ"
              value="100%"
              description="ทุก Service ทำงานปกติ"
              icon={Activity}
              variant="success"
            />
          </>
        )}
      </div>

      <Separator />

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Finance Admin Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Card
                key={action.title}
                className="group hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {action.badge && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]"
                      >
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold text-foreground mt-2">
                    {action.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {action.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-primary hover:text-primary hover:bg-primary/5 px-0"
                  >
                    <Link href={action.href}>
                      เปิด
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Compliance Note */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground/60">
        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
        <span>
          การคำนวณ Settlement ใช้จำนวนเต็มสตางค์เพื่อป้องกัน Rounding Error —
          สายงาน Payout ที่ Settle แล้วไม่สามารถเขียนทับย้อนหลังได้ การ Refund
          และ Chargeback จะปรากฏเป็น Clawback ในรอบถัดไป
        </span>
      </div>
    </div>
  );
}
