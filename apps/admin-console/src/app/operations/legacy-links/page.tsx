"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChartNoAxesColumn,
  ExternalLink,
  Link as LinkIcon,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/api";

interface UnresolvedLink {
  url: string;
  hits: number;
  lastSeen: string;
}

interface Mapping {
  id: string;
  source: string;
  target: string;
  created: string;
}

export default function LegacyLinksPage() {
  const [unresolved, setUnresolved] = useState<UnresolvedLink[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [unresResp, mapResp] = await Promise.all([
        fetchWithAuth("/v1/operations/legacy-links/unresolved"),
        fetchWithAuth("/v1/operations/legacy-links/mappings"),
      ]);
      setUnresolved(unresResp.links || []);
      setMappings(mapResp.mappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถโหลดข้อมูลลิงก์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUnresolved = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return unresolved;
    return unresolved.filter((link) => link.url.toLowerCase().includes(needle));
  }, [search, unresolved]);

  const handleCreateMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newSource.trim() || !newTarget.trim()) return;
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth("/v1/operations/legacy-links/mappings", {
        method: "POST",
        body: JSON.stringify({ source: newSource, target: newTarget }),
      });
      setSuccess(`บันทึกการจับคู่สำหรับลิงก์ ${newSource} สำเร็จ`);
      setNewSource("");
      setNewTarget("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถบันทึกการจับคู่ได้");
    }
  };

  const handleDeleteMapping = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      await fetchWithAuth(`/v1/operations/legacy-links/mappings/${id}`, {
        method: "DELETE",
      });
      setSuccess("ลบการจับคู่ลิงก์สำเร็จ");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถลบการจับคู่ได้");
    }
  };

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-foreground">
            จัดการลิงก์ระบบเก่า (Legacy Links)
          </h2>
          <p className="text-muted-foreground font-medium">
            ตั้งค่าและตรวจสอบการใช้งานลิงก์หรือ QR Code ที่ตกค้างจากระบบเดิม
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading} className="rounded-full font-bold shadow-sm h-12 px-6">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          รีเฟรชข้อมูล
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="rounded-2xl border-2 shadow-sm">
          <XCircle className="h-5 w-5" />
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Unresolved Links Card */}
        <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-amber-500/5 border-b px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-xl text-white shadow-sm">
                <ChartNoAxesColumn className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  ลิงก์ที่ไม่พบจุดหมาย
                  <Badge variant="secondary" className="bg-amber-500 text-white border-none">{filteredUnresolved.length}</Badge>
                </CardTitle>
                <CardDescription className="font-medium text-xs">
                  จัดอันดับลิงก์ระบบเก่าที่มีการเข้าใช้งานสูงสุด แต่หาหน้าปลายทางไม่เจอ
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="relative w-full group">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-amber-500 transition-colors" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหา URL ที่มีปัญหา..."
                className="pl-11 h-12 rounded-2xl border-2 focus-visible:ring-amber-500 font-medium bg-muted/30"
              />
            </div>
            
            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-2xl" />
                <Skeleton className="h-20 w-full rounded-2xl" />
              </div>
            )}
            
            {!loading && filteredUnresolved.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed p-8 text-center bg-muted/20">
                <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
                <p className="font-bold text-muted-foreground">ไม่มีลิงก์ตกค้าง</p>
                <p className="text-xs text-muted-foreground/60 mt-1">การเปลี่ยนผ่านระบบสมบูรณ์แบบ</p>
              </div>
            )}

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredUnresolved.map((link) => (
                <div
                  key={link.url}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card hover:bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-amber-700 dark:text-amber-400 group-hover:text-amber-600">{link.url}</p>
                    <p className="mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                      พบล่าสุด: {new Date(link.lastSeen).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="secondary" className="font-mono text-xs py-1">
                      {link.hits} ครั้ง
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="rounded-xl h-9 w-9 border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={() => setNewSource(link.url)}
                      title="นำไปสร้างการจับคู่"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Mappings Card */}
        <Card className="border-none shadow-md rounded-3xl bg-card overflow-hidden">
          <CardHeader className="bg-brand-500/5 border-b px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500 rounded-xl text-white shadow-sm">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">การจับคู่ลิงก์ที่ใช้งานอยู่</CardTitle>
                <CardDescription className="font-medium text-xs">
                  สร้างหรือแก้ไขการเปลี่ยนเส้นทาง (Redirect) ของลิงก์
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleCreateMapping} className="space-y-5 bg-muted/20 p-6 rounded-2xl border border-border/50">
              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ลิงก์ต้นทาง (Source URL)</Label>
                <Input
                  id="source"
                  value={newSource}
                  onChange={(event) => setNewSource(event.target.value)}
                  placeholder="domain.com/student/read/xyz"
                  className="font-mono text-sm h-11 rounded-xl border-2 focus-visible:ring-brand-500"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">เส้นทางปลายทาง (Target Path)</Label>
                <div className="relative">
                  <ExternalLink className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="target"
                    value={newTarget}
                    onChange={(event) => setNewTarget(event.target.value)}
                    placeholder="/articles/lvl1-intro"
                    className="pl-10 font-mono text-sm h-11 rounded-xl border-2 focus-visible:ring-brand-500"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-11 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 shadow-md shadow-brand-500/20">
                <Plus className="mr-2 h-4 w-4" />
                บันทึกการจับคู่
              </Button>
            </form>

            <Separator className="my-8" />

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              <h3 className="text-sm font-bold text-foreground mb-4">รายการทั้งหมด ({mappings.length})</h3>
              
              {loading && <Skeleton className="h-20 w-full rounded-2xl" />}
              
              {!loading && mappings.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground bg-muted/20">
                  ยังไม่มีการจับคู่ลิงก์ที่ใช้งานอยู่
                </div>
              )}
              
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 p-4 bg-card group hover:shadow-sm transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-muted-foreground line-through decoration-muted-foreground/30">
                      {mapping.source}
                    </p>
                    <p className="mt-1.5 truncate font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                      <span className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase mr-2 no-underline">เปลี่ยนเป็น ➔</span>
                      {mapping.target}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 rounded-xl h-10 w-10 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600"
                    onClick={() => handleDeleteMapping(mapping.id)}
                    title="ลบการจับคู่"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}