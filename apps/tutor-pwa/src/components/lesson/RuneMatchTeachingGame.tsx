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
    if (mode === "teacher" || mode === "tutorial") return;
    setKey((prev) => prev + 1);
  }, [mode]);

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;

  return (
    <div
      key={key}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none pb-28 sm:pb-28" : "min-h-[520px] rounded-[32px] shadow-2xl"
      }`}
      data-testid={`rune-match-${mode}`}
    >
      <RuneMatchGame
        vocabulary={words}
        tutorialMode={mode === "tutorial"}
        tutorialStep={tutorialStep}
        disableAutoFullscreen={true}
        onComplete={handleComplete}
      />

      {mode === "teacher" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4 pointer-events-none">
          <div className="flex items-center gap-3 rounded-2xl border border-amber-300/40 bg-slate-950/90 p-3 shadow-2xl backdrop-blur-md text-amber-200 text-xs font-black">
            <span className="flex size-7 items-center justify-center rounded-xl bg-amber-400 text-slate-950 font-black text-sm">👀</span>
            <span>Teacher Demo Mode: คุณครูกำลังกดจับคู่เล่นสาธิตให้ดูสดบนหน้าจอ</span>
          </div>
        </div>
      )}

    </div>
  );
}
