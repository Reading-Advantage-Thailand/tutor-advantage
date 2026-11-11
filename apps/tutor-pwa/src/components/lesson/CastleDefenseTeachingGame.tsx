"use client";

import React, { useEffect, useState } from "react";
import { CastleDefenseGame } from "@/components/games/sentence/castle-defense/CastleDefenseGame";
import { BookOpen, Compass, Hammer, Shield } from "lucide-react";
import { hasThaiText } from "@/lib/games/lessonContent";
import { TeachingEndCard } from "./TeachingEndCard";
import { TEACHING_STAGE_HEIGHT, useStageScale } from "./teachingStageSize";

export type CastleDefenseTeachingSentence = {
  term: string;
  translation?: string;
  thaiTranslation?: string;
  audioUrl?: string;
};

type TeachingMode = "teacher" | "tutorial";

type CastleDefenseTeachingGameProps = {
  vocabulary: CastleDefenseTeachingSentence[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

// The round on the phones, which the demo plays too.
const ROUND_MS = 60_000;

const FALLBACK_SENTENCES: CastleDefenseTeachingSentence[] = [
  { term: "Students read the article carefully", translation: "นักเรียนใช้วิธีอ่านบทความอย่างละเอียด" },
  { term: "The teacher asks a follow up question", translation: "คุณครูถามคำถามติดตามผลเพิ่มเติม" },
];

// Most lessons store no Thai for their sentences, so step 1 must not promise it.
const FIRST_STEP_WITH_THAI = {
  step: 1,
  title: "1. อ่านประโยคแปลภาษาไทย",
  detail: "ดูคำแปลประโยคภาษาไทยด้านบนเพื่อหาคำศัพท์ภาษาอังกฤษที่หายไป",
  icon: BookOpen,
};
const FIRST_STEP_WITHOUT_THAI = {
  step: 1,
  title: "1. อ่านประโยคเป้าหมาย",
  detail: "อ่านประโยคด้านบนและจำลำดับคำให้ได้",
  icon: BookOpen,
};

const NEXT_TUTORIAL_STEPS = [
  {
    step: 2,
    title: "2. เดินเก็บลูกแก้วคำศัพท์เรียงประโยค",
    detail: "บังคับตัวละครเดินไปเก็บลูกแก้วคำศัพท์ให้เรียงถูกต้องตามโครงสร้างประโยค",
    icon: Compass,
  },
  {
    step: 3,
    title: "3. สร้างป้อมปราการป้องกันทางเดิน",
    detail: "ครบประโยคแล้วกดปุ่มสร้าง หรือเดินไปที่วงกลมเหลือง ป้อมจะตั้งขึ้นทันที",
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

  const { stageRef, scale } = useStageScale<HTMLDivElement>();
  const [key, setKey] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [roundEnd, setRoundEnd] = useState<{ score: number; sentences: number; castleFell: boolean } | null>(null);
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
      thaiTranslation: s.thaiTranslation,
      audioUrl: s.audioUrl,
    }));
  }, [sentences]);

  const promptHasThai = sentences.some((s) => hasThaiText(s.thaiTranslation || s.translation));
  const TUTORIAL_STEPS = [promptHasThai ? FIRST_STEP_WITH_THAI : FIRST_STEP_WITHOUT_THAI, ...NEXT_TUTORIAL_STEPS];
  const currentStep = TUTORIAL_STEPS[tutorialStep];
  const StepIcon = currentStep.icon;
  const handleTutorialStepChange = React.useCallback((step: number) => {
    setTutorialStep(Math.max(0, Math.min(NEXT_TUTORIAL_STEPS.length, step)));
  }, []);
  // The demo stops at the end of its round and the tutor replays when ready.
  const handleComplete = React.useCallback((results: { score?: number; correctAnswers?: number; durationMs?: number }) => {
    if (mode === "tutorial") return;
    // A round that stops before its minute is up ended because the castle fell.
    const castleFell = (results.durationMs ?? ROUND_MS) < ROUND_MS - 1000;
    setRoundEnd({ score: results.score ?? 0, sentences: results.correctAnswers ?? 0, castleFell });
  }, [mode]);
  const replay = React.useCallback(() => {
    setRoundEnd(null);
    setKey((k) => k + 1);
  }, []);

  return (
    <div
      ref={stageRef}
      // The game sizes itself to this frame (not the viewport), so the frame
      // needs a definite height: a 4:3 board-shaped stage capped to the screen
      // inline, or the remaining presenter stage in fullscreen.
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen
          ? "h-full min-h-[360px] flex-1 rounded-none shadow-none"
          : `${TEACHING_STAGE_HEIGHT} rounded-[32px] shadow-2xl`
      }`}
      data-testid={`castle-defense-${mode}`}
    >
      {roundEnd ? (
        <>
          <div className="absolute inset-0 bg-[url('/games/cover/castle-defense-cover.webp')] bg-cover bg-center" />
          <TeachingEndCard
            title={roundEnd.castleFell ? "ปราสาทแตก!" : "หมดเวลา"}
            lost={roundEnd.castleFell}
            detail={`ได้ ${roundEnd.score} คะแนน · ครบ ${roundEnd.sentences} ประโยค`}
            scale={scale}
            onReplay={replay}
          />
        </>
      ) : (
        <CastleDefenseGame
          key={key}
          vocabulary={formattedVocab as any}
          autoStart={true}
          tutorialMode={mode === "tutorial"}
          onTutorialStepChange={handleTutorialStepChange}
          onComplete={handleComplete}
          fit="contain"
          insetBottom={mode === "tutorial" ? tutorialCardInset : 0}
          presenterScale={scale}
        />
      )}

      {mode === "tutorial" && (
        <div ref={tutorialCardRef} className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 w-full max-w-[min(100%,calc(36rem*var(--stage-scale)))] px-4 pointer-events-none" style={{ "--stage-scale": scale } as React.CSSProperties}>
          <div style={{ zoom: scale }} className="flex items-center gap-3 rounded-2xl border border-emerald-400/50 bg-slate-950/95 px-3 py-2.5 shadow-2xl backdrop-blur-md">
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
              <p className="text-sm font-semibold text-white/70 leading-snug mt-0.5">{currentStep.detail}</p>
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
