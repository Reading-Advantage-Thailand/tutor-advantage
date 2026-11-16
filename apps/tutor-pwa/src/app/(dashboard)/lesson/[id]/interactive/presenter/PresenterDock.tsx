"use client";

/**
 * Bottom control dock for the presenter (components.md §7 LessonDock): the
 * phase/answer status on the left, view tools in the middle, and the lesson
 * flow on the right: outline "ย้อนกลับ", then the one filled action. While a
 * question can still be closed and "ถัดไป" waits, "ปิดคำถาม/จบเกม" is the
 * filled action and the waiting "ถัดไป" steps back to outline; once answers
 * are in, "ถัดไป" is filled. Controls are 44 tall (56 on touch screens). It
 * is sticky (LessonDock) so it never falls below a 720px projector, and
 * floats over the stage in element fullscreen.
 */
import React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  SquareStop,
  Undo2,
  Wrench,
} from "lucide-react";
import { LessonDock } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface DevTool {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

export interface PresenterDockProps {
  isFullscreen: boolean;
  hidden: boolean;
  /** Take the dock out of focus order (a blocking notice covers it). */
  inert?: boolean;
  onShow: () => void;
  onHide: () => void;
  onToggleFullscreen: () => void;
  /** Left status, e.g. "ตอบแล้ว 2/3" or "นักเรียน 3 คน". */
  status: React.ReactNode;
  /** "Rehearsal" / "Free explore" badge in preparation mode. */
  modeBadge?: React.ReactNode;
  onReturnLobby?: () => void;
  returnLobbyDisabled?: boolean;
  onPrevious: () => void;
  previousDisabled: boolean;
  /** Shown only while the question or game can be closed early. */
  endQuestion?: { onClick: () => void; disabled?: boolean; title?: string; label?: string } | null;
  primary: {
    label: React.ReactNode;
    onClick: () => void;
    disabled: boolean;
    loading?: boolean;
    tone: "game" | "next";
    showChevron?: boolean;
    tourTarget?: string;
    /** Next phase name, shown under the button on wide screens. */
    hint?: string;
  };
  onFinish?: () => void;
  /** Last phase: finishing is the main action, so give it the filled style. */
  finishEmphasis?: boolean;
  devTools?: DevTool[];
  tour?: (target: string) => string | undefined;
}

/** Flow buttons: 44 tall, 56 on touch screens (components.md §7). */
const flowButtonClass = "pointer-coarse:min-h-14";
/** View tools (icon buttons on phones): 44 square, 56 on touch screens. */
const toolButtonClass = "pointer-coarse:min-h-14 pointer-coarse:min-w-14";

export function PresenterDock({
  isFullscreen,
  hidden,
  inert = false,
  onShow,
  onHide,
  onToggleFullscreen,
  status,
  modeBadge,
  onReturnLobby,
  returnLobbyDisabled,
  onPrevious,
  previousDisabled,
  endQuestion,
  primary,
  onFinish,
  finishEmphasis = false,
  devTools,
  tour = () => undefined,
}: PresenterDockProps) {
  const [devOpen, setDevOpen] = React.useState(false);
  // One filled action at a time: while the question can be closed and "next" still waits, closing leads.
  const endLeads = Boolean(endQuestion && !endQuestion.disabled && primary.disabled && !primary.loading);

  if (hidden) {
    return (
      <div
        inert={inert || undefined}
        className={cn("z-(--z-sticky) flex justify-end", isFullscreen ? "absolute bottom-5 right-5 z-(--z-presenter-dock)" : "sticky bottom-3 mt-auto px-4")}
      >
        <Button variant="outline" size="lg" onClick={onShow} data-tour-target={tour("show-toolbar-button")} className="shadow-popover pointer-coarse:min-h-14">
          <Eye aria-hidden="true" />
          {t("lesson.interactive.showToolbar")}
        </Button>
      </div>
    );
  }

  const dock = (
    <div data-tour-target={tour("lesson-control-panel")} className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-wrap items-center gap-2 lg:flex-nowrap">
        {/* Status */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="min-w-0 text-sm text-fg-muted xl:text-base">{status}</div>
          {modeBadge}
        </div>

        {/* View tools */}
        <div className="flex items-center gap-1 pointer-coarse:gap-2 lg:mx-auto">
          <Button
            variant="ghost"
            size="lg"
            className={cn("px-3", toolButtonClass)}
            onClick={onToggleFullscreen}
            data-tour-target={tour("fullscreen-button")}
            aria-label={isFullscreen ? t("lesson.interactive.exitFullscreen") : t("lesson.interactive.enterFullscreen")}
            title={isFullscreen ? t("lesson.interactive.exitFullscreen") : t("lesson.interactive.enterFullscreen")}
          >
            {isFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
            <span className="hidden xl:inline">
              {isFullscreen ? t("lesson.interactive.exitFullscreen") : t("lesson.interactive.enterFullscreen")}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className={cn("px-3", toolButtonClass)}
            onClick={onHide}
            data-tour-target={tour("hide-toolbar-button")}
            aria-label={t("lesson.live.hideControls")}
            title={t("lesson.live.hideControls")}
          >
            <EyeOff aria-hidden="true" />
            <span className="hidden xl:inline">{t("lesson.interactive.hideToolbar")}</span>
          </Button>
          {onReturnLobby ? (
            <Button variant="ghost" size="lg" className={cn("px-3", toolButtonClass)} onClick={onReturnLobby} disabled={returnLobbyDisabled} title={t("lesson.interactive.returnLobby")}>
              <Undo2 aria-hidden="true" />
              <span className="hidden xl:inline">{t("lesson.interactive.returnLobby")}</span>
              <span className="sr-only xl:hidden">{t("lesson.interactive.returnLobby")}</span>
            </Button>
          ) : null}
          {devTools?.length ? (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={devOpen}
              onClick={() => setDevOpen((open) => !open)}
              className={cn("text-fg-subtle", toolButtonClass)}
              title="Developer tools"
            >
              <Wrench aria-hidden="true" />
              DEV
            </Button>
          ) : null}
        </div>

        {/* Lesson flow */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 lg:ml-0 lg:flex-nowrap">
          {onFinish ? (
            <Button
              variant={finishEmphasis ? "default" : "outline"}
              size="lg"
              onClick={onFinish}
              data-tour-target={tour("preparation-exit-button")}
              className={cn(flowButtonClass, finishEmphasis ? "inline-flex" : "hidden md:inline-flex")}
            >
              <Check aria-hidden="true" />
              {t("lesson.live.finishLessonShort")}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="lg"
            onClick={onPrevious}
            disabled={previousDisabled}
            data-tour-target={tour("previous-phase-button")}
            aria-label={t("lesson.interactive.previous")}
            className={flowButtonClass}
          >
            <ChevronLeft aria-hidden="true" />
            <span className="hidden sm:inline">{t("lesson.interactive.previous")}</span>
          </Button>
          {endQuestion ? (
            <Button
              size="lg"
              variant={endLeads ? "default" : "outline"}
              onClick={endQuestion.onClick}
              disabled={endQuestion.disabled}
              title={endQuestion.title}
              data-tour-target={tour("preparation-end-question-button")}
              className={flowButtonClass}
            >
              <SquareStop aria-hidden="true" />
              {endQuestion.label ?? t("lesson.live.endQuestion")}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={(finishEmphasis && onFinish) || endLeads ? "outline" : "default"}
            onClick={primary.onClick}
            disabled={primary.disabled}
            loading={primary.loading}
            data-tour-target={primary.tourTarget}
            data-lesson-action="primary"
            title={primary.hint}
            className={cn(flowButtonClass, "min-w-36")}
          >
            {primary.label}
            {primary.showChevron ? <ChevronRight aria-hidden="true" /> : null}
          </Button>
        </div>
      </div>

      {devOpen && devTools?.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-2">
          {devTools.map((tool) => (
            <Button
              key={tool.label}
              variant={tool.active ? "soft" : "outline"}
              size="sm"
              onClick={tool.onClick}
              disabled={tool.disabled}
              title={tool.title}
            >
              {tool.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );

  if (isFullscreen) {
    return (
      <div
        inert={inert || undefined}
        className="absolute bottom-4 left-1/2 z-(--z-presenter-dock) w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 rounded-(--radius-card) border border-clay-rim bg-surface-elevated p-3 shadow-popover"
      >
        {dock}
      </div>
    );
  }
  return (
    <LessonDock className="mt-auto" inert={inert}>
      {dock}
    </LessonDock>
  );
}
