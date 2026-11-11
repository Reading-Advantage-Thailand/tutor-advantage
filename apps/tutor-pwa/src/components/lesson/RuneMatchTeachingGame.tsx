"use client";

import React, { useEffect, useState } from "react";
import { RuneMatchGame } from "@/components/games/vocabulary/rune-match/RuneMatchGame";
import { hasUsableVocabulary } from "@/lib/games/lessonContent";
import { TeachingEndCard } from "./TeachingEndCard";
import { TEACHING_STAGE_HEIGHT, useStageScale } from "./teachingStageSize";

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

// RuneMatchGame draws the steps itself; this only moves it to the next one.
const TUTORIAL_STEP_COUNT = 4;

export function RuneMatchTeachingGame({ vocabulary, mode, fullscreen = false }: RuneMatchTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((w) => w.term && w.translation);
    return hasUsableVocabulary(usable) ? usable : FALLBACK_WORDS;
  }, [vocabulary]);

  const { stageRef, scale } = useStageScale<HTMLDivElement>();
  const [key, setKey] = useState(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [roundEnd, setRoundEnd] = useState<{ won: boolean; correctAnswers: number } | null>(null);

  useEffect(() => {
    if (mode !== "tutorial") return;
    const interval = setInterval(() => {
      setTutorialStep((prev) => (prev + 1) % TUTORIAL_STEP_COUNT);
    }, 4500);
    return () => clearInterval(interval);
  }, [mode]);

  // Demos have no result to hand over: the end card below is where a teacher demo stops.
  const handleComplete = React.useCallback(() => {}, []);

  return (
    <div
      ref={stageRef}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${
        fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : `${TEACHING_STAGE_HEIGHT} rounded-[32px] shadow-2xl`
      }`}
      data-testid={`rune-match-${mode}`}
    >
      <RuneMatchGame
        key={key}
        presenter={mode === "teacher" ? { scale, onRoundEnd: setRoundEnd } : { scale }}
        vocabulary={words}
        tutorialMode={mode === "tutorial"}
        tutorialStep={tutorialStep}
        disableAutoFullscreen={true}
        restartOnComplete={mode === "teacher"}
        statusBanner={
          mode === "teacher" ? (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-300/40 bg-slate-950/90 p-2.5 text-xs font-black leading-snug text-amber-200 shadow-2xl backdrop-blur-md">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-sm text-slate-950">👀</span>
              <span>โหมดสาธิต: คุณครูกำลังกดจับคู่เล่นสาธิตให้ดูสดบนหน้าจอ</span>
            </div>
          ) : undefined
        }
        onComplete={handleComplete}
      />
      {roundEnd && (
        <TeachingEndCard
          title={roundEnd.won ? "ชนะ! จับคู่ครบ" : "หมดเวลา"}
          detail={`จับคู่ได้ ${roundEnd.correctAnswers} คู่`}
          scale={scale}
          onReplay={() => {
            setRoundEnd(null);
            setKey((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
}
