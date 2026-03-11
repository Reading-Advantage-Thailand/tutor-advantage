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
  Star,
} from "lucide-react";

// Mock data — will call identity-service / learning-service
const mockStats = [
  {
    label: "คลาสที่เปิด",
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
    <div className="space-y-6 lg:space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">ภาพรวม</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            สรุปคลาสและรายได้ของคุณในเดือนนี้
          </p>
        </div>
        <Link href="/dashboard/classes/new" className="hidden sm:block">
          <Button id="btn-create-class" size="sm" className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            สร้างคลาสใหม่
          </Button>
        </Link>
      </div>

      {/* Stats — colored accent backgrounds for depth */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {mockStats.map(
          ({ label, value, icon: Icon, bg, iconColor, border }) => (
            <div
              key={label}
              className={`rounded-xl border p-3 lg:p-4 flex flex-col justify-between ${bg} ${border} shadow-sm`}
            >
              <div className="flex items-start justify-between mb-2 lg:mb-3">
                <Icon className={`h-4 w-4 lg:h-5 lg:w-5 ${iconColor}`} />
              </div>
              <div>
                <p className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">{value}</p>
                <p className="text-[11px] lg:text-xs text-muted-foreground mt-0.5 lg:mt-1 font-medium">{label}</p>
              </div>
            </div>
          ),
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
        
        {/* Commission Progress - Prominent on mobile (moved up or emphasized) */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background relative overflow-hidden shadow-sm lg:order-last">
          {/* Subtle glow effect */}
          <div className="absolute top-0 right-0 p-8 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
          
          <CardHeader className="pb-3 relative z-10">
            <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              เป้าหมายคอมมิชชั่น
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 relative z-10">
            {/* Rate badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">เรทปัจจุบัน</span>
              <span className="text-xl font-bold text-primary">35%</span>
            </div>
            
            {/* Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="font-medium">฿8,400</span>
                <span>เป้า ฿20,000</span>
              </div>
              <div className="w-full bg-primary/10 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: "42%" }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-pulse" />
                </div>
              </div>
            </div>
            
            {/* Unlock nudge */}
            <div className="rounded-xl bg-background border border-border shadow-sm p-4 text-sm space-y-1">
              <p className="font-semibold text-primary flex items-center gap-2">
                🎯 รับนักเรียนอีก ~5 คน
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                ยอดการสอนสดและโบนัสทีมรวมกันจะปลดล็อกเรทคอมมิชชั่น{" "}
                <span className="text-foreground font-bold text-sm">45%</span>
              </p>
            </div>
            
            {/* Breakdown Mini */}
            <div className="pt-2 border-t border-border/50">
              <Link
                href="/dashboard/earnings"
                className="flex items-center justify-between w-full group"
              >
                <div>
                  <p className="text-xs text-muted-foreground">รวมสุทธิ</p>
                  <p className="font-bold text-foreground">฿9,600</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-primary font-medium group-hover:underline">
                  ดูรายละเอียด <ArrowUpRight className="h-3 w-3" />
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Classes List */}
        <Card className="lg:col-span-2 border-border/60 shadow-sm flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">
              คลาสเรียนล่าสุด
            </CardTitle>
            <Link
              href="/dashboard/classes"
              className="text-xs text-primary hover:underline flex items-center gap-0.5 p-1 -m-1"
            >
              ดูทั้งหมด <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-2">
            <div className="divide-y divide-border/50 flex-1">
              {mockClasses.map((cls) => {
                const s = statusMap[cls.status];
                return (
                  <Link
                    key={cls.id}
                    href={`/dashboard/classes/${cls.id}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-4 group -mx-2 px-2 rounded-xl hover:bg-muted/50 transition-colors gap-3 sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between sm:justify-start gap-2 mb-1 sm:mb-0">
                        <p className="text-[15px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {cls.name}
                        </p>
                        {/* Status badge moved here on mobile for better flow */}
                        <span
                          className={`sm:hidden px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${s.className}`}
                        >
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {cls.nextSession}
                        </span>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 shrink-0" />
                          {cls.students} คน
                        </span>
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.className}`}
                      >
                        {s.label}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
            
            {/* Mobile Create Class Button Factory at bottom of card */}
            <div className="pt-4 pb-2 sm:hidden mt-auto border-t border-border/30">
              <Link href="/dashboard/classes/new" className="block w-full">
                <Button variant="outline" className="w-full gap-2 text-primary border-primary/20 hover:bg-primary/5">
                  <Plus className="h-4 w-4" />
                  สร้างคลาสใหม่
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
