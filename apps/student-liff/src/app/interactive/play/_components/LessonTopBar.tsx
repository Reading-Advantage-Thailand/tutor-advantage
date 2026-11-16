"use client";

import { useState } from "react";
import { Hourglass, Lock, WifiOff, X } from "lucide-react";
import { ScorePill, StatusCard } from "@/components/lesson/PhaseBlocks";
import { ConfirmSheet, IconButton, Spinner } from "@/components/mobile";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LessonTopBarProps {
  /** Current lesson phase (0 = not started). */
  phase: number;
  articleTitle?: string | null;
  /** The student's total score: the bar's score pill (the screen's one reward element). */
  score?: number;
  /** Socket dropped after joining: show the non-blocking "reconnecting" strip. */
  reconnecting?: boolean;
  /** The tutor went back to an earlier phase: answers do not count. */
  readOnly?: boolean;
  /** The tutor's connection dropped; the room stays open for them to return. */
  tutorAway?: boolean;
  /** Leave the lesson (after the confirm sheet). */
  onExit: () => void;
}

/**
 * Live-lesson bar (components.md §6.2): 60px + safe-top, card surface, 1.5px
 * rim. Close (confirm sheet) at the left, "ห้องเรียนสด" + the article title in
 * the centre, the score pill at the right (it springs when points land).
 *
 * Under it, one compact one-line strip stays sticky for the most urgent status
 * (reconnecting, then read-only, then tutor away), so it remains visible while
 * the phase content scrolls. The full messages are the StatusCards under the
 * phase row (`LessonStatusCards`), which are also the live regions: the strip
 * is a visual reminder only, so screen readers hear each message once.
 */
export function LessonTopBar({ phase, articleTitle, score = 0, reconnecting, readOnly, tutorAway, onExit }: LessonTopBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The pill springs only when the score moves after the bar first showed it.
  const [initialScore] = useState(score);
  const hasPhase = phase > 0;
  const hasStrip = Boolean(reconnecting || tutorAway || readOnly);

  return (
    <>
      <header className="appbar border-b-[1.5px] border-clay-rim" data-variant="solid">
        <div className="grid h-[60px] grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] items-center gap-2 px-2">
          <div className="flex items-center">
            <IconButton icon={X} label={t("interactivePlay.exitLesson")} onClick={() => setConfirmOpen(true)} />
          </div>
          <div className="min-w-0 text-center">
            <h1 className="truncate font-heading text-[17px] leading-[1.35] font-semibold text-fg">{t("interactivePlay.topBarTitle")}</h1>
            {articleTitle ? (
              <p lang="en" className="truncate text-[13px] leading-[1.4] text-fg-muted">
                {articleTitle}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end pr-1">
            {hasPhase ? <ScorePill key={score} score={score} bump={score !== initialScore} /> : null}
          </div>
        </div>
        {hasStrip ? (
          <div className="px-4 pb-2.5">
            <div
              aria-hidden="true"
              className={cn(
                "flex h-9 items-center gap-2 rounded-lg border-[1.5px] px-3.5 text-[13px] leading-[1.6] font-semibold",
                reconnecting || readOnly ? "border-warning-border bg-warning-bg text-warning-fg" : "border-info-border bg-info-bg text-info-fg",
              )}
            >
              {reconnecting ? (
                <Spinner size="sm" className="text-warning-fg" />
              ) : readOnly ? (
                <Lock aria-hidden="true" className="size-4 shrink-0" />
              ) : (
                <Hourglass aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="min-w-0 truncate">
                {reconnecting
                  ? t("interactivePlay.reconnecting")
                  : readOnly
                    ? t("interactivePlay.readOnlyTitle")
                    : t("interactivePlay.tutorAwayTitle")}
              </span>
            </div>
          </div>
        ) : null}
      </header>
      <ConfirmSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("interactivePlay.exitConfirmTitle")}
        description={t("interactivePlay.exitConfirmDescription")}
        confirmLabel={t("interactivePlay.exitConfirm")}
        cancelLabel={t("interactivePlay.stayInLesson")}
        tone="danger"
        onConfirm={() => {
          setConfirmOpen(false);
          onExit();
        }}
      />
    </>
  );
}

/**
 * The lesson's status messages in full (patterns.md S6: StatusCard under the
 * phase row, warning or info): reconnecting, read-only, tutor away. Each is a
 * role="status" live region. `readOnly` may be false while a phase shows its
 * own read-only card (the game review), so the message is not said twice.
 */
export function LessonStatusCards({ reconnecting, readOnly, tutorAway, className }: {
  reconnecting?: boolean;
  readOnly?: boolean;
  tutorAway?: boolean;
  className?: string;
}) {
  if (!reconnecting && !readOnly && !tutorAway) return null;
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {reconnecting ? (
        <StatusCard tone="warning" icon={WifiOff} title={t("interactivePlay.reconnecting")} description={t("interactivePlay.reconnectingHint")} />
      ) : null}
      {readOnly ? (
        <StatusCard tone="warning" icon={Lock} title={t("interactivePlay.readOnlyTitle")} description={t("interactivePlay.readOnlyBanner")} />
      ) : null}
      {tutorAway ? (
        <StatusCard tone="info" icon={Hourglass} title={t("interactivePlay.tutorAwayTitle")} description={t("interactivePlay.tutorAwayHint")} />
      ) : null}
    </div>
  );
}
