"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, TrendingUp, UsersRound } from "lucide-react";
import { Chip, EmptyState, Sheet, Skeleton, StatCard, TextAreaField, fieldControlClass } from "@/components/app";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { assessmentAction } from "./assessment-actions";
import {
  ASSESSMENT_SKILLS,
  completedAssessmentAttempt,
  summarizeAssessment,
  type AssessmentReportData,
  type AssessmentStudent,
} from "./assessment-report-summary";

const PEOPLE = t("tutorClass.classes.peopleUnit");

function formatAverage(value: number | null, maximum: number) {
  return value === null ? "–" : `${formatNumber(value, 1)}/${maximum}`;
}

function MiniSkillChart({ summary }: { summary: ReturnType<typeof summarizeAssessment> }) {
  return (
    <div className="rounded-xl bg-surface-muted p-4" role="group" aria-label={t("tutorClass.assessment.chartLabel")}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-fg">{t("tutorClass.assessment.skillAverages")}</p>
        <div className="flex items-center gap-3 text-xs text-fg-muted">
          <span className="flex items-center gap-1.5"><i aria-hidden="true" className="size-2 rounded-full bg-fg-subtle" />{t("tutorClass.assessment.pre")}</span>
          <span className="flex items-center gap-1.5"><i aria-hidden="true" className="size-2 rounded-full bg-brand-vivid" />{t("tutorClass.assessment.post")}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {summary.skillAverages.map((skill) => (
          <div key={skill.key} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3">
            <span className="text-[0.8125rem] text-fg-muted">{skill.label}</span>
            <div className="flex flex-col gap-1" aria-hidden="true">
              <div className="h-1.5 overflow-hidden rounded-full bg-fill-muted">
                <span className="block h-full rounded-full bg-fg-subtle" style={{ width: `${((skill.pre || 0) / 5) * 100}%` }} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-fill-muted">
                <span className="block h-full rounded-full bg-brand-vivid" style={{ width: `${((skill.post || 0) / 5) * 100}%` }} />
              </div>
            </div>
            <span className="text-right text-xs font-medium text-fg tabular">
              {skill.pre === null && skill.post === null
                ? t("tutorClass.assessment.noResult")
                : `${skill.pre === null ? "–" : formatNumber(skill.pre, 1)} → ${skill.post === null ? "–" : formatNumber(skill.post, 1)}`}
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
    <article className="min-w-0 rounded-xl border border-hairline bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] font-semibold text-fg">{student.displayName || t("tutorClass.students.unnamed")}</h3>
          <p className="mt-0.5 text-[0.8125rem] text-fg-muted">
            {t("tutorClass.assessment.pre")} <strong className="font-semibold text-fg tabular">{pre ? `${pre.total}/15` : t("tutorClass.assessment.noResult")}</strong>
            <span aria-hidden="true" className="px-1.5">→</span>
            {t("tutorClass.assessment.post")} <strong className="font-semibold text-fg tabular">{post ? `${post.total}/15` : t("tutorClass.assessment.noResult")}</strong>
          </p>
        </div>
        {difference !== null && (
          <Chip tone={difference > 0 ? "success" : difference < 0 ? "warning" : "neutral"} size="sm">
            {difference > 0
              ? `+${difference} ${t("tutorClass.assessment.itemsUnit")}`
              : difference === 0
                ? t("tutorClass.assessment.unchanged")
                : `${difference} ${t("tutorClass.assessment.itemsUnit")}`}
          </Chip>
        )}
      </div>

      {target ? (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {ASSESSMENT_SKILLS.map(({ key, label }) => (
              <div key={key} className="rounded-lg bg-surface-muted p-2.5 text-center">
                <dt className="text-xs text-fg-muted">{label}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-fg tabular">{pre?.scores?.[key] ?? "–"} → {post?.scores?.[key] ?? "–"}</dd>
              </div>
            ))}
          </dl>
          <TextAreaField
            containerClassName="mt-3"
            label={t("tutorClass.assessment.commentLabel")}
            rows={3}
            value={comment}
            maxLength={2000}
            placeholder={t("tutorClass.assessment.commentPlaceholder")}
            onChange={(event) => { setComment(event.target.value); setStatus(""); }}
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {status && <p role="status" className="text-[0.8125rem] text-fg-muted">{status}</p>}
            <Button
              size="sm"
              loading={saving}
              onClick={async () => {
                setSaving(true);
                setStatus("");
                try {
                  await assessmentAction(cycleId, "comment", { attemptId: target.attemptId, comment });
                  setStatus(t("tutorClass.assessment.saved"));
                } catch (error) {
                  setStatus(error instanceof Error ? error.message : t("tutorClass.assessment.saveFailed"));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t("tutorClass.detail.saving") : t("tutorClass.assessment.saveComment")}
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-lg bg-surface-muted px-3 py-2.5 text-[0.8125rem] text-fg-muted">{t("tutorClass.assessment.studentNoResult")}</p>
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
      setError(error instanceof Error ? error.message : t("tutorClass.assessment.loadFailed"));
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }

  useEffect(() => {
    let active = true;
    assessmentAction(cycleId, "report")
      .then((data) => { if (active) setReport(data); })
      .catch((error) => { if (active) setError(error instanceof Error ? error.message : t("tutorClass.assessment.loadFailed")); });
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

  const articleCount = report?.articles?.length || 0;

  return (
    <>
      <section aria-labelledby="assessment-title" className="rounded-xl border border-hairline bg-surface p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-brand-fg">
              <TrendingUp aria-hidden="true" className="size-4" />
              {report?.title || t("tutorClass.assessment.eyebrow")}
            </p>
            <h2 id="assessment-title" className="mt-1 text-base font-semibold text-fg">{t("tutorClass.assessment.title")}</h2>
            {selectedArticle && articleCount === 1 && <p className="mt-0.5 text-sm text-fg-muted">{selectedArticle.title}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("tutorClass.assessment.refresh")}
              title={t("tutorClass.assessment.refresh")}
              disabled={refreshing}
              onClick={() => { void refresh(); }}
            >
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none" disabled={!report} onClick={() => setDialogOpen(true)}>
              {t("tutorClass.assessment.viewDetails")}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
        {articleCount > 1 && (
          <select
            aria-label={t("tutorClass.assessment.selectLesson")}
            value={selectedArticleId}
            onChange={(event) => setSelectedArticleId(event.target.value)}
            className={cn(fieldControlClass, "mt-3 h-10 max-w-full cursor-pointer md:max-w-md pointer-coarse:h-11")}
          >
            {report?.articles?.map((article) => <option key={article.articleId} value={article.articleId}>{article.title}</option>)}
          </select>
        )}

        <div className="mt-4">
          {error && !report ? (
            <EmptyState
              compact
              icon={TrendingUp}
              title={error}
              action={
                <Button variant="ghost" size="sm" loading={refreshing} onClick={() => { void refresh(); }}>
                  <RefreshCw aria-hidden="true" />
                  {t("shell.retry")}
                </Button>
              }
            />
          ) : !summary ? (
            <div role="status" className="grid gap-3 md:grid-cols-2">
              <span className="sr-only">{t("tutorClass.assessment.loading")}</span>
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              <dl className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface-muted p-3">
                  <dt className="text-xs text-fg-muted">{t("tutorClass.assessment.pre")}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-fg tabular">{formatAverage(summary.preAverage, 15)}</dd>
                  <dd className="text-xs text-fg-muted tabular">{summary.preCompleted}/{summary.totalStudents} {PEOPLE}</dd>
                </div>
                <div className="rounded-xl bg-brand-soft p-3">
                  <dt className="text-xs text-brand-fg">{t("tutorClass.assessment.post")}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-brand-fg tabular">{formatAverage(summary.postAverage, 15)}</dd>
                  <dd className="text-xs text-fg-muted tabular">{summary.postCompleted}/{summary.totalStudents} {PEOPLE}</dd>
                </div>
                <div className="rounded-xl bg-surface-muted p-3">
                  <dt className="text-xs text-fg-muted">{t("tutorClass.assessment.change")}</dt>
                  <dd className="mt-0.5 text-lg font-semibold text-fg tabular">{averageChange === null ? "–" : `${averageChange >= 0 ? "+" : ""}${formatNumber(averageChange, 1)}`}</dd>
                  <dd className="text-xs text-fg-muted">{t("tutorClass.assessment.pairedPrefix")} {summary.paired} {PEOPLE}</dd>
                </div>
              </dl>
              <MiniSkillChart summary={summary} />
            </div>
          )}
          {error && report ? <p role="alert" className="mt-2 text-[0.8125rem] text-danger-fg">{error}</p> : null}
        </div>
      </section>

      <Sheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        width={960}
        title={t("tutorClass.assessment.detailTitle")}
        description={`${selectedArticle?.title || t("tutorClass.assessment.detailFallback")} · ${t("tutorClass.assessment.detailSuffix")}`}
      >
        <div className="flex flex-col gap-4">
          {summary && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard label={t("tutorClass.assessment.totalStudents")} value={`${summary.totalStudents} ${PEOPLE}`} icon={UsersRound} tone="teal" />
              <StatCard label={t("tutorClass.assessment.preDone")} value={`${summary.preCompleted} ${PEOPLE}`} icon={CheckCircle2} tone="neutral" />
              <StatCard label={t("tutorClass.assessment.postDone")} value={`${summary.postCompleted} ${PEOPLE}`} icon={CheckCircle2} tone="brand" />
              <StatCard label={t("tutorClass.assessment.paired")} value={`${summary.paired} ${PEOPLE}`} icon={TrendingUp} tone="blue" />
            </div>
          )}
          {!report?.students.length ? (
            <EmptyState compact icon={UsersRound} title={t("tutorClass.assessment.noStudents")} />
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
      </Sheet>
    </>
  );
}
