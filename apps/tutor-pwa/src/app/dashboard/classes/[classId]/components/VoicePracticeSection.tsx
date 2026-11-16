import { Mic2 } from "lucide-react";
import { Chip, EmptyState, UserAvatar } from "@/components/app";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { PanelCard } from "./PanelCard";

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
    <PanelCard
      id="class-voice-title"
      icon={Mic2}
      tone="pink"
      title={t("tutorClass.voice.title")}
      description={t("tutorClass.voice.description")}
      flush
    >
      {sessions.length === 0 ? (
        <EmptyState compact icon={Mic2} title={t("tutorClass.voice.empty")} description={t("tutorClass.voice.emptyDescription")} />
      ) : (
        <ul className="divide-y divide-hairline">
          {sessions.slice(0, 20).map((session: any) => {
            const summary = session.summary || {};
            const average = averageScore(session.scores || {});
            const name = session.student?.displayName || t("tutorClass.students.unnamed");
            return (
              <li key={session.voiceSessionId} className="flex min-w-0 gap-3 px-4 py-3.5 md:px-5">
                <UserAvatar name={session.student?.displayName} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base leading-normal font-semibold text-fg" title={name}>
                        {name}
                      </p>
                      <p className="truncate text-sm text-fg-muted">
                        {session.articleId} · {Math.ceil((session.consumedSeconds || 0) / 60)} {t("tutorClass.voice.minutesUnit")}
                      </p>
                    </div>
                    <Chip tone="brand" size="sm" className="tabular">
                      {average === null ? "–" : formatNumber(average, 1)}/5
                    </Chip>
                  </div>
                  <p className="mt-2 max-w-[68ch] text-sm leading-[1.6] text-fg-muted">{summary.summaryTh || t("tutorClass.voice.noSummary")}</p>
                  {Array.isArray(summary.improvements) && summary.improvements.length > 0 ? (
                    <p className="mt-2 max-w-[68ch] rounded-(--radius-ctl) bg-warning-bg px-3 py-2 text-sm leading-[1.6] text-warning-fg">
                      <strong className="font-semibold">{t("tutorClass.voice.improve")}</strong> {summary.improvements.join(" · ")}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}
