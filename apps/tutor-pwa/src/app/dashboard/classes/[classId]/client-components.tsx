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

export function LessonPlan({ classId, articleId, meetingUrl }: { classId: string; articleId?: string; meetingUrl?: string }) {
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const router = useRouter();

  const phases = [
    {
      id: 1,
      title: "Phase 1: Warm-up & Prep",
      description: "ต้อนรับนักเรียน เช็คชื่อ และทบทวนคำศัพท์สำคัญ",
      time: "5-10 นาที",
      actions: [
        "เช็คชื่อและเตรียมความพร้อมนักเรียน (Roll Call)",
        "ทบทวนคำศัพท์และบทเรียนจากสัปดาห์ที่แล้ว",
        "เกริ่นหัวข้อและเป้าหมายการเรียนรู้วันนี้"
      ],
      link: meetingUrl ? { label: "เข้าห้องเรียน (Meeting Room)", url: meetingUrl } : null
    },
    {
      id: 2,
      title: "Phase 2: Engage & Read",
      description: "เจาะลึกบทความ และอภิปรายคำศัพท์ใหม่ร่วมกัน",
      time: "15-20 นาที",
      actions: [
        "อ่านบทความร่วมกันแบบออกเสียง (Read-Aloud)",
        "วิเคราะห์คำศัพท์และความหมายของบทความ",
        "ตอบคำถามวัดความเข้าใจ (Comprehension Questions)"
      ]
    },
    {
      id: 3,
      title: "Phase 3: Interactive Lesson",
      description: "เริ่มคลาสเรียนอัจฉริยะแบบ Interactive Real-time",
      time: "15-20 นาที",
      actions: [
        "สแกนเข้าห้องเรียนอัจฉริยะ (Kahoot-style)",
        "ฝึกฝนทักษะการตอบคำถามแบบ Real-time",
        "สะสมคะแนนจากกิจกรรมสนุกๆ ร่วมกัน"
      ],
      link: {
        label: "เปิดห้องเรียน Interactive",
        url: `/lesson/${classId}/interactive?articleId=${articleId || "article-default-123"}`
      }
    },
    {
      id: 4,
      title: "Phase 4: Wrap-up & Practice",
      description: "สรุปผลการเรียนรู้ ฝึกฝนไวยากรณ์ และมอบหมายการบ้าน",
      time: "10 นาที",
      actions: [
        "สรุปประเด็นหลักและข้อผิดพลาดที่พบบ่อย",
        "ฝึกฝนแบบฝึกหัด Grammar ในแอป",
        "มอบหมายการบ้านและตอบข้อสงสัยเพิ่มเติม"
      ]
    }
  ];

  const togglePhaseComplete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedPhases((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const isCompleted = (id: number) => completedPhases.includes(id);

  return (
    <Card className="border-border/60 bg-gradient-to-br from-background via-background to-primary/5 h-full overflow-hidden shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2.5 text-foreground">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <BookOpen className="h-4.5 w-4.5" />
              </span>
              แผนการจัดการเรียนรู้ (Lesson Flow Dashboard)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              สเต็ปการสอน 4 เฟส ช่วยให้คุณครูจัดกิจกรรมได้ไหลลื่นและมีประสิทธิภาพ
            </p>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 p-1.5 rounded-xl border border-border/50 shrink-0 self-start sm:self-center">
            <span className="text-xs font-semibold text-muted-foreground px-1.5">
              เสร็จสิ้น {completedPhases.length}/{phases.length}
            </span>
            <div className="w-24 bg-background border rounded-full h-2 overflow-hidden shrink-0">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(completedPhases.length / phases.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-6">
        {phases.map((phase) => {
          const done = isCompleted(phase.id);
          const active = activePhase === phase.id;

          return (
            <div
              key={phase.id}
              onClick={() => setActivePhase(active ? null : phase.id)}
              className={`group border rounded-xl p-4 transition-all duration-300 relative overflow-hidden cursor-pointer ${
                active
                  ? "border-primary/40 bg-primary/[0.03] shadow-md ring-1 ring-primary/20"
                  : done
                  ? "border-emerald-500/30 bg-emerald-500/[0.02] opacity-85 hover:opacity-100"
                  : "border-border/50 bg-background hover:bg-muted/30 hover:border-border"
              }`}
            >
              {/* Background accent */}
              <div
                className={`absolute top-0 bottom-0 left-0 w-1.5 transition-all duration-300 ${
                  active ? "bg-primary" : done ? "bg-emerald-500" : "bg-transparent group-hover:bg-muted"
                }`}
              />

              <div className="pl-3 flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-md border border-border/40">
                      {phase.time}
                    </span>
                    {done && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-0.5 animate-pulse">
                        <CheckCircle2 className="h-3 w-3" /> COMPLETED
                      </span>
                    )}
                  </div>

                  <h3 className={`text-sm font-bold mt-1.5 transition-colors ${active ? "text-primary" : done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {phase.title}
                  </h3>
                  <p className="text-xs text-muted-foreground font-normal">
                    {phase.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
                  <button
                    onClick={(e) => togglePhaseComplete(phase.id, e)}
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                      done
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                    }`}
                    title={done ? "Mark as Incomplete" : "Mark as Complete"}
                  >
                    {done ? (
                      <CheckCircle2 className="h-4.5 w-4.5 stroke-[2.5]" />
                    ) : (
                      <span className="text-xs font-bold font-mono">{phase.id}</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Action details */}
              {active && (
                <div className="mt-4 pt-3.5 border-t border-border/40 pl-3 space-y-3 animate-in slide-in-from-top-1 duration-200">
                  <ul className="space-y-1.5">
                    {phase.actions.map((act, idx) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2 leading-relaxed">
                        <span className="text-primary mt-1">•</span>
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>

                  {phase.link && (
                    <div className="pt-2">
                      {phase.id === 3 ? (
                        <Button
                          size="sm"
                          className="w-full sm:w-auto h-9 text-xs gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all duration-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(phase.link!.url);
                          }}
                        >
                          <Sparkles className="h-4 w-4 fill-current" />
                          {phase.link.label}
                        </Button>
                      ) : (
                        <a
                          href={phase.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-block"
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs gap-2 font-medium bg-background border-border hover:bg-primary/5 hover:border-primary/30 transition-all"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {phase.link.label}
                          </Button>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
