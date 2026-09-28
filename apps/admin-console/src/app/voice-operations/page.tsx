"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";

type Metrics = {
  attempts: number; started: number; failedStarts: number; failedStartRate: number;
  finished: number; disconnected: number; disconnectRate: number;
  summaryFailures: number; summaryFailureRate: number;
  measuredCostSessions: number; missingCostSessions: number;
  totalMeasuredRealtimeCostUsd: number; averageMeasuredRealtimeCostUsd: number | null;
  recentSessions: Array<{ sessionId: string; createdAt: string; status: string; endReason: string | null;
    consumedSeconds: number; summaryAvailable: boolean; measuredRealtimeCostUsd: number | null }>;
};

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const usd = (value: number | null) => value === null ? "ไม่มีข้อมูล" : `$${value.toFixed(4)}`;

export default function VoiceOperationsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMetrics(await fetchWithAuth(`/v1/admin/voice-operations?days=${days}`) as Metrics);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "โหลดข้อมูลการฝึกเสียงไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const cards = metrics ? [
    { label: "เริ่มไม่สำเร็จ", count: metrics.failedStarts, rate: percent(metrics.failedStartRate), detail: `จาก ${metrics.attempts} ครั้งที่สร้างรอบฝึก` },
    { label: "การเชื่อมต่อหลุด", count: metrics.disconnected, rate: percent(metrics.disconnectRate), detail: `จาก ${metrics.finished} รอบที่จบแล้ว` },
    { label: "ไม่มีสรุปผล", count: metrics.summaryFailures, rate: percent(metrics.summaryFailureRate), detail: `จาก ${metrics.finished} รอบที่จบแล้ว` },
  ] : [];

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-bold">การฝึกเสียงกับรีดี้</h1><p className="text-sm text-muted-foreground">สถานะการเริ่มรอบ คุณภาพการเชื่อมต่อ และต้นทุนตาม usage ที่ provider รายงาน</p></div>
      <div className="flex items-center gap-2">
        <select aria-label="ช่วงเวลา" value={days} onChange={(event) => setDays(Number(event.target.value) as 7 | 30 | 90)} className="rounded-lg border bg-background px-3 py-2 text-sm">
          <option value={7}>7 วัน</option><option value={30}>30 วัน</option><option value={90}>90 วัน</option>
        </select>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} />รีเฟรช</Button>
      </div>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-300 p-3 text-red-600">{error}</p>}
    <div className="grid gap-4 md:grid-cols-3">{cards.map((card) => <Card key={card.label}><CardHeader><CardTitle className="text-base">{card.label}</CardTitle></CardHeader><CardContent><strong className="text-3xl">{card.rate}</strong><p className="mt-2 text-sm">{card.count} รอบ</p><p className="text-xs text-muted-foreground">{card.detail}</p></CardContent></Card>)}</div>
    {metrics && <>
      <Card><CardHeader><CardTitle>ต้นทุน Realtime ตาม token ที่รายงาน</CardTitle></CardHeader><CardContent className="space-y-2"><p>รวม {usd(metrics.totalMeasuredRealtimeCostUsd)} · เฉลี่ย {usd(metrics.averageMeasuredRealtimeCostUsd)} ต่อรอบที่มี usage</p><p className="text-sm text-muted-foreground">มีข้อมูล {metrics.measuredCostSessions} รอบ · ขาดข้อมูล {metrics.missingCostSessions} รอบ ตัวเลขนี้คำนวณด้วยราคาที่บันทึกไว้ในระบบและยังไม่รวมค่าถอดเสียง จึงไม่ใช่ยอดเรียกเก็บสุดท้าย</p></CardContent></Card>
      <Card><CardHeader><CardTitle>รอบล่าสุด</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">เวลา</th><th className="p-2">รอบ</th><th className="p-2">สถานะ</th><th className="p-2">ใช้เวลา</th><th className="p-2">สรุป</th><th className="p-2">ต้นทุน Realtime</th></tr></thead><tbody>{metrics.recentSessions.map((session) => <tr key={session.sessionId} className="border-b"><td className="p-2">{new Date(session.createdAt).toLocaleString("th-TH")}</td><td className="p-2 font-mono">{session.sessionId.slice(0, 8)}</td><td className="p-2">{session.endReason || session.status}</td><td className="p-2">{session.consumedSeconds} วินาที</td><td className="p-2">{session.summaryAvailable ? "มี" : "ไม่มี"}</td><td className="p-2">{usd(session.measuredRealtimeCostUsd)}</td></tr>)}</tbody></table></div></CardContent></Card>
    </>}
  </div>;
}
