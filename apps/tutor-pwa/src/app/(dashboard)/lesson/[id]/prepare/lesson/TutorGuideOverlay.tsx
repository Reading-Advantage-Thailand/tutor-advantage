"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MousePointer2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { scrollBehavior } from "@/lib/motion";
import { fill } from "../../_lib/articles";

export type TutorGuideStep = {
  target: string;
  title: string;
  description: string;
  tip?: string;
  phase: number;
  action?: "click" | "none";
  autoAdvance?: boolean;
  targetOptional?: boolean;
  waitForMockAnswers?: boolean;
  waitForMockVotes?: boolean;
  waitForGameResults?: boolean;
};

type Rect = { top: number; left: number; width: number; height: number };

export default function TutorGuideOverlay({
  step,
  stepIndex,
  totalSteps,
  onPrevious,
  onNext,
  onClose,
  canAdvance = true,
}: {
  step: TutorGuideStep;
  stepIndex: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  /** Leave the guide (same as the lesson bar's "close guide" toggle). */
  onClose: () => void;
  canAdvance?: boolean;
}) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [targetUnavailable, setTargetUnavailable] = useState(false);
  const [actionComplete, setActionComplete] = useState(step.action !== "click");
  const coachmarkRef = useRef<HTMLElement>(null);
  const onNextRef = useRef(onNext);
  const [coachmarkHeight, setCoachmarkHeight] = useState(0);

  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Escape leaves the guide, unless a confirmation dialog is open on top of it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="alertdialog"][aria-modal="true"]')) return;
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const findTarget = useCallback(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-tour-target="${step.target}"]`,
    );

    if (!target) {
      setTargetRect(null);
      return null;
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: scrollBehavior() });
    const rect = target.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    });
    return target;
  }, [step.target]);

  useEffect(() => {
    setActionComplete(step.action !== "click");
    setTargetUnavailable(false);
    let target: HTMLElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const attach = () => {
      target = findTarget();
      if (!target) {
        attempts += 1;
        if (attempts >= 15) {
          setTargetUnavailable(true);
          setActionComplete(true);
          return;
        }
        retryTimer = setTimeout(attach, 120);
        return;
      }

      let advanceTimer: ReturnType<typeof setTimeout> | undefined;
      const markComplete = () => {
        setActionComplete(true);
        if (step.autoAdvance) {
          advanceTimer = setTimeout(() => onNextRef.current(), 250);
        }
      };
      target.addEventListener("click", markComplete, true);
      return () => {
        if (advanceTimer) clearTimeout(advanceTimer);
        target?.removeEventListener("click", markComplete, true);
      };
    };

    const cleanupTarget = attach();
    const updateRect = () => findTarget();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      cleanupTarget?.();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [findTarget, step.action, step.autoAdvance, step.target]);

  useLayoutEffect(() => {
    const coachmark = coachmarkRef.current;
    if (!coachmark) return;

    const measure = () => setCoachmarkHeight(coachmark.getBoundingClientRect().height);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(coachmark);
    return () => observer.disconnect();
  }, [step.target, stepIndex, targetRect]);

  const coachmarkStyle = useMemo(() => {
    const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
    const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
    const viewportPadding = 16;
    const cardWidth = Math.min(380, viewportWidth - viewportPadding * 2);
    const cardHeight = Math.min(
      coachmarkHeight || 320,
      viewportHeight - viewportPadding * 2,
    );

    if (!targetRect) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        maxHeight: `calc(100dvh - ${viewportPadding * 2}px)`,
      };
    }

    const left = Math.max(
      viewportPadding,
      Math.min(viewportWidth - cardWidth - viewportPadding, targetRect.left + targetRect.width / 2 - cardWidth / 2),
    );
    const preferredTop = targetRect.top + targetRect.height + 18;
    const top = preferredTop + cardHeight <= viewportHeight - viewportPadding
      ? preferredTop
      : targetRect.top - cardHeight - 18;
    const clampedTop = Math.max(
      viewportPadding,
      Math.min(viewportHeight - cardHeight - viewportPadding, top),
    );

    return {
      left,
      top: clampedTop,
      maxHeight: `calc(100dvh - ${viewportPadding * 2}px)`,
    };
  }, [coachmarkHeight, targetRect]);

  const canNext = (step.action !== "click" || actionComplete || targetUnavailable) && canAdvance;

  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-presenter-guide)">
      {!targetRect && <div className="pointer-events-auto absolute inset-0 bg-(--scrim)" aria-hidden="true" />}

      {targetRect && (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-(--scrim)"
            style={{ height: Math.max(0, targetRect.top - 8) }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute bottom-0 left-0 bg-(--scrim)"
            style={{
              top: targetRect.top + targetRect.height + 8,
              right: 0,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute bottom-0 left-0 bg-(--scrim)"
            style={{
              top: Math.max(0, targetRect.top - 8),
              width: Math.max(0, targetRect.left - 8),
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute right-0 bottom-0 bg-(--scrim)"
            style={{
              top: Math.max(0, targetRect.top - 8),
              left: targetRect.left + targetRect.width + 8,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute rounded-(--radius-card) border-2 border-brand-solid ring-4 ring-brand-solid/30 transition-[top,left,width,height] duration-300"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
            aria-hidden="true"
          />
        </>
      )}

      <section
        ref={coachmarkRef}
        className="pointer-events-auto fixed max-h-[calc(100dvh-32px)] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-(--radius-card) border border-clay-rim bg-surface-elevated shadow-popover"
        style={coachmarkStyle}
        aria-label={t("lesson.preflow.guide.label")}
      >
        <div className="flex items-start gap-3 border-b border-hairline px-4 py-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-(--radius-tile) bg-tile-purple text-icon-purple">
            <MousePointer2 aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-fg-muted tabular">
              {fill(t("lesson.preflow.guide.stepCount"), { n: stepIndex + 1, total: totalSteps })}
            </p>
            <h2 className="mt-0.5 type-card text-balance-th text-fg">{step.title}</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="-mt-0.5 -mr-1.5"
            onClick={onClose}
            aria-label={t("lesson.preflow.rehearsal.closeGuide")}
            title={t("lesson.preflow.rehearsal.closeGuide")}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <div aria-hidden="true" className="h-1 bg-track">
          <div
            className="h-full w-full origin-left bg-brand-vivid transition-transform duration-300 ease-(--ease-out)"
            style={{ transform: `scaleX(${(stepIndex + 1) / Math.max(1, totalSteps)})` }}
          />
        </div>

        <div className="p-4">
          <p className="text-[0.9375rem] leading-[1.6] text-fg">{step.description}</p>
          {step.tip && (
            <div className="mt-3 rounded-(--radius-ctl) border border-warning-border bg-warning-bg px-3 py-2.5 text-[0.8125rem] leading-[1.6] text-warning-fg">
              <span className="font-semibold">{t("lesson.preflow.guide.tipPrefix")} </span>
              {step.tip}
            </div>
          )}

          {step.action === "click" && (
            <div role="status" className={`mt-3 flex items-center gap-2 text-[0.8125rem] font-medium ${actionComplete ? "text-success-fg" : "text-brand-fg"}`}>
              {actionComplete ? <Check aria-hidden="true" className="size-4" /> : <MousePointer2 aria-hidden="true" className="size-4" />}
              {targetUnavailable
                ? t("lesson.preflow.guide.targetMissingClick")
                : actionComplete
                  ? t("lesson.preflow.guide.actionDone")
                  : t("lesson.preflow.guide.actionPending")}
            </div>
          )}

          {targetUnavailable && step.action !== "click" && (
            <div className="mt-3 rounded-(--radius-ctl) bg-neutral-bg px-3 py-2.5 text-[0.8125rem] leading-[1.6] text-neutral-fg">
              {t("lesson.preflow.guide.targetMissing")}
            </div>
          )}

          {(step.waitForMockAnswers || step.waitForMockVotes || step.waitForGameResults) && !canAdvance && (
            <div role="status" className="mt-3 flex items-center gap-2 text-[0.8125rem] font-medium text-warning-fg">
              <span aria-hidden="true" className="size-2 rounded-full bg-warning-fg" />
              {step.waitForMockVotes
                ? t("lesson.preflow.guide.waitVotes")
                : step.waitForGameResults
                  ? t("lesson.preflow.guide.waitResults")
                  : t("lesson.preflow.guide.waitAnswers")}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={stepIndex === 0}
            >
              <ChevronLeft aria-hidden="true" /> {t("lesson.preflow.guide.previous")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onNext}
              disabled={!canNext}
            >
              {stepIndex === totalSteps - 1 ? t("lesson.preflow.guide.finish") : t("lesson.preflow.guide.next")}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
