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
  const resetButton = <button type="button" disabled={busy || state.paused} className="shrink-0 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs font-semibold leading-tight text-danger-fg transition-colors hover:bg-danger-bg/70 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void resetAssessment()}>
    <span className="flex items-center justify-center gap-1.5"><RotateCcw className="size-3.5" />{confirmReset ? "ยืนยันรีเซ็ต" : "[DEV] Reset คะแนน"}</span>
  </button>;
  return <section className="rounded-xl border border-hairline bg-surface p-4 shadow-card" aria-label="เลือกกิจกรรมใน Lobby">
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        <p className="text-[0.8125rem] text-fg-muted">กิจกรรมใน Lobby</p>
        <h2 className="mt-0.5 text-base font-semibold leading-tight text-fg">วันนี้ทำกิจกรรมอะไร?</h2>
      </div>
      <span className="rounded-full border border-brand-soft-border bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-fg">{stateLabel}</span>
    </div>
    <div className="grid grid-cols-3 gap-1 rounded-lg bg-fill-muted p-1">{([["LESSON", "เรียนตาม Lesson"], ["PRE", "ประเมินก่อนเรียน"], ["POST", "ประเมินหลังเรียน"]] as [AssessmentMode, string][]).map(([mode, label]) => <button key={mode} aria-pressed={state.mode === mode} disabled={busy || running || state.paused || (mode === "PRE" && state.postOpened)} className={`min-h-9 rounded-md px-2 py-1.5 text-[0.8125rem] font-medium leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${state.mode === mode ? "bg-surface text-fg shadow-xs" : "text-fg-muted hover:text-fg"}`} onClick={() => { setConfirmFinish(false); setConfirmReset(false); void onControl({ action: "select", mode, revision: state.revision }); }}>{label}</button>)}</div>
    <div>
    {error && <p role="alert" className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-fg">{error}</p>}
    {state.paused && <p role="status" className="mt-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm text-warning-fg">กำลังเชื่อมต่อห้อง กรุณารอ</p>}
    {state.mode === "LESSON" && <div className="mt-3 flex items-start gap-3 rounded-lg bg-surface-muted p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tile-brand text-icon-brand"><BookOpen size={18} aria-hidden="true" /></div>
      <div className="min-w-0"><p className="text-sm font-semibold text-fg">พร้อมเริ่มบทเรียน</p>
      <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-fg-muted">รอให้นักเรียนเข้าห้องและกด Ready ครบ แล้วกดปุ่มเริ่มสอนด้านล่าง</p></div>
    </div>}
    {state.mode !== "LESSON" && <div className="mt-2 space-y-2">
      <p className="text-[0.8125rem] leading-snug text-fg-muted">{state.articleTitle || "แบบประเมินประจำบท"} · 15 ข้อ · นักเรียนทำเอง ครูดูความคืบหน้า</p>
      {state.status === "LOBBY" && <div className="space-y-2">
        <p className="rounded-lg bg-surface-muted px-3 py-2 text-[0.8125rem] text-fg">{state.mode === "POST" ? "เริ่มหลังเรียนแล้ว จะกลับไปทำก่อนเรียนไม่ได้" : "แนะนำให้ทำก่อนเริ่มสอนเนื้อหา"}</p>
        <p className="px-1 text-[0.8125rem] leading-relaxed text-fg-muted">เลือกกิจกรรมไว้แล้ว เมื่อทุกคนพร้อมให้เริ่มพร้อมกันจากปุ่มด้านล่าง</p>
        {devMode && <div className="flex justify-end">{resetButton}</div>}
        {devMode && confirmReset && <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-fg">[DEV] การรีเซ็ตจะลบผล PRE/POST และคำตอบร่างของทุกคนในบทนี้ กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}
      </div>}
      {state.status !== "LOBBY" && <>
        <button
          type="button"
          onClick={() => setIsProgressDialogOpen(true)}
          className="w-full rounded-lg border border-hairline bg-surface-muted p-3 text-left transition-colors hover:border-hairline-strong hover:bg-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-haspopup="dialog"
          aria-label="ดูความคืบหน้าของนักเรียนทั้งหมด"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-tile-brand text-icon-brand"><UsersRound size={16} aria-hidden="true" /></span>
              <div className="min-w-0">
                <p role="status" className="font-semibold leading-tight text-fg">ส่งครบแล้ว {done}/{state.progress.length} คน</p>
                <p className="sr-only">ความคืบหน้าเฉลี่ยของทั้งห้อง</p>
              </div>
            </div>
            <span className="shrink-0 text-lg font-bold tabular-nums text-brand-fg">{averageProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-muted">
            <div className="h-full rounded-full bg-brand-vivid transition-[width] duration-700 ease-out" style={{ width: `${averageProgress}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs font-medium leading-tight text-fg-muted">
            <span aria-hidden="true">ดูรายละเอียด</span><span className="sr-only">กดเพื่อดูรายละเอียดนักเรียนทั้งหมด</span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-brand-fg" />
          </div>
        </button>

        {isProgressDialogOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="assessment-progress-title" aria-describedby="assessment-progress-description">
          <button type="button" aria-label="ปิดรายละเอียดความคืบหน้า" className="absolute inset-0 bg-black/50" onClick={() => setIsProgressDialogOpen(false)} />
          <div className="relative z-10 grid max-h-[85dvh] w-full max-w-lg overflow-hidden rounded-xl border border-hairline bg-surface-elevated shadow-popover">
            <div className="border-b border-hairline px-5 py-4 pr-12">
              <h3 id="assessment-progress-title" className="flex items-center gap-2 text-lg font-semibold text-fg">
                <UsersRound aria-hidden="true" className="size-5 text-brand-fg" /> ความคืบหน้านักเรียน
              </h3>
              <p id="assessment-progress-description" className="mt-1 text-sm text-fg-muted">
                แบบประเมิน {state.mode === "PRE" ? "ก่อนเรียน" : "หลังเรียน"} · {questionCount} ข้อ
              </p>
              <button type="button" aria-label="ปิด" onClick={() => setIsProgressDialogOpen(false)} className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-press hover:text-fg">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-px border-b border-hairline bg-hairline">
              <div className="bg-surface-elevated px-5 py-3">
                <p className="text-xs text-fg-muted">ส่งครบแล้ว</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-fg">{done}<span className="text-sm font-medium text-fg-muted">/{state.progress.length} คน</span></p>
              </div>
              <div className="bg-surface-elevated px-5 py-3">
                <p className="text-xs text-fg-muted">ความคืบหน้าเฉลี่ย</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-brand-fg">{averageProgress}%</p>
              </div>
            </div>
            <div className="max-h-[50dvh] space-y-2 overflow-y-auto p-4">
              {state.progress.length === 0 ? (
                <p className="rounded-lg bg-surface-muted p-4 text-center text-sm text-fg-muted">ยังไม่มีนักเรียนในแบบประเมินนี้</p>
              ) : state.progress.map((student) => {
                const studentProgress = progressForStudent(student);
                const status = student.previouslyCompleted
                  ? "มีผลแล้ว"
                  : student.completed
                    ? `ครบ ${questionCount} ข้อ`
                    : `${student.answered}/${questionCount} ข้อ`;
                return <div key={student.studentId} className="rounded-lg border border-hairline bg-surface p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-fg">{student.name}{student.connected === false ? " · หลุดจากห้อง" : ""}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-fg-muted">{status}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill-muted">
                    <div className="h-full rounded-full bg-brand-vivid transition-[width] duration-500" style={{ width: `${studentProgress}%` }} />
                  </div>
                </div>;
              })}
            </div>
          </div>
        </div>}
        {running && <div className="space-y-2">{confirmFinish && <p className="rounded-lg border border-warning-border bg-warning-bg px-3 py-2 text-sm leading-relaxed text-warning-fg">ยังมีคนตอบไม่ครบ ระบบจะสรุปคะแนนเฉพาะคนที่ครบ 15 ข้อ และหยุดรับคำตอบทุกคน</p>}<div className="flex items-stretch gap-2"><button disabled={busy || state.paused} className="min-w-0 flex-1 rounded-lg bg-brand-solid px-5 py-2.5 font-semibold leading-tight text-on-brand transition-colors hover:bg-brand-solid/90 disabled:cursor-not-allowed disabled:opacity-50" onClick={async () => {
          if (done < state.progress.length && !confirmFinish) { setConfirmFinish(true); return; }
          if (await onControl({ action: "finish", revision: state.revision })) setConfirmFinish(false);
        }}>{busy ? "กำลังสรุปผล…" : confirmFinish ? "ยืนยันจบ แม้ยังมีคนไม่ครบ" : "จบแบบประเมินและสรุปผล"}</button>{devMode && resetButton}</div>{confirmFinish && <button className="w-full py-1 text-sm text-fg-muted underline" onClick={() => setConfirmFinish(false)}>รอต่อ</button>}{devMode && confirmReset && <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-fg">[DEV] การรีเซ็ตจะหยุดแบบทดสอบนี้ และลบผล PRE/POST กับคำตอบร่างของทุกคน กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}</div>}
        {state.status === "FINISHED" && <><p className="rounded-lg border border-success-border bg-success-bg px-3 py-2 text-sm leading-relaxed text-success-fg">สรุปผลแล้ว ดูรายงานในหน้าคลาส หรือเลือก “เรียนตาม Lesson” เพื่อเรียนต่อในห้องเดิม</p>{devMode && <div className="mt-2 flex justify-end">{resetButton}</div>}{devMode && confirmReset && <p className="mt-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs leading-relaxed text-danger-fg">[DEV] การรีเซ็ตจะลบผล PRE/POST และคำตอบร่างของทุกคนในบทนี้ กด “ยืนยันรีเซ็ต” อีกครั้งเพื่อดำเนินการ</p>}</>}
      </>}
    </div>}
    </div>
  </section>;
}
