"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  canAdvance = true,
}: {
  step: TutorGuideStep;
  stepIndex: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  canAdvance?: boolean;
}) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [targetUnavailable, setTargetUnavailable] = useState(false);
  const [actionComplete, setActionComplete] = useState(step.action !== "click");
  const coachmarkRef = useRef<HTMLElement>(null);
  const onNextRef = useRef(onNext);
  const [coachmarkHeight, setCoachmarkHeight] = useState(0);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  const findTarget = useCallback(() => {
    const target = document.querySelector<HTMLElement>(
      `[data-tour-target="${step.target}"]`,
    );

    if (!target) {
      setTargetRect(null);
      return null;
    }

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
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
        maxHeight: `calc(100vh - ${viewportPadding * 2}px)`,
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
      maxHeight: `calc(100vh - ${viewportPadding * 2}px)`,
    };
  }, [coachmarkHeight, targetRect]);

  const canNext = (step.action !== "click" || actionComplete || targetUnavailable) && canAdvance;

  return (
    <div className="pointer-events-none fixed inset-0 z-[200]">
      {!targetRect && <div className="pointer-events-auto absolute inset-0 bg-slate-950/65" aria-hidden="true" />}

      {targetRect && (
        <>
          <div
            className="pointer-events-auto absolute inset-x-0 top-0 bg-slate-950/68"
            style={{ height: Math.max(0, targetRect.top - 8) }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute bottom-0 left-0 bg-slate-950/68"
            style={{
              top: targetRect.top + targetRect.height + 8,
              right: 0,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute bottom-0 left-0 bg-slate-950/68"
            style={{
              top: Math.max(0, targetRect.top - 8),
              width: Math.max(0, targetRect.left - 8),
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute right-0 bottom-0 bg-slate-950/68"
            style={{
              top: Math.max(0, targetRect.top - 8),
              left: targetRect.left + targetRect.width + 8,
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute rounded-2xl border-2 border-violet-300 shadow-[0_0_0_6px_rgba(167,139,250,0.2)] transition-all duration-300"
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
        className="pointer-events-auto fixed w-[min(380px,calc(100vw-32px))] max-h-[calc(100vh-32px)] overflow-y-auto rounded-3xl border border-violet-300/40 bg-card shadow-2xl shadow-violet-950/30"
        style={coachmarkStyle}
        aria-label="Tutor guided tour"
      >
        <div className="flex items-start gap-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <MousePointer2 className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-100">
                ขั้นตอน {stepIndex + 1} / {totalSteps}
              </p>
              <h2 className="mt-1 text-base font-black leading-tight">{step.title}</h2>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm leading-relaxed text-foreground">{step.description}</p>
          {step.tip && (
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <span className="font-black">เคล็ดลับสำหรับติวเตอร์: </span>
              {step.tip}
            </div>
          )}

          {step.action === "click" && (
            <div className={`mt-4 flex items-center gap-2 text-xs font-bold ${actionComplete ? "text-emerald-600 dark:text-emerald-400" : "text-violet-600 dark:text-violet-300"}`}>
              {actionComplete ? <Check className="size-4" /> : <MousePointer2 className="size-4 animate-pulse" />}
              {targetUnavailable
                ? "จุดควบคุมนี้ไม่มีในข้อมูลบทเรียน จึงข้ามขั้นตอนนี้ได้"
                : actionComplete
                  ? "ทำขั้นตอนนี้แล้ว ไปต่อได้เลย"
                  : "ลองกดจุดที่มีกรอบไฮไลต์ก่อน"}
            </div>
          )}

          {targetUnavailable && step.action !== "click" && (
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              จุดนี้ไม่มีในข้อมูลบทเรียน จะแสดงคำอธิบายแทนและไปต่อได้
            </div>
          )}

          {(step.waitForMockAnswers || step.waitForMockVotes || step.waitForGameResults) && !canAdvance && (
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-300">
              <span className="size-2 animate-pulse rounded-full bg-amber-400" />
              {step.waitForMockVotes
                ? "รอ Mock นักเรียนโหวตครบก่อนปิดโหวต..."
                : step.waitForGameResults
                  ? "รอ Mock นักเรียนเล่นจบทีละคนก่อนเปิดหน้าสรุปผล..."
                  : "รอ Mock นักเรียนตอบครบก่อนเปิดหน้าสรุปผล..."}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={stepIndex === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="size-4" /> ย้อนกลับ
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onNext}
              disabled={!canNext}
              className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
            >
              {stepIndex === totalSteps - 1 ? "เสร็จสิ้น" : "ถัดไป"}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
