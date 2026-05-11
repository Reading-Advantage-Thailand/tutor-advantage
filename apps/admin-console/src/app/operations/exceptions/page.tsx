"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  XCircle,
  Activity
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";

interface ExceptionEvent {
  id: string;
  type: string;
  studentName: string;
  classId: string;
  provider: string;
  amount: string;
  status: string;
  createdAt: string;
  errorDetail: string;
}

export default function ExceptionsPage() {
  const [data, setData] = useState<ExceptionEvent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("status", "UNRESOLVED");
      const resp = await fetchWithAuth(
        `/v1/operations/exceptions?${params.toString()}`,
      );
      setData(resp.exceptions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลข้อผิดพลาดได้");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAmount = useMemo(() => data.length, [data]);

  const handleResolve = async (id: string, action: string) => {
    setResolvingId(id);
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(
        `/v1/operations/exceptions/${id}/${action.replace(/\s+/g, "_").toUpperCase()}`,
        { method: "POST" },
      );
      setSuccess(`อัปเดตสถานะของข้อผิดพลาดรหัส ${id.slice(0, 8)} สำเร็จ`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            ข้อผิดพลาดระบบ (Exceptions)
          </h2>
          <p className="text-muted-foreground font-medium">
            ตรวจสอบเหตุการณ์ผิดปกติในระบบการเงิน และการดำเนินงาน
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="rounded-full font-bold shadow-sm h-12 px-6">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรชข้อมูล
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-2 shadow-sm">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold">ดำเนินการไม่สำเร็จ</AlertTitle>
          <AlertDescription className="font-medium">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <AlertDescription className="font-medium text-emerald-700">
            {success}
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/20 border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  รายการที่รอการแก้ไข
                  <Badge variant="secondary" className="bg-amber-500 text-white border-none">{totalAmount}</Badge>
                </CardTitle>
                <CardDescription className="font-medium text-xs">
                  ตรวจสอบการเรียกชำระเงินที่ไม่สำเร็จ, การสมัครเรียนที่ผิดพลาด และการแก้ไขด้วยตนเอง
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-brand-600 transition-colors" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") loadData();
              }}
              placeholder="ค้นหาข้อผิดพลาด, ชื่อนักเรียน, คลาส..."
              className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-brand-500 font-medium bg-muted/30"
            />
          </div>

          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          )}
          
          {!loading && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/20 rounded-3xl border-2 border-dashed">
              <Activity className="h-12 w-12 text-emerald-500/50 mb-4" />
              <p className="font-bold text-muted-foreground">ระบบทำงานได้สมบูรณ์</p>
              <p className="text-sm text-muted-foreground/60 mt-1">ไม่มีข้อผิดพลาดที่รอการแก้ไขในขณะนี้</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            {data.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/60 bg-card p-6 transition-all hover:shadow-md hover:border-amber-500/30 group">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="font-bold px-3 py-1 uppercase tracking-wider text-[10px] rounded-full border-none bg-red-500/10 text-red-700 dark:text-red-400"
                      >
                        {item.type}
                      </Badge>
                      <Badge variant="secondary" className="px-2 py-1 rounded-md text-[10px] font-bold border-none bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        {item.status}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                        ID: {item.id.slice(0, 12)}...
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">นักเรียน</p>
                        <p className="font-bold text-foreground truncate">{item.studentName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">คลาส</p>
                        <p className="font-mono text-xs font-bold truncate">{item.classId}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">ผู้ให้บริการ</p>
                        <p className="font-bold text-foreground truncate">{item.provider}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">ยอดเงิน</p>
                        <p className="font-black text-foreground">{item.amount}</p>
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">รายละเอียดข้อผิดพลาด</p>
                      <p className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-3 font-mono text-xs text-red-800 dark:text-red-400 break-words">
                        {item.errorDetail || "ไม่มีรายละเอียดข้อผิดพลาด"}
                      </p>
                    </div>
                    
                    <p className="text-[10px] font-bold text-muted-foreground">
                      เวลาเกิดเหตุ: {new Date(item.createdAt).toLocaleString("th-TH")}
                    </p>
                  </div>
                  
                  <div className="flex w-full flex-col gap-2 lg:w-48 border-t lg:border-t-0 lg:border-l border-border/50 pt-4 lg:pt-0 lg:pl-6">
                    <Button
                      variant="outline"
                      disabled={resolvingId === item.id}
                      onClick={() => handleResolve(item.id, "Void Cancel")}
                      className="w-full rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 h-11"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      ยกเลิก / โมฆะ
                    </Button>
                    <Button
                      disabled={resolvingId === item.id}
                      onClick={() => handleResolve(item.id, "Force Active")}
                      className="w-full rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 h-11"
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      บังคับสำเร็จ
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}