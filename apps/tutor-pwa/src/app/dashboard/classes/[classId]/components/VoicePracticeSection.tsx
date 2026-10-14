import { Mic2 } from "lucide-react";
import { Chip, EmptyState, Section } from "@/components/app";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";

/* eslint-disable @typescript-eslint/no-explicit-any */

function averageScore(scores: Record<string, unknown>) {
  const values = [scores.fluency, scores.grammar, scores.vocabulary, scores.pronunciation].filter(
    (value): value is number => typeof value === "number",
  );
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** AI conversation-practice summaries (scores + Thai summary only, no audio/transcripts). Server component. */
export function VoicePracticeSection({ sessions }: { sessions: any[] }) {
  return (
    <Section title={t("tutorClass.voice.title")} description={t("tutorClass.voice.description")}>
      {sessions.length === 0 ? (
        <EmptyState icon={Mic2} title={t("tutorClass.voice.empty")} description={t("tutorClass.voice.emptyDescription")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sessions.slice(0, 20).map((session: any) => {
            const summary = session.summary || {};
            const average = averageScore(session.scores || {});
            return (
              <li key={session.voiceSessionId} className="min-w-0 rounded-xl border border-hairline bg-surface p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">{session.student?.displayName || t("tutorClass.students.unnamed")}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {session.articleId} · {Math.ceil((session.consumedSeconds || 0) / 60)} {t("tutorClass.voice.minutesUnit")}
                    </p>
                  </div>
                  <Chip tone="brand" size="sm" className="tabular">
                    {average === null ? "–" : formatNumber(average, 1)}/5
                  </Chip>
                </div>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-fg-muted">{summary.summaryTh || t("tutorClass.voice.noSummary")}</p>
                {Array.isArray(summary.improvements) && summary.improvements.length > 0 ? (
                  <p className="mt-2 text-[0.8125rem] text-warning-fg">
                    <strong className="font-semibold">{t("tutorClass.voice.improve")}</strong> {summary.improvements.join(" · ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
