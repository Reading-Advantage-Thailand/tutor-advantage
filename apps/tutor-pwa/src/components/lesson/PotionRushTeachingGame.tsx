"use client";

import React, { useEffect, useState } from "react";
import PotionRushGame from "@/components/games/sentence/potion-rush/PotionRushGame";
import { Beaker, ShoppingBag, Send, Award } from "lucide-react";

export type PotionRushTeachingSentence = {
  term: string;
  translation?: string;
};

type TeachingMode = "teacher" | "tutorial";

type PotionRushTeachingGameProps = {
  vocabulary: PotionRushTeachingSentence[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_SENTENCES: PotionRushTeachingSentence[] = [
  { term: "Students read the article carefully", translation: "นักเรียนใช้วิธีอ่านบทความอย่างละเอียด" },
  { term: "The teacher asks a follow up question", translation: "คุณครูถามคำถามติดตามผลเพิ่มเติม" },
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: "1. สังเกตออเดอร์ของลูกค้า",
    detail: "ดูคำสั่งประโยคยาที่ลูกค้าเดินเข้ามาสั่งซื้อในร้านขายยาเวทมนตร์",
    icon: ShoppingBag,
  },
  {
    step: 2,
    title: "2. เลือกขวดยาปรุงตามลำดับประโยค",
    detail: "คลิกเลือกขวดยาคำศัพท์ให้เรียงถูกต้องตรงตามโครงสร้างประโยคภาษาอังกฤษ",
    icon: Beaker,
  },
  {
    step: 3,
    title: "3. ส่งมอบยาให้ลูกค้าก่อนเวลาหมด",
    detail: "เมื่อปรุงยาเสร็จเรียบร้อย นำขวดยาส่งให้ลูกค้าทันทีเพื่อทำคะแนน",
    icon: Send,
  },
  {
    step: 4,
    title: "4. รักษาระดับ Reputation ของร้าน",
    detail: "บริการลูกค้าทุกคนให้ทันเวลา เพื่อสะสมค่าชื่อเสียง (Reputation) และผ่านด่าน",
    icon: Award,
  },
];

export function PotionRushTeachingGame({ vocabulary, mode, fullscreen = false }: PotionRushTeachingGameProps) {
  const sentences = React.useMemo(() => {
    const usable = vocabulary.filter((s) => s.term);
    return usable.length >= 1 ? usable : FALLBACK_SENTENCES;
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
    return sentences.map((s, idx) => ({
      id: `sent-${idx}`,
      sentence: s.term,
      sentences: s.term,
      translation: s.translation || "",
    }));
  }, [sentences]);

  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;

  return (
    <div
      key={key}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : "min-h-[520px] rounded-[32px] shadow-2xl"
      }`}
      data-testid={`potion-rush-${mode}`}
    >
      <PotionRushGame
        vocabList={formattedVocab as any}
        difficulty="normal"
        autoStart={true}
        tutorialMode={mode === "tutorial"}
        onComplete={() => setKey((k) => k + 1)}
      />

      {mode === "tutorial" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-none">
          <div className="flex items-center gap-3.5 rounded-2xl border border-violet-400/50 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-500/25">
              <StepIcon size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-violet-300 border border-violet-500/30">
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
                    idx === tutorialStep ? "w-7 bg-violet-400 shadow-md shadow-violet-400/50" : "w-2.5 bg-white/20 hover:bg-white/40"
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
