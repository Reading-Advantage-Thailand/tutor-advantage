"use client";

import React, { useEffect, useState } from "react";
import { EnchantedLibraryGame } from "@/components/games/vocabulary/enchanted-library/EnchantedLibraryGame";
import { BookOpen, Compass, Shield, Sparkles, CheckCircle2, Ghost } from "lucide-react";

export type EnchantedLibraryTeachingWord = {
  term: string;
  translation: string;
};

type TeachingMode = "teacher" | "tutorial";

type EnchantedLibraryTeachingGameProps = {
  vocabulary: EnchantedLibraryTeachingWord[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_WORDS: EnchantedLibraryTeachingWord[] = [
  { term: "explore", translation: "สำรวจ" },
  { term: "ancient", translation: "เก่าแก่" },
  { term: "journey", translation: "การเดินทาง" },
  { term: "mystery", translation: "ปริศนา" },
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "1. อ่านคำศัพท์ภาษาอังกฤษเป้าหมาย",
    detail: "สังเกตกล่อง Find มุมขวาบน (เช่น clue) เพื่อเตรียมหาคำแปลภาษาไทย",
    icon: Sparkles,
  },
  {
    step: 2,
    title: "2. บังคับจอมเวทด้วยปุ่มทิศทาง D-Pad",
    detail: "สังเกตปุ่ม D-Pad ด้านล่างจะเรืองแสงสีฟ้าและขยับตามทิศทาง ขึ้น-ลง-ซ้าย-ขวา",
    icon: Compass,
  },
  {
    step: 3,
    title: "3. ค้นหาแท่นหนังสือคำแปลภาษาไทย",
    detail: "มองหาแท่นหนังสือที่มีคำแปลตรงกัน (สังเกตวงแหวนออร่าสีทองล้อมรอบหนังสือ)",
    icon: BookOpen,
  },
  {
    step: 4,
    title: "4. เดินชนหนังสือเพื่อสะสมคะแนน & Mana",
    detail: "เมื่อจอมเวทเดินชนหนังสือที่ถูกต้อง จะเกิดแสงประกาย ✨ และได้คะแนนทันที",
    icon: CheckCircle2,
  },
  {
    step: 5,
    title: "5. สังเกตและระวังผีวิญญาณสปีริต",
    detail: "อย่าให้ผีวิญญาณลอยเข้ามาชน หากโดนชน พลังเกราะ Mana จะลดลง",
    icon: Ghost,
  },
  {
    step: 6,
    title: "6. กดปุ่ม Shield เปิดเกราะกางบาเรีย",
    detail: "สังเกตปุ่ม Shield มุมขวาล่างจะเรืองแสงสีฟ้า กดเพื่อกางบาเรียป้องกันตัว",
    icon: Shield,
  },
];

export function EnchantedLibraryTeachingGame({ vocabulary, mode, fullscreen = false }: EnchantedLibraryTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((w) => w.term && w.translation);
    return usable.length >= 2 ? usable : FALLBACK_WORDS;
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

  const formattedVocab = React.useMemo(() => {
    return words.map((w, idx) => ({
      id: `word-${idx}`,
      term: w.term,
      translation: w.translation,
    }));
  }, [words]);

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;

  return (
    <div
      key={key}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : "min-h-[520px] rounded-[32px] shadow-2xl"
      }`}
      data-testid={`enchanted-library-${mode}`}
    >
      <EnchantedLibraryGame
        vocabulary={formattedVocab as any}
        difficulty="normal"
        onDifficultyChange={() => {}}
        rankings={{ easy: [], normal: [], hard: [], extreme: [] }}
        autoStart={true}
        tutorialMode={mode === "tutorial"}
        tutorialStep={tutorialStep}
        fullscreen={fullscreen}
        onComplete={() => setKey((k) => k + 1)}
      />

      {mode === "tutorial" && (
        <div className="absolute top-3 left-1/2 z-[70] w-full max-w-xl -translate-x-1/2 px-4 pointer-events-none">
          <div className="flex items-center gap-3.5 rounded-2xl border border-amber-400/50 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20">
              <StepIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300 border border-amber-400/30">
                  ขั้นตอนที่ {tutorialStep + 1} / {TUTORIAL_STEPS.length}
                </span>
              </div>
              <p className="mt-0.5 text-base font-black text-white leading-tight">{currentStep.title}</p>
              <p className="text-[11px] font-semibold text-white/70 leading-snug">{currentStep.detail}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {TUTORIAL_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTutorialStep(idx)}
                  className={`h-2 rounded-full transition-all pointer-events-auto ${
                    idx === tutorialStep ? "w-6 bg-amber-400 shadow-md shadow-amber-400/50" : "w-2 bg-white/20 hover:bg-white/40"
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
