"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Trash2,
  QrCode,
  Copy,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  Sparkles,
  ChevronRight,
  Video,
  ExternalLink,
} from "lucide-react";
import { updateClassStatus, deleteClass, updateMeetingUrl } from "./../actions";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ClassStatusToggle({
  classId,
  initialStatus,
}: {
  classId: string;
  initialStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleStatusChange = async (status: "open" | "full" | "closed") => {
    if (status === initialStatus || loading) return;
    setLoading(true);
    try {
      await updateClassStatus(classId, status);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const statusMap = {
    open: {
      label: "รับสมัครอยู่",
      className:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
    full: {
      label: "เต็มแล้ว",
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    closed: {
      label: "ปิดแล้ว",
      className: "bg-muted text-muted-foreground border-border",
    },
  } as Record<string, { label: string; className: string }>;

  const currentStatus = statusMap[initialStatus] || statusMap["closed"];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={`flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold border transition-opacity ${currentStatus.className} ${loading ? "opacity-50" : ""}`}
      >
        {currentStatus.label}
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleStatusChange("open")}>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
            รับสมัครอยู่
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("full")}>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            เต็มแล้ว
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleStatusChange("closed")}>
          <span className="text-muted-foreground font-medium">ปิดแล้ว</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ReferralLink({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-primary" />
            ลิงก์เชิญนักเรียน (Referral)
          </div>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  โชว์ QR Code
                </Button>
              }
            />
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>QR Code สำหรับโอนเงินสมัคร</DialogTitle>
                <DialogDescription>
                  สแกนเพื่อเข้าสู่หน้าชำระเงินของคลาสนี้โดยตรง
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center p-4 space-y-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-border/50">
                  <QRCodeSVG
                    value={referralLink}
                    size={220}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="w-full flex">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={referralLink}
            className="flex-1 h-9 rounded-lg border border-input bg-muted px-3 text-xs text-foreground font-mono"
          />
          <button
            onClick={handleCopy}
            id="btn-copy-referral"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-input hover:bg-muted transition-colors"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          แชร์ลิงก์นี้ให้ผู้ปกครองสมัครและชำระเงินผ่าน LINE ได้ทันที
        </p>
      </CardContent>
    </Card>
  );
}

export function LessonPlan({ lessonPlan, classId }: { lessonPlan: string[], classId: string }) {
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const router = useRouter();

  const toggleStep = (i: number) =>
    setCheckedSteps((prev) =>
      prev.includes(i) ? prev.filter((s) => s !== i) : [...prev, i],
    );

  const progress = Math.round((checkedSteps.length / lessonPlan.length) * 100);

  return (
    <Card className="border-border/60 h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            แผนการสอน {lessonPlan.length} ขั้นตอน
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {checkedSteps.length}/{lessonPlan.length} เสร็จแล้ว
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-3">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {lessonPlan.map((step, i) => {
            const done = checkedSteps.includes(i);
            return (
              <li
                key={i}
                id={`lesson-step-${i + 1}`}
                onClick={() => toggleStep(i)}
                className={`flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-all ${
                  done ? "opacity-60" : "hover:bg-muted/60"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-all ${
                    done
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`text-sm flex-1 ${
                    done
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {step}
                </span>
                {i === 26 && (
                  <Button
                    size="xs"
                    className="h-7 text-[10px] px-2 gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/lesson/${classId}/interactive?articleId=article-default-123`);
                    }}
                  >
                    <Sparkles className="h-3 w-3" />
                    Launch
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export function DeleteClassButton({ classId }: { classId: string }) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteClass(classId);
      setOpen(false);
      router.push("/dashboard/classes");
      router.refresh();
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 gap-1.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
              Dev Only
            </span>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>ยืนยันการลบคลาส?</DialogTitle>
          <DialogDescription>
            การดำเนินการนี้จะลบข้อมูลคลาส นักเรียน และรายการชำระเงินทั้งหมดที่เกี่ยวข้องถาวรคลาสนี้ (เฉพาะโหมด DEV เท่านั้น)
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            ยกเลิก
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "กำลังลบ..." : "ยืนยันลบถาวร"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingUrlEditor({
  classId,
  initialUrl,
}: {
  classId: string;
  initialUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    setLoading(true);
    try {
      await updateMeetingUrl(classId, url);
      setOpen(false);
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Failed to update URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">ห้องเรียนออนไลน์</p>
              <p className="text-xs text-muted-foreground truncate">
                {initialUrl || "ยังไม่ได้ระบุลิงก์"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-10 px-3 text-xs bg-background font-medium"
                  >
                    แก้ไขลิงก์
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>แก้ไขลิงก์ห้องเรียน</DialogTitle>
                  <DialogDescription>
                    ระบุลิงก์ Google Meet หรือ Zoom สำหรับใช้ในคลาสนี้
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="url">ลิงก์ห้องเรียน (URL)</Label>
                    <Input
                      id="url"
                      placeholder="https://meet.google.com/xxx-xxxx-xxx"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                  <Button onClick={handleUpdate} disabled={loading || !url}>
                    {loading ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {initialUrl && (
              <a
                href={initialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button
                  id="btn-join-meeting"
                  size="sm"
                  className="w-full h-10 gap-2 shrink-0 font-medium"
                >
                  เข้าห้องเรียน <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FeatureLessonButton({
  classId,
  articleId,
}: {
  classId: string;
  articleId: string;
}) {
  const router = useRouter();

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
          <Sparkles className="h-4 w-4" />
          Interactive Feature Lesson
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          เริ่มกิจกรรมแบบ Kahoot! ให้นักเรียนมีส่วนร่วมผ่านมือถือแบบ Real-time
        </p>
        <Button 
          className="w-full gap-2 font-bold" 
          onClick={() => router.push(`/lesson/${classId}/interactive?articleId=${articleId}`)}
        >
          เริ่มสอนตอนนี้เลย
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
