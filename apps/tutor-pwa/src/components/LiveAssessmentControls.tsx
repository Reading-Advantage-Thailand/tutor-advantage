"use client";

import React, { useState } from "react";
import type { AssessmentControl, AssessmentMode, LiveAssessmentState } from "@tutor-advantage/shared-config";
import { BookOpen, ChevronRight, RotateCcw, UsersRound, X } from "lucide-react";

export default function LiveAssessmentControls({ state, busy, error, onControl, devMode = process.env.NODE_ENV === "development" }: { state: LiveAssessmentState | null; busy: boolean; error: string; onControl: (control: AssessmentControl) => Promise<boolean>; devMode?: boolean }) {
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  React.useEffect(() => {
    if (!isProgressDialogOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsProgressDialogOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isProgressDialogOpen]);
  if (!state?.supported) return error ? <p role="alert" className="text-destructive">{error}</p> : null;
  const done = state.progress.filter(p => p.completed).length;
  const questionCount = state.items.length || 15;
  const progressForStudent = (student: LiveAssessmentState["progress"][number]) =>
    student.completed || student.previouslyCompleted
      ? 100
      : Math.min(100, Math.round((student.answered / questionCount) * 100));
  const averageProgress = state.progress.length
    ? Math.round(state.progress.reduce((total, student) => total + progressForStudent(student), 0) / state.progress.length)
    : 0;
  const running = state.mode !== "LESSON" && state.status === "RUNNING";
  const stateLabel = state.status === "RUNNING" ? "กำลังทำ" : state.status === "FINISHED" ? "สรุปแล้ว" : "เลือกแล้ว";
  const resetAssessment = async () => {
    if (!confirmReset) {
      setConfirmFinish(false);
      setConfirmReset(true);
      return;
    }
    if (await onControl({ action: "reset", revision: state.revision })) setConfirmReset(false);
  };
  const resetButton = <button type="button" disabled={busy || state.paused} className="shrink-0 rounded-xl border border-rose-500/45 bg-rose-500/10 px-3 py-2.5 text-xs font-bold leading-tight text-rose-700 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300" onClick={() => void resetAssessment()}>
    <span className="flex items-center justify-center gap-1.5"><RotateCcw className="size-3.5" />{confirmReset ? "ยืนยันรีเซ็ต" : "[DEV] Reset คะแนน"}</span>
  </button>;
  return <section className="h-full overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-3 shadow-lg shadow-slate-950/5 sm:p-3.5 lg:flex lg:h-[22rem] lg:flex-col" aria-label="เลือกกิจกรรมใน Lobby">
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Lobby activity</p>
        <h2 className="mt-0.5 text-base font-bold leading-tight text-foreground">วันนี้ทำกิจกรรมอะไร?</h2>
      </div>
      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{stateLabel}</span>
    </div>
    <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/40 bg-muted/40 p-1">{([["LESSON", "เรียนตาม Lesson"], ["PRE", "ประเมินก่อนเรียน"], ["POST", "ประเมินหลังเรียน"]] as [AssessmentMode, string][]).map(([mode, label]) => <button key={mode} aria-pressed={state.mode === mode} disabled={busy || running || state.paused || (mode === "PRE" && state.postOpened)} className={`min-h-9 rounded-lg px-2 py-1.5 text-[11px] font-bold leading-tight transition-colors sm:text-xs disabled:cursor-not-allowed disabled:opacity-50 ${state.mode === mode ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-background hover:text-foreground"}`} onClick={() => { setConfirmFinish(false); setConfirmReset(false); void onControl({ action: "select", mode, revision: state.revision }); }}>{label}</button>)}</div>
    <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
    {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {state.paused && <p role="status" className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">กำลังเชื่อมต่อห้อง กรุณารอ</p>}
    {state.mode === "LESSON" && <div className="mt-3 flex min-h-[148px] flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 px-5 text-center">
      <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpen size={18} /></div>
      <p className="font-bold text-foreground">พร้อมเริ่มบทเรียน</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">รอให้นักเรียนเข้าห้องและกด Ready ครบ แล้วกดปุ่มเริ่มสอนด้านล่าง</p>
    </div>}
    {state.mode !== "LESSON" && <div className="mt-2 space-y-2">
      <p className="text-xs leading-snug text-muted-foreground">Primary Origins 2 · 15 ข้อ · นักเรียนทำเอง ครูดูความคืบหน้า</p>
      {state.status === "LOBBY" && <div className="space-y-2">
        <p className="rounded-xl bg-muted/35 px-3 py-2 text-xs text-foreground">{state.mode === "POST" ? "เริ่มหลังเรียนแล้ว จะกลับไปทำก่อนเรียนไม่ได้" : "แนะนำให้ทำก่อนเริ่มสอนเนื้อหา"}</p>
        <p className="px-1 text-xs leading-relaxed text-muted-foreground">เลือกกิจกรรมไว้แล้ว เมื่อทุกคนพร้อมให้เริ่มพร้อมกันจากปุ่มด้านล่าง</p>
        {devMode && <div className="flex justify-end">{resetButton}</div>}
        {devMode && confirmReset && <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-800 dark:text-rose-200">[DEV] การรีเซ็ตจะลบผล PRE/POST และคำตอบร่างของทุกคนในเล่มนี้ กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}
      </div>}
      {state.status !== "LOBBY" && <>
        <button
          type="button"
          onClick={() => setIsProgressDialogOpen(true)}
          className="w-full rounded-xl border border-border/60 bg-muted/20 p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-haspopup="dialog"
          aria-label="ดูความคืบหน้าของนักเรียนทั้งหมด"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UsersRound size={16} /></span>
              <div className="min-w-0">
                <p role="status" className="font-bold leading-tight text-foreground">ส่งครบแล้ว {done}/{state.progress.length} คน</p>
                <p className="sr-only">ความคืบหน้าเฉลี่ยของทั้งห้อง</p>
              </div>
            </div>
            <span className="shrink-0 text-lg font-black tabular-nums text-primary">{averageProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/80 shadow-inner">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary transition-[width] duration-700 ease-out" style={{ width: `${averageProgress}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs font-semibold leading-tight text-muted-foreground">
            <span aria-hidden="true">ดูรายละเอียด</span><span className="sr-only">กดเพื่อดูรายละเอียดนักเรียนทั้งหมด</span>
            <ChevronRight className="size-4 shrink-0 text-primary" />
          </div>
        </button>

        {isProgressDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="assessment-progress-title" aria-describedby="assessment-progress-description">
          <button type="button" aria-label="ปิดรายละเอียดความคืบหน้า" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsProgressDialogOpen(false)} />
          <div className="relative z-10 grid max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/40">
            <div className="border-b border-border/60 px-5 py-4 pr-12">
              <h3 id="assessment-progress-title" className="flex items-center gap-2 text-lg font-bold text-foreground">
                <UsersRound className="size-5 text-primary" /> ความคืบหน้านักเรียน
              </h3>
              <p id="assessment-progress-description" className="mt-1 text-sm text-muted-foreground">
                แบบประเมิน {state.mode === "PRE" ? "ก่อนเรียน" : "หลังเรียน"} · {questionCount} ข้อ
              </p>
              <button type="button" aria-label="ปิด" onClick={() => setIsProgressDialogOpen(false)} className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-px border-b border-border/60 bg-border/60">
              <div className="bg-card px-5 py-3">
                <p className="text-xs text-muted-foreground">ส่งครบแล้ว</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-foreground">{done}<span className="text-sm font-semibold text-muted-foreground">/{state.progress.length} คน</span></p>
              </div>
              <div className="bg-card px-5 py-3">
                <p className="text-xs text-muted-foreground">ความคืบหน้าเฉลี่ย</p>
                <p className="mt-0.5 text-lg font-black tabular-nums text-primary">{averageProgress}%</p>
              </div>
            </div>
            <div className="max-h-[50dvh] space-y-2 overflow-y-auto p-4">
              {state.progress.length === 0 ? (
                <p className="rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">ยังไม่มีนักเรียนในแบบประเมินนี้</p>
              ) : state.progress.map((student) => {
                const studentProgress = progressForStudent(student);
                const status = student.previouslyCompleted
                  ? "มีผลแล้ว"
                  : student.completed
                    ? `ครบ ${questionCount} ข้อ`
                    : `${student.answered}/${questionCount} ข้อ`;
                return <div key={student.studentId} className="rounded-xl border border-border/60 bg-muted/15 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-foreground">{student.name}{student.connected === false ? " · หลุดจากห้อง" : ""}</span>
                    <span className="shrink-0 font-bold tabular-nums text-muted-foreground">{status}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/80">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${studentProgress}%` }} />
                  </div>
                </div>;
              })}
            </div>
          </div>
        </div>}
        {running && <div className="space-y-2">{confirmFinish && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm leading-relaxed text-amber-800 dark:text-amber-200">ยังมีคนตอบไม่ครบ ระบบจะสรุปคะแนนเฉพาะคนที่ครบ 15 ข้อ และหยุดรับคำตอบทุกคน</p>}<div className="flex items-stretch gap-2"><button disabled={busy || state.paused} className="min-w-0 flex-1 rounded-xl bg-primary px-5 py-2.5 font-bold leading-tight text-primary-foreground shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" onClick={async () => {
          if (done < state.progress.length && !confirmFinish) { setConfirmFinish(true); return; }
          if (await onControl({ action: "finish", revision: state.revision })) setConfirmFinish(false);
        }}>{busy ? "กำลังสรุปผล…" : confirmFinish ? "ยืนยันจบ แม้ยังมีคนไม่ครบ" : "จบแบบประเมินและสรุปผล"}</button>{devMode && resetButton}</div>{confirmFinish && <button className="w-full py-1 text-sm text-muted-foreground underline" onClick={() => setConfirmFinish(false)}>รอต่อ</button>}{devMode && confirmReset && <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-800 dark:text-rose-200">[DEV] การรีเซ็ตจะหยุดแบบทดสอบนี้ และลบผล PRE/POST กับคำตอบร่างของทุกคน กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}</div>}
        {state.status === "FINISHED" && <><p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">สรุปผลแล้ว ดูรายงานในหน้าคลาส หรือเลือก “เรียนตาม Lesson” เพื่อเรียนต่อในห้องเดิม</p>{devMode && <div className="mt-2 flex justify-end">{resetButton}</div>}{devMode && confirmReset && <p className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs leading-relaxed text-rose-800 dark:text-rose-200">[DEV] การรีเซ็ตจะลบผล PRE/POST และคำตอบร่างของทุกคนในเล่มนี้ กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}</>}
      </>}
    </div>}
    </div>
  </section>;
}
