"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import {
  Users,
  Search,
  ShieldCheck,
  GraduationCap,
  Bell,
  ArrowRight,
  ShieldAlert,
  User,
  Mail,
  CalendarDays,
  BookOpen,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

interface UserInfo {
  id: string;
  name: string;
  role: string;
  email: string;
  profilePictureUrl?: string | null;
  activeClasses: number;
  status: string;
  joined: string;
  guardianSetup?: boolean;
  verificationStatus?: string;
  pendingVerificationCount?: number;
}

const VERIFICATION_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  VERIFIED:   { label: "ยืนยันแล้ว",      className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  PENDING:    { label: "รอตรวจสอบ",       className: "bg-amber-500/10 text-amber-600 border-amber-500/20",   icon: Clock },
  REJECTED:   { label: "ถูกปฏิเสธ",       className: "bg-red-500/10 text-red-600 border-red-500/20",         icon: XCircle },
  UNVERIFIED: { label: "ยังไม่ยืนยันตัวตน", className: "bg-muted text-muted-foreground border-transparent",    icon: AlertCircle },
};

type FilterTab = "all" | "TUTOR" | "STUDENT" | "pending";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetchWithAuth("/v1/users");
      setUsers(resp.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Handle ?filter=pending from URL (e.g. from dashboard CTA)
    const params = new URLSearchParams(window.location.search);
    if (params.get("filter") === "pending") setActiveTab("pending");
  }, [loadData]);

  const searchFiltered = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const filtered = searchFiltered.filter((u) => {
    if (activeTab === "TUTOR") return u.role === "TUTOR";
    if (activeTab === "STUDENT") return u.role === "STUDENT";
    if (activeTab === "pending") return u.role === "TUTOR" && (u.pendingVerificationCount || 0) > 0;
    return true;
  });

  const totalTutors   = users.filter((u) => u.role === "TUTOR").length;
  const totalStudents = users.filter((u) => u.role === "STUDENT").length;
  const pendingCount  = users.filter((u) => u.role === "TUTOR" && (u.pendingVerificationCount || 0) > 0).length;

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all",     label: "ทั้งหมด",      count: users.length },
    { id: "TUTOR",   label: "ติวเตอร์",    count: totalTutors },
    { id: "STUDENT", label: "นักเรียน",     count: totalStudents },
    { id: "pending", label: "รอตรวจสอบ",   count: pendingCount },
  ];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black tracking-tight text-foreground">ผู้ใช้งาน & ความยินยอม</h2>
        <p className="text-muted-foreground font-medium">จัดการบัญชีผู้ใช้, ความยินยอมจากผู้ปกครอง และการยืนยันตัวตน</p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "ผู้ใช้งานทั้งหมด", value: users.length,   icon: Users,        color: "text-brand-600" },
          { label: "ติวเตอร์",          value: totalTutors,   icon: User,         color: "text-purple-600" },
          { label: "นักเรียน",           value: totalStudents, icon: GraduationCap,color: "text-blue-600" },
          { label: "รอตรวจสอบเอกสาร",   value: pendingCount,  icon: ShieldAlert,  color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-none shadow-sm rounded-2xl bg-card">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-muted/60 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black text-foreground tabular-nums">{value}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + Tabs */}
      <div className="space-y-4">
        <div className="relative max-w-lg group">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
          <Input
            type="text"
            placeholder="ค้นหาด้วยชื่อ, อีเมล หรือ ID ผู้ใช้งาน..."
            className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-brand-500 font-medium bg-muted/30"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all
                ${activeTab === tab.id
                  ? tab.id === "pending"
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-brand-600 text-white shadow-md shadow-brand-500/20"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              `}
            >
              {tab.label}
              <span className={`
                text-[10px] font-black px-1.5 py-0.5 rounded-full
                ${activeTab === tab.id ? "bg-white/20" : "bg-muted-foreground/10"}
              `}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Pending verification banner */}
      {activeTab === "pending" && pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <Bell className="h-4 w-4 shrink-0 animate-pulse" />
          มีติวเตอร์ {pendingCount} รายที่รอการตรวจสอบเอกสาร
        </div>
      )}

      {/* User grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
          <div className="animate-spin h-10 w-10 border-4 border-muted-foreground/20 border-t-brand-500 rounded-full mb-4" />
          <p className="font-bold text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((user) => {
            const vCfg = user.verificationStatus ? VERIFICATION_CONFIG[user.verificationStatus] : null;
            const VIcon = vCfg?.icon;
            const initials = user.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <Link href={`/users/${user.id}`} key={user.id} className="block group">
                <Card className="h-full overflow-hidden border-none shadow-sm rounded-2xl transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-card group-hover:ring-2 group-hover:ring-brand-500/20">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 shrink-0 border-2 border-background shadow-sm ring-1 ring-border/50">
                        {user.profilePictureUrl && (
                          <AvatarImage src={user.profilePictureUrl} alt={user.name} className="object-cover" />
                        )}
                        <AvatarFallback className={`text-sm font-bold ${user.role === "TUTOR" ? "bg-gradient-to-br from-purple-400 to-brand-600 text-white" : "bg-gradient-to-br from-blue-400 to-blue-600 text-white"}`}>
                          {initials || user.name[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate text-foreground group-hover:text-brand-600 transition-colors">
                              {user.name}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {user.status === "INACTIVE" && (
                              <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-red-300 text-red-500 bg-red-50 dark:bg-red-950/20">
                                ระงับ
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-bold px-1.5 py-0 ${
                                user.role === "TUTOR"
                                  ? "border-purple-200 text-purple-700 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400"
                                  : "border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400"
                              }`}
                            >
                              {user.role === "TUTOR" ? "ติวเตอร์" : "นักเรียน"}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {user.activeClasses} คลาส
                            </span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(user.joined).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                      <div className="flex flex-wrap gap-1.5">
                        {user.role === "TUTOR" && vCfg && VIcon && (
                          <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 border ${vCfg.className}`}>
                            <VIcon className="h-3 w-3 mr-1" />
                            {vCfg.label}
                          </Badge>
                        )}
                        {user.role === "TUTOR" && (user.pendingVerificationCount || 0) > 0 && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 shadow-sm border-none">
                            <Bell className="h-3 w-3 mr-1" />
                            {user.pendingVerificationCount} รายการรอตรวจ
                          </Badge>
                        )}
                        {user.role === "STUDENT" && (
                          <Badge variant="outline" className={`text-[10px] font-semibold px-2 py-0.5 ${user.guardianSetup ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-amber-500/10 text-amber-700 border-amber-500/20"}`}>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {user.guardianSetup ? "ผู้ปกครองยืนยันแล้ว" : "รอผู้ปกครองยืนยัน"}
                          </Badge>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-brand-500 transition-colors shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="font-bold text-muted-foreground">ไม่พบผู้ใช้งานตามเงื่อนไขที่ค้นหา</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
