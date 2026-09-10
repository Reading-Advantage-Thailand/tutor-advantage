"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assessmentAction } from "./assessment-actions";
import {
  ASSESSMENT_SKILLS,
  completedAssessmentAttempt,
  summarizeAssessment,
  type AssessmentReportData,
  type AssessmentStudent,
} from "./assessment-report-summary";

function formatAverage(value: number | null, maximum: number) {
  return value === null ? "—" : `${value.toFixed(1)}/${maximum}`;
}

function MiniSkillChart({ summary }: { summary: ReturnType<typeof summarizeAssessment> }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3.5" aria-label="กราฟคะแนนเฉลี่ยรายทักษะก่อนและหลังเรียน">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-foreground">คะแนนเฉลี่ยรายทักษะ</p>
        <div className="flex items-center gap-3 text-[10px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-slate-400" />ก่อนเรียน</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />หลังเรียน</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {summary.skillAverages.map((skill) => (
          <div key={skill.key} className="grid grid-cols-[4.25rem_1fr_3.25rem] items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground">{skill.label}</span>
            <div className="space-y-1" aria-hidden="true">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-slate-400 transition-[width]" style={{ width: `${((skill.pre || 0) / 5) * 100}%` }} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${((skill.post || 0) / 5) * 100}%` }} />
              </div>
            </div>
            <span className="text-right text-[10px] font-bold tabular-nums text-foreground">
              {skill.pre === null && skill.post === null ? "ยังไม่มีผล" : `${skill.pre?.toFixed(1) || "—"} → ${skill.post?.toFixed(1) || "—"}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentResult({ student, cycleId, articleId }: { student: AssessmentStudent; cycleId: string; articleId?: string }) {
  const pre = completedAssessmentAttempt(student, "PRE", articleId);
  const post = completedAssessmentAttempt(student, "POST", articleId);
  const target = post || pre;
  const [comment, setComment] = useState(target?.teacherComment || "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const difference = pre && post ? (post.total || 0) - (pre.total || 0) : null;

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground">{student.displayName || "นักเรียน"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            ก่อนเรียน <strong className="text-foreground">{pre ? `${pre.total}/15` : "ยังไม่มีผล"}</strong>
            <span className="px-1.5">→</span>
            หลังเรียน <strong className="text-foreground">{post ? `${post.total}/15` : "ยังไม่มีผล"}</strong>
          </p>
        </div>
        {difference !== null && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${difference > 0 ? "bg-emerald-500/10 text-emerald-600" : difference < 0 ? "bg-amber-500/10 text-amber-700" : "bg-muted text-muted-foreground"}`}>
            {difference > 0 ? `+${difference} ข้อ` : difference === 0 ? "คะแนนคงที่" : `${difference} ข้อ`}
          </span>
        )}
      </div>

      {target ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {ASSESSMENT_SKILLS.map(({ key, label }) => (
              <div key={key} className="rounded-xl bg-muted/50 p-2.5 text-center">
                <p className="text-muted-foreground">{label}</p>
                <p className="mt-1 font-black tabular-nums text-foreground">{pre?.scores?.[key] ?? "—"} → {post?.scores?.[key] ?? "—"}</p>
              </div>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold text-foreground">
            คำแนะนำจากครู
            <textarea
              className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              value={comment}
              maxLength={2000}
              placeholder="เขียนคำแนะนำที่นักเรียนจะเห็น…"
              onChange={(event) => { setComment(event.target.value); setStatus(""); }}
            />
          </label>
          <div className="mt-2 flex items-center justify-end gap-3">
            {status && <p role="status" className="text-xs text-muted-foreground">{status}</p>}
            <Button
              className="h-9 rounded-xl px-4 font-bold"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setStatus("");
                try {
                  await assessmentAction(cycleId, "comment", { attemptId: target.attemptId, comment });
                  setStatus("บันทึกแล้ว");
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "กำลังบันทึก…" : "บันทึกคำแนะนำ"}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">ยังไม่มีผลการประเมินของนักเรียนคนนี้</p>
      )}
    </article>
  );
}

export default function AssessmentReport({ cycleId }: { cycleId: string }) {
  const [report, setReport] = useState<AssessmentReportData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState("");

  async function refresh(showProgress = true) {
    setError("");
    if (showProgress) setRefreshing(true);
    try {
      setReport(await assessmentAction(cycleId, "report"));
    } catch (error) {
      setError(error instanceof Error ? error.message : "โหลดไม่สำเร็จ");
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    assessmentAction(cycleId, "report")
      .then((data) => { if (active) setReport(data); })
      .catch((error) => { if (active) setError(error instanceof Error ? error.message : "โหลดไม่สำเร็จ"); });
    return () => { active = false; };
  }, [cycleId]);

  useEffect(() => {
    if (!report?.articles?.length) return;
    if (!report.articles.some((article) => article.articleId === selectedArticleId)) {
      const withResults = report.articles.find((article) => report.students.some((student) => student.attempts.some((attempt) => attempt.articleId === article.articleId && attempt.submittedAt)));
      setSelectedArticleId(withResults?.articleId || report.articles[0].articleId);
    }
  }, [report, selectedArticleId]);

  const selectedArticle = report?.articles?.find((article) => article.articleId === selectedArticleId);
  const scopedReport = useMemo(() => report ? {
    ...report,
    students: report.students.map((student) => ({
      ...student,
      attempts: student.attempts.filter((attempt) => !selectedArticleId || !attempt.articleId || attempt.articleId === selectedArticleId),
    })),
  } : null, [report, selectedArticleId]);
  const summary = useMemo(() => scopedReport ? summarizeAssessment(scopedReport) : null, [scopedReport]);
  const averageChange = summary && summary.preAverage !== null && summary.postAverage !== null
    ? summary.postAverage - summary.preAverage
    : null;

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-sm">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,1.15fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10"><TrendingUp className="size-4" /></span>
              {report?.title || "ผลการประเมิน"}
            </div>
            <h2 className="mt-2 text-lg font-black text-foreground">พัฒนาการก่อน–หลังเรียน</h2>
            {(report?.articles?.length || 0) > 1 && (
              <select
                aria-label="เลือกบทเรียนสำหรับดูผลประเมิน"
                value={selectedArticleId}
                onChange={(event) => setSelectedArticleId(event.target.value)}
                className="mt-2 h-9 max-w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                {report?.articles?.map((article) => <option key={article.articleId} value={article.articleId}>{article.title}</option>)}
              </select>
            )}
            {selectedArticle && (report?.articles?.length || 0) === 1 && <p className="mt-1 text-xs text-muted-foreground">{selectedArticle.title}</p>}
            {error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>
            ) : !summary ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">กำลังโหลดผลประเมิน…</p>
            ) : (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-muted/40 p-2.5">
                  <p className="text-[10px] font-semibold text-muted-foreground">ก่อนเรียน</p>
                  <p className="mt-0.5 text-base font-black tabular-nums text-foreground">{formatAverage(summary.preAverage, 15)}</p>
                  <p className="text-[10px] text-muted-foreground">{summary.preCompleted}/{summary.totalStudents} คน</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-2.5">
                  <p className="text-[10px] font-semibold text-primary">หลังเรียน</p>
                  <p className="mt-0.5 text-base font-black tabular-nums text-primary">{formatAverage(summary.postAverage, 15)}</p>
                  <p className="text-[10px] text-muted-foreground">{summary.postCompleted}/{summary.totalStudents} คน</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-2.5">
                  <p className="text-[10px] font-semibold text-emerald-700">เปลี่ยนแปลง</p>
                  <p className="mt-0.5 text-base font-black tabular-nums text-emerald-600">{averageChange === null ? "—" : `${averageChange >= 0 ? "+" : ""}${averageChange.toFixed(1)}`}</p>
                  <p className="text-[10px] text-muted-foreground">เทียบได้ {summary.paired} คน</p>
                </div>
              </div>
            )}
          </div>

          {summary && <MiniSkillChart summary={summary} />}

          <div className="flex gap-2 lg:flex-col">
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-xl"
              aria-label="รีเฟรชผลประเมิน"
              title="รีเฟรชผล"
              disabled={refreshing}
              onClick={() => { void refresh(); }}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button className="h-11 flex-1 gap-2 rounded-xl px-4 font-bold lg:flex-none" disabled={!report} onClick={() => setDialogOpen(true)}>
              ดูรายละเอียดทั้งห้อง <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-5xl overflow-hidden rounded-3xl p-0 sm:max-w-5xl">
          <DialogHeader className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-background to-background px-5 py-5 pr-14 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><BarChart3 className="size-5" /></span>
              <div>
                <DialogTitle className="text-lg font-black">รายละเอียดพัฒนาการทั้งห้อง</DialogTitle>
                <DialogDescription className="mt-1">{selectedArticle?.title || "คะแนนก่อน–หลังเรียนรายคน"} · คำแนะนำที่นักเรียนจะเห็น</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="max-h-[calc(90dvh-6.5rem)] overflow-y-auto bg-muted/20 p-4 sm:p-6">
            {summary && (
              <div className="mb-4 grid gap-3 sm:grid-cols-4">
                {[
                  ["นักเรียนทั้งหมด", `${summary.totalStudents} คน`, UsersRound],
                  ["ทำก่อนเรียน", `${summary.preCompleted} คน`, CheckCircle2],
                  ["ทำหลังเรียน", `${summary.postCompleted} คน`, CheckCircle2],
                  ["มีผลเปรียบเทียบ", `${summary.paired} คน`, TrendingUp],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-2xl border border-border/60 bg-card p-3.5">
                    <Icon className="size-4 text-primary" />
                    <p className="mt-2 text-xs text-muted-foreground">{String(label)}</p>
                    <p className="mt-0.5 text-lg font-black text-foreground">{String(value)}</p>
                  </div>
                ))}
              </div>
            )}
            {!report?.students.length ? (
              <div className="rounded-2xl border-2 border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">ยังไม่มีนักเรียนที่มีสิทธิ์เรียนเล่มนี้</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {report.students.map((student) => (
                  <StudentResult
                    key={`${student.userId}-${selectedArticleId}-${completedAssessmentAttempt(student, "POST", selectedArticleId)?.attemptId || completedAssessmentAttempt(student, "PRE", selectedArticleId)?.attemptId || "empty"}`}
                    student={student}
                    cycleId={cycleId}
                    articleId={selectedArticleId || undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
