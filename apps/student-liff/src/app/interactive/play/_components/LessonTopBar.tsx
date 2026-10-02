"use client";

import { useState } from "react";
import { Lock, LogOut } from "lucide-react";
import { formatPhaseStep, getPhaseMeta, getPhaseProgress } from "@/components/lesson/phaseMeta";
import { AppBar, ConfirmSheet, IconButton, ProgressBar, Spinner } from "@/components/mobile";
import { t } from "@/lib/i18n";

interface LessonTopBarProps {
  /** Current lesson phase (0 = not started). */
  phase: number;
  articleTitle?: string | null;
  /** Socket dropped after joining: show the non-blocking "reconnecting" strip. */
  reconnecting?: boolean;
  /** The tutor went back to an earlier phase: answers do not count. */
  readOnly?: boolean;
  /** Leave the lesson (after the confirm sheet). */
  onExit: () => void;
}

/**
 * Sticky live-lesson bar: phase name, step + article, lesson progress, an exit
 * button with a confirm sheet, and sticky status strips (reconnecting,
 * read-only) so they stay visible while the phase content scrolls.
 */
export function LessonTopBar({ phase, articleTitle, reconnecting, readOnly, onExit }: LessonTopBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const hasPhase = phase > 0;
  const step = hasPhase ? formatPhaseStep(phase) : null;
  const subtitle = [step, articleTitle].filter(Boolean).join(" · ") || undefined;

  return (
    <>
      <AppBar
        title={hasPhase ? getPhaseMeta(phase).label : t("interactivePlay.topBarTitle")}
        subtitle={subtitle}
        actions={
          <IconButton icon={LogOut} label={t("interactivePlay.exitLesson")} onClick={() => setConfirmOpen(true)} />
        }
        bottom={
          <div className="flex flex-col gap-2">
            <ProgressBar value={getPhaseProgress(phase)} size="sm" label={step ?? t("interactivePlay.topBarTitle")} />
            {reconnecting ? (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl border border-warning-border bg-warning-bg px-3 py-2"
              >
                <Spinner size="sm" className="text-warning-fg" />
                <p className="min-w-0 text-[13px] leading-[1.5]">
                  <span className="font-bold text-warning-fg">{t("interactivePlay.reconnecting")}</span>{" "}
                  <span className="text-fg-muted">{t("interactivePlay.reconnectingHint")}</span>
                </p>
              </div>
            ) : null}
            {readOnly ? (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-[13px] leading-[1.5] font-semibold text-warning-fg"
              >
                <Lock aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0">{t("interactivePlay.readOnlyBanner")}</span>
              </div>
            ) : null}
          </div>
        }
      />
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
