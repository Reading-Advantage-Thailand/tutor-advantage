"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Gift, Copy, Check, Clock, Users, Plus, Play } from "lucide-react";
import { t } from "@/lib/i18n";
import { getBooks, getMyDemoClasses, createDemoClass, type Book, type DemoClass } from "./actions";
import Link from "next/link";

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  A2: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  B1: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  B2: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

function ReferralLinkBox({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted/60 border border-border/60">
      <span className="text-xs text-muted-foreground flex-1 truncate font-mono">{url}</span>
      <Button size="sm" variant="ghost" className="shrink-0 h-7 px-2" onClick={handleCopy}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="ml-1 text-xs">{copied ? "คัดลอกแล้ว" : "คัดลอก"}</span>
      </Button>
    </div>
  );
}

function ExpiryBadge({ expiresAt }: { expiresAt: string }) {
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  const diffM = Math.floor((diffMs % 3600000) / 60000);
  const expired = diffMs <= 0;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${expired ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
      <Clock className="h-3 w-3" />
      {expired ? "หมดอายุแล้ว" : diffH > 0 ? `หมดอายุใน ${diffH} ชม. ${diffM} นาที` : `หมดอายุใน ${diffM} นาที`}
    </span>
  );
}

export default function DemoPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [demoClasses, setDemoClasses] = useState<DemoClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [booksData, classesData] = await Promise.all([getBooks(), getMyDemoClasses()]);
        if (mounted) {
          setBooks(booksData);
          setDemoClasses(classesData);
        }
      } catch (err) {
        console.error(err);
        if (mounted) setError("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCreate = () => {
    if (!selectedBookId) return;
    setError(null);
    startCreating(async () => {
      try {
        const newClass = await createDemoClass(selectedBookId);
        setDemoClasses((prev) => [newClass, ...prev]);
        setSelectedBookId(null);
      } catch (err: any) {
        setError(err.message ?? "สร้างห้อง Demo ไม่สำเร็จ");
      }
    });
  };

  const activeClasses = demoClasses.filter((c) => new Date(c.expiresAt) > new Date());

  return (
    <div className="w-full max-w-4xl pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ห้องทดลองสอน Demo</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 font-bold">
              <Gift className="h-3 w-3" />
              ฟรี ไม่มีค่าใช้จ่าย
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">สร้างห้องทดลองสอน นักเรียนเข้าเรียนฟรีผ่านลิงก์ที่ครูส่งให้ · ห้องหมดอายุใน 24 ชม.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-200">
          {error}
        </div>
      )}

      {/* Create demo room */}
      {activeClasses.length === 0 ? (
        <Card className="border-2 border-violet-500/30 mb-6">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4 text-violet-500" />
              สร้างห้อง Demo ใหม่
            </h2>

            {loading ? (
              <div className="h-10 bg-muted/40 rounded-lg animate-pulse" />
            ) : (
              <div className="flex gap-2">
                <select
                  className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  value={selectedBookId ?? ""}
                  onChange={(e) => setSelectedBookId(e.target.value || null)}
                >
                  <option value="">เลือกหนังสือ...</option>
                  {books.map((book) => (
                    <option key={book.bookId} value={book.bookId}>
                      [{book.cefrLevel}] {book.title}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleCreate}
                  disabled={!selectedBookId || creating}
                  className="gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  {creating ? "กำลังสร้าง..." : "สร้างห้อง"}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              * ระบบจะใช้บทความแรกของหนังสือที่เลือก นักเรียนเข้าเรียนฟรีผ่านลิงก์ referral
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40 bg-amber-500/5 mb-6">
          <CardContent className="py-6 text-center flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center mb-1">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">คุณมีห้อง Demo ที่กำลังเปิดใช้งานอยู่แล้ว 1 ห้อง</p>
            <p className="text-xs text-muted-foreground">ไม่สามารถสร้างเพิ่มได้จนกว่าห้องเดิมจะหมดอายุ (หรือคุณสามารถกดลบห้องเดิมทิ้งในหน้ารายละเอียดคลาส)</p>
          </CardContent>
        </Card>
      )}

      {/* Active demo classes */}
      {!loading && activeClasses.length > 0 && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-violet-500" />
            ห้อง Demo ที่ใช้งานได้
          </h2>
          <div className="space-y-3">
            {activeClasses.map((cls) => (
              <Card key={cls.classId} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={`font-bold text-xs ${CEFR_COLORS[cls.cefrLevel] ?? "bg-muted text-muted-foreground border-border"}`}
                        >
                          CEFR {cls.cefrLevel}
                        </Badge>
                        <ExpiryBadge expiresAt={cls.expiresAt} />
                      </div>
                      <p className="font-semibold text-sm text-foreground truncate">{cls.bookTitle}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Users className="h-3 w-3" />
                        {cls.enrolledCount} / {cls.capacity} นักเรียน
                      </div>
                    </div>
                    <Link href={`/lesson/${cls.classId}/interactive`}>
                      <Button size="sm" className="gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white shrink-0">
                        <Play className="h-3.5 w-3.5 fill-current" />
                        เริ่มสอน
                      </Button>
                    </Link>
                  </div>

                  {cls.referralToken && <ReferralLinkBox token={cls.referralToken} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!loading && demoClasses.length === 0 && (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            ยังไม่มีห้อง Demo — เลือกหนังสือและกด &quot;สร้างห้อง&quot; ด้านบน
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="border-border/40 bg-card/50 mt-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            {t("demo.infoTitle")}
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {[
              "สร้างห้อง Demo ได้ทุกเวลา เลือกหนังสือได้เอง ระบบใช้บทเรียนแรกของหนังสือ",
              "นักเรียนเข้าเรียนฟรีผ่านลิงก์ referral ที่ครูส่งให้ — ไม่ต้องจ่ายเงิน",
              "ห้องหมดอายุอัตโนมัติใน 24 ชม. หลังสร้าง ข้อมูลการเรียนจะถูกบันทึกปกติ",
            ].map((line) => (
              <li key={line} className="flex gap-2.5 items-start">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
