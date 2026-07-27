"use client";

import React, { useEffect, useState } from "react";
import { RuneMatchGame } from "@/components/games/vocabulary/rune-match/RuneMatchGame";
import { Sparkles, MousePointerClick, Swords, Zap } from "lucide-react";

export type RuneMatchTeachingWord = {
  term: string;
  translation: string;
};

type TeachingMode = "teacher" | "tutorial";

type RuneMatchTeachingGameProps = {
  vocabulary: RuneMatchTeachingWord[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_WORDS: RuneMatchTeachingWord[] = [
  { term: "explore", translation: "สำรวจ" },
  { term: "ancient", translation: "เก่าแก่" },
  { term: "journey", translation: "การเดินทาง" },
  { term: "mystery", translation: "ปริศนา" },
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "1. สังเกตรูนคำศัพท์ & คำแปล",
    detail: "มองหาแผ่นรูนภาษาอังกฤษและแผ่นรูนคำแปลภาษาไทยที่ตรงกันบนกระดาน 4x4",
    icon: Sparkles,
  },
  {
    step: 2,
    title: "2. คลิกจับคู่แผ่นรูนที่ติดกัน",
    detail: "กดเลือกรูน 2 แผ่นในแนวตั้งหรือแนวนอนเพื่อสลับตำแหน่งให้คู่ตรงกันจับคู่กัน",
    icon: MousePointerClick,
  },
  {
    step: 3,
    title: "3. ทำคอมโบโจมทีมอนสเตอร์",
    detail: "เมื่อจับคู่สำเร็จ รูนจะระเบิดสร้างพลังเวทโจมตีลดเลือดมอนสเตอร์ด้านบน",
    icon: Swords,
  },
  {
    step: 4,
    title: "4. ใช้สกิลช่วยเหลือพิเศษ",
    detail: "ใช้ปุ่ม Shuffle (สับกระดาน), Freeze (แช่แข็งมอนสเตอร์) หรือ Hint เมื่อหาคู่ไม่เจอ",
    icon: Zap,
  },
];

export function RuneMatchTeachingGame({ vocabulary, mode, fullscreen = false }: RuneMatchTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((w) => w.term && w.translation);
    return usable.length >= 4 ? usable : FALLBACK_WORDS;
  }, [vocabulary]);

  const [key, setKey] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);

  useEffect(() => {
    if (mode !== "tutorial") return;
    const interval = setInterval(() => {
      setTutorialStep((prev) => (prev + 1) % TUTORIAL_STEPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [mode]);

  const handleComplete = React.useCallback(() => {
    setKey((prev) => prev + 1);
  }, []);

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;

  return (
    <div
      key={key}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : "min-h-[520px] rounded-[32px] shadow-2xl"
      }`}
      data-testid={`rune-match-${mode}`}
    >
      <RuneMatchGame
        vocabulary={words}
        tutorialMode={mode === "tutorial"}
        tutorialStep={tutorialStep}
        onComplete={handleComplete}
      />

      {mode === "tutorial" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-none">
          <div className="flex items-center gap-3.5 rounded-2xl border border-indigo-400/50 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25">
              <StepIcon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-indigo-300 border border-indigo-500/30">
                  ขั้นตอนที่ {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </span>
              </div>
              <p className="mt-1 text-lg font-black text-white leading-tight">{currentStep.title}</p>
              <p className="text-xs font-semibold text-white/70 leading-snug mt-0.5">{currentStep.detail}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {TUTORIAL_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTutorialStep(idx)}
                  className={`h-2.5 rounded-full transition-all pointer-events-auto ${
                    idx === tutorialStep ? "w-7 bg-indigo-400 shadow-md shadow-indigo-400/50" : "w-2.5 bg-white/20 hover:bg-white/40"
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
