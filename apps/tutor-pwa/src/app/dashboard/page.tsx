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
} from "lucide-react";

// Mock data — will call identity-service / learning-service
const mockStats = [
  {
    label: "คลาสที่เปิดสอน",
    value: "3",
    icon: BookOpen,
    bg: "bg-indigo-500/10 dark:bg-indigo-500/15",
    iconColor: "text-indigo-500",
    border: "border-indigo-500/20",
  },
  {
    label: "นักเรียนทั้งหมด",
    value: "14",
    icon: Users,
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconColor: "text-emerald-500",
    border: "border-emerald-500/20",
  },
  {
    label: "รายได้เดือนนี้",
    value: "฿8,400",
    icon: TrendingUp,
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconColor: "text-amber-500",
    border: "border-amber-500/20",
  },
  {
    label: "คลาสสัปดาห์นี้",
    value: "5",
    icon: Calendar,
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    iconColor: "text-rose-500",
    border: "border-rose-500/20",
  },
];

const mockClasses = [
  {
    id: "cls-1",
    name: "Origins 1 - กลุ่ม A",
    status: "open",
    students: 3,
    nextSession: "จ. 10 มี.ค. 19:00",
  },
  {
    id: "cls-2",
    name: "Quest 4 - กลุ่ม B",
    status: "full",
    students: 5,
    nextSession: "อ. 11 มี.ค. 17:00",
  },
  {
    id: "cls-3",
    name: "Origins 2 - กลุ่ม C",
    status: "open",
    students: 2,
    nextSession: "พ. 12 มี.ค. 18:00",
  },
];

const statusMap: Record<string, { label: string; className: string }> = {
  open: {
    label: "รับสมัครอยู่",
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  },
  full: {
    label: "เต็มแล้ว",
    className:
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  },
  closed: {
    label: "ปิดแล้ว",
    className: "bg-muted text-muted-foreground border border-border",
  },
};

export default function DashboardPage() {
  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ภาพรวม</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            สรุปคลาสและรายได้ของคุณในเดือนนี้
          </p>
        </div>
        <Link href="/dashboard/classes/new">
          <Button id="btn-create-class" size="sm" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            สร้างคลาสใหม่
          </Button>
        </Link>
      </div>

      {/* Stats — colored accent backgrounds for depth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {mockStats.map(
          ({ label, value, icon: Icon, bg, iconColor, border }) => (
            <div
              key={label}
              className={`rounded-xl border p-4 ${bg} ${border}`}
            >
              <div className="flex items-start justify-between mb-3">
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ),
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Classes */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              คลาสเรียนที่เปิดสอน
            </CardTitle>
            <Link
              href="/dashboard/classes"
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border/50 px-6">
            {mockClasses.map((cls) => {
              const s = statusMap[cls.status];
              return (
                <Link
                  key={cls.id}
                  href={`/dashboard/classes/${cls.id}`}
                  className="flex items-center justify-between py-3 group -mx-2 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {cls.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {cls.nextSession}
                      <span className="text-border">·</span>
                      <Users className="h-3 w-3 shrink-0" />
                      {cls.students} คน
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.className}`}
                    >
                      {s.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {/* Commission progress */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">
              คอมมิชชั่น
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rate badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">เรทปัจจุบัน</span>
              <span className="text-sm font-bold text-primary">35%</span>
            </div>
            {/* Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>฿8,400 / เป้า ฿20,000</span>
                <span className="font-semibold text-foreground">42%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500"
                  style={{ width: "42%" }}
                />
              </div>
            </div>
            {/* Unlock nudge */}
            <div className="rounded-lg bg-primary/8 border border-primary/15 p-3 text-xs space-y-0.5">
              <p className="font-semibold text-primary">
                🎯 รับนักเรียนอีก ~5 คน
              </p>
              <p className="text-muted-foreground">
                ปลดล็อกเรท{" "}
                <span className="text-foreground font-semibold">45%</span>
              </p>
            </div>
            {/* Breakdown */}
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">สอนสด</span>
                <span className="font-medium text-foreground">฿8,400</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">โบนัสทีม</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +฿1,200
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1.5 border-t border-border/50">
                <span className="font-semibold text-foreground">รวมสุทธิ</span>
                <span className="font-bold text-foreground">฿9,600</span>
              </div>
            </div>
            <Link
              href="/dashboard/earnings"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              ดูรายละเอียดรายได้ <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
