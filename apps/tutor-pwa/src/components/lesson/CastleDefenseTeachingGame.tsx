"use client";

import React, { useEffect, useState } from "react";
import { CastleDefenseGame } from "@/components/games/sentence/castle-defense/CastleDefenseGame";
import { BookOpen, Compass, Hammer, Shield } from "lucide-react";

export type CastleDefenseTeachingSentence = {
  term: string;
  translation?: string;
};

type TeachingMode = "teacher" | "tutorial";

type CastleDefenseTeachingGameProps = {
  vocabulary: CastleDefenseTeachingSentence[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_SENTENCES: CastleDefenseTeachingSentence[] = [
  { term: "Students read the article carefully", translation: "นักเรียนใช้วิธีอ่านบทความอย่างละเอียด" },
  { term: "The teacher asks a follow up question", translation: "คุณครูถามคำถามติดตามผลเพิ่มเติม" },
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "1. อ่านประโยคแปลภาษาไทย",
    detail: "ดูคำแปลประโยคภาษาไทยด้านบนเพื่อหาคำศัพท์ภาษาอังกฤษที่หายไป",
    icon: BookOpen,
  },
  {
    step: 2,
    title: "2. เดินเก็บลูกแก้วคำศัพท์เรียงประโยค",
    detail: "บังคับตัวละครเดินไปเก็บลูกแก้วคำศัพท์ให้เรียงถูกต้องตามโครงสร้างประโยค",
    icon: Compass,
  },
  {
    step: 3,
    title: "3. สร้างป้อมปราการป้องกันทางเดิน",
    detail: "เมื่อเรียงประโยคสมบูรณ์ ระบบจะเดินไปที่จุดสร้างป้อมและกด Build ให้ดูอัตโนมัติ",
    icon: Hammer,
  },
  {
    step: 4,
    title: "4. ป้องกันปราสาทจากฝูงศัตรู",
    detail: "ดูศัตรูเข้าระยะป้อม → ป้อมล็อกเป้าและยิงอัตโนมัติ → ศัตรูถูกกำจัด โดยเวลายังหยุดอยู่",
    icon: Shield,
  },
];

export function CastleDefenseTeachingGame({ vocabulary, mode, fullscreen = false }: CastleDefenseTeachingGameProps) {
  const sentences = React.useMemo(() => {
    const usable = vocabulary.filter((s) => s.term);
    return usable.length >= 1 ? usable : FALLBACK_SENTENCES;
  }, [vocabulary]);

  const [key, setKey] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const tutorialCardRef = React.useRef<HTMLDivElement>(null);
  const [tutorialCardInset, setTutorialCardInset] = useState(0);

  // Keep the letterboxed board clear of the tutorial card pinned to the bottom.
  useEffect(() => {
    const card = tutorialCardRef.current;
    if (mode !== "tutorial" || !card) {
      setTutorialCardInset(0);
      return;
    }
    const measure = () => setTutorialCardInset(Math.ceil(card.offsetHeight + 16));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    setTutorialStep(0);
  }, [mode]);

  const formattedVocab = React.useMemo(() => {
    return sentences.map((s, idx) => ({
      id: `sent-${idx}`,
      term: s.term,
      translation: s.translation || "",
    }));
  }, [sentences]);

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;
  const handleTutorialStepChange = React.useCallback((step: number) => {
    setTutorialStep(Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, step)));
  }, []);
  const handleComplete = React.useCallback(() => {
    if (mode !== "tutorial") setKey((k) => k + 1);
  }, [mode]);

  return (
    <div
      key={key}
      // The game sizes itself to this frame (not the viewport), so the frame
      // needs a definite height: a 4:3 board-shaped stage capped to the screen
      // inline, or the remaining presenter stage in fullscreen.
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen
          ? "h-full min-h-[360px] flex-1 rounded-none shadow-none"
          : "aspect-[4/3] max-h-[max(420px,calc(100dvh-13rem))] min-h-[420px] rounded-[32px] shadow-2xl"
      }`}
      data-testid={`castle-defense-${mode}`}
    >
      <CastleDefenseGame
        vocabulary={formattedVocab as any}
        autoStart={true}
        tutorialMode={mode === "tutorial"}
        onTutorialStepChange={handleTutorialStepChange}
        onComplete={handleComplete}
        fit="contain"
        insetBottom={mode === "tutorial" ? tutorialCardInset : 0}
      />

      {mode === "tutorial" && (
        <div ref={tutorialCardRef} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-none">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/50 bg-slate-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25">
              <StepIcon size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-500/30">
                  ขั้นตอนที่ {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </span>
              </div>
              <p className="mt-0.5 text-base font-black text-white leading-tight">{currentStep.title}</p>
              <p className="line-clamp-1 text-xs font-semibold text-white/70 leading-snug mt-0.5">{currentStep.detail}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
              {TUTORIAL_STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-2.5 rounded-full transition-all ${
                    idx === tutorialStep ? "w-7 bg-emerald-400 shadow-md shadow-emerald-400/50" : "w-2.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
