"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ClipboardCheck, DoorOpen, RotateCw } from "lucide-react";
// Relative imports only: the root vitest config maps "@" to another app (the
// test mocks "../lib/api"). For the same reason this file does not import the
// mobile primitives; it uses the same design tokens directly.
import { fetchWithAuth } from "../lib/api";
import { lessonLobbyHref } from "../lib/classAccess";
import { t } from "../lib/i18n";
import { keepThaiWords, thaiCopy } from "../lib/thaiText";

type Stage = "PRE" | "POST";
type Skill = "vocabulary" | "reading" | "listening";
type Attempt = {
  attemptId: string;
  articleId?: string;
  stage: Stage;
  submittedAt: string | null;
  total: number | null;
  scores: Record<Skill, number> | null;
  teacherComment: string | null;
};
export type AssessmentSummary = {
  supported: boolean;
  title?: string;
  articles?: { articleId: string; title: string }[];
  attempts: Attempt[];
};

const SKILLS: Skill[] = ["vocabulary", "reading", "listening"];
const MAX_TOTAL = 15;
const MAX_SKILL = 5;

/** Article to show first: the one with the latest submitted attempt, else the first article. */
export function pickInitialArticleId(summary: AssessmentSummary): string {
  const latest = [...(summary.attempts || [])]
    .filter((attempt) => attempt.submittedAt)
    .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
  return latest?.articleId || summary.articles?.[0]?.articleId || "";
}

/** Submitted PRE/POST attempts for one article (attempts without an article id always count). */
export function selectAttempts(summary: AssessmentSummary, articleId: string): { pre?: Attempt; post?: Attempt } {
  const attempts = (summary.attempts || []).filter(
    (attempt) => !articleId || !attempt.articleId || attempt.articleId === articleId,
  );
  return {
    pre: attempts.find((attempt) => attempt.stage === "PRE" && attempt.submittedAt),
    post: attempts.find((attempt) => attempt.stage === "POST" && attempt.submittedAt),
  };
}

export type Growth = { kind: "improved"; gained: number } | { kind: "same" } | { kind: "lower" };

/** Neutral growth message: never invents growth without both scores. */
export function compareScores(pre: number | null, post: number | null): Growth {
  const before = pre ?? 0;
  const after = post ?? 0;
  if (after > before) return { kind: "improved", gained: after - before };
  if (post === pre) return { kind: "same" };
  return { kind: "lower" };
}

function growthText(growth: Growth): string {
  if (growth.kind === "improved") {
    return `${t("classes.assessment.improvedPrefix")} ${growth.gained} ${t("classes.assessment.improvedSuffix")}`;
  }
  return growth.kind === "same" ? t("classes.assessment.same") : t("classes.assessment.lower");
}

const card = "rounded-[var(--radius-card)] border-[1.5px] border-clay-rim bg-surface shadow-[var(--shadow-card)]";
/** Tonal action (soft jade, small ledge), 44px. */
const tonalAction =
  "clay-press inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-ctl-sm)] bg-brand-soft px-4 font-heading text-[15px] leading-[1.3] font-semibold text-brand-soft-fg shadow-[0_var(--ledge-sm)_0_var(--brand-soft-border)]";

function ScoreTile({ label, attempt }: { label: string; attempt?: Attempt }) {
  return (
    <div className="flex-1 rounded-lg bg-surface-muted px-3.5 py-2.5">
      <p className="text-[13px] leading-[1.6] text-fg-muted">{label}</p>
      <strong className="block text-[22px] leading-[1.4] font-semibold text-fg tabular-nums">
        {attempt ? `${attempt.total}/${MAX_TOTAL}` : <span className="text-base font-semibold text-fg-muted">{t("classes.assessment.noResult")}</span>}
      </strong>
    </div>
  );
}

function SkillMeter({ value, tone }: { value: number | undefined; tone: "pre" | "post" }) {
  const percent = typeof value === "number" ? Math.min(100, Math.max(0, (value / MAX_SKILL) * 100)) : 0;
  return (
    <span className="relative block h-2 flex-1 overflow-hidden rounded-full bg-track" aria-hidden="true">
      <span
        className={`absolute inset-y-0 left-0 rounded-full ${tone === "post" ? "bg-brand-vivid" : "bg-icon-neutral"}`}
        style={{ width: `${percent}%` }}
      />
    </span>
  );
}

/**
 * Read-only pre/post assessment summary for one book cycle, as a collapsible
 * section. Renders nothing for books without the assessment pilot, and only a
 * slim placeholder while loading (no layout jump to a "loading" card).
 */
export default function AssessmentPanel({ cycleId, classId }: { cycleId: string; classId?: string }) {
  const [data, setData] = useState<AssessmentSummary | null>(null);
  const [error, setError] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState("");
  const base = `/book-cycles/${encodeURIComponent(cycleId)}/assessment`;

  /** One loader for the first load and for retries (keeps the article selection logic). */
  const load = useCallback(
    async (isActive: () => boolean = () => true) => {
      try {
        const result: AssessmentSummary = await fetchWithAuth(base);
        if (!isActive()) return;
        setData(result);
        setError("");
        setSelectedArticleId(pickInitialArticleId(result));
      } catch (err) {
        if (isActive()) setError(err instanceof Error ? err.message : String(err));
      }
    },
    [base],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  if (data && !data.supported) return null;

  if (!data) {
    if (!error) {
      return <div aria-hidden="true" className={`${card} h-[72px] skeleton-block`} />;
    }
    return (
      <section aria-label={t("classes.assessment.ariaLabel")} className={`${card} flex items-center gap-3 p-4`}>
        <p role="alert" className="min-w-0 flex-1 text-sm leading-[1.6] text-fg-muted">
          {t("classes.assessment.loadFailed")}
        </p>
        <button
          type="button"
          onClick={() => {
            setError("");
            void load();
          }}
          className={tonalAction}
        >
          <RotateCw aria-hidden="true" className="size-4" />
          {t("classes.assessment.retry")}
        </button>
      </section>
    );
  }

  const { pre, post } = selectAttempts(data, selectedArticleId);
  const selectedArticle = data.articles?.find((article) => article.articleId === selectedArticleId);
  const hasArticlePicker = (data.articles?.length || 0) > 1;
  const teacherComment = post?.teacherComment || pre?.teacherComment;

  return (
    <section aria-label={t("classes.assessment.ariaLabel")} className={card}>
      <details className="group">
        <summary className="flex min-h-[72px] cursor-pointer list-none items-center gap-3.5 rounded-[var(--radius-card)] px-[18px] py-3.5 select-none active:bg-press [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-[var(--radius-tile)] bg-tile-purple text-icon-purple">
            <ClipboardCheck className="size-6" strokeWidth={2.1} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-base leading-[1.45] font-semibold text-fg">{keepThaiWords(t("classes.assessment.heading"))}</span>
            <span className="block truncate text-[13px] leading-[1.6] text-fg-muted">
              {t("classes.assessment.eyebrowPrefix")} {data.title || t("classes.assessment.defaultTitle")}
            </span>
          </span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
        </summary>

        <div className="flex flex-col gap-4 border-t-[1.5px] border-hairline px-[18px] pt-4 pb-[18px] text-sm leading-[1.6] text-fg">
          {hasArticlePicker ? (
            <label className="flex flex-col gap-1.5 text-sm leading-[1.6] font-semibold text-fg">
              {t("classes.assessment.selectArticle")}
              <select
                value={selectedArticleId}
                onChange={(event) => setSelectedArticleId(event.target.value)}
                className="h-[52px] w-full rounded-[var(--radius-field)] border-2 border-field-border bg-surface px-3.5 text-base font-normal text-fg focus:border-brand-fg focus:outline-3 focus:outline-offset-2 focus:outline-focus-ring"
              >
                {data.articles?.map((article) => (
                  <option key={article.articleId} value={article.articleId}>
                    {article.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {/* With a picker the title is already its value. */}
          {selectedArticle && !hasArticlePicker ? <p className="font-bold text-fg">{selectedArticle.title}</p> : null}
          <p className="text-fg-muted">{t("classes.assessment.about")}</p>

          {pre || post ? (
            <>
              <div className="flex gap-3">
                <ScoreTile label={t("classes.assessment.before")} attempt={pre} />
                <ScoreTile label={t("classes.assessment.after")} attempt={post} />
              </div>
              {pre && post ? <p className="font-bold">{growthText(compareScores(pre.total, post.total))}</p> : null}
              {post && !pre ? <p>{t("classes.assessment.noPre")}</p> : null}

              <div>
                <p className="mb-2 font-semibold">{t("classes.assessment.skillsTitle")}</p>
                <ul className="flex flex-col gap-3">
                  {SKILLS.map((skill) => (
                    <li key={skill}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span>{t(`classes.assessment.${skill}`)}</span>
                        <span className="text-[13px] text-fg-muted tabular-nums">
                          {t("classes.assessment.beforeShort")} {pre?.scores?.[skill] ?? "—"} ·{" "}
                          {t("classes.assessment.afterShort")} {post?.scores?.[skill] ?? "—"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex gap-1.5">
                        <SkillMeter value={pre?.scores?.[skill]} tone="pre" />
                        <SkillMeter value={post?.scores?.[skill]} tone="post" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {teacherComment ? (
                <div className="rounded-lg bg-surface-muted px-3.5 py-3">
                  <strong className="block">{t("classes.assessment.teacherComment")}</strong>
                  <p className="whitespace-pre-wrap text-fg-muted">{teacherComment}</p>
                </div>
              ) : null}
              <p className="text-xs leading-[1.6] text-fg-muted">{t("classes.assessment.disclaimer")}</p>
            </>
          ) : null}

          <p className="text-fg-muted">{thaiCopy(t("classes.assessment.lobbyNote"))}</p>
          {classId ? (
            <Link
              href={lessonLobbyHref(classId)}
              className={`${tonalAction} self-start`}
            >
              <DoorOpen aria-hidden="true" className="size-[18px]" />
              {t("classes.assessment.lobbyCta")}
            </Link>
          ) : null}
        </div>
      </details>
    </section>
  );
}
