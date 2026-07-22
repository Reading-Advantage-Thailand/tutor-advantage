"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Flame, MousePointerClick, Sparkles } from "lucide-react";

export type DragonFlightTeachingWord = {
  term: string;
  translation: string;
};

type GateSide = "left" | "right";
type TeachingMode = "teacher" | "tutorial";

type DragonFlightTeachingGameProps = {
  vocabulary: DragonFlightTeachingWord[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_WORDS: DragonFlightTeachingWord[] = [
  { term: "explore", translation: "สำรวจ" },
  { term: "ancient", translation: "เก่าแก่" },
  { term: "journey", translation: "การเดินทาง" },
];

const TUTORIAL_COPY = [
  { title: "อ่านคำศัพท์", detail: "ดูคำศัพท์เป้าหมายด้านบนก่อน", target: "prompt" },
  { title: "เปรียบเทียบสองประตู", detail: "อ่านความหมายทั้งซ้ายและขวา", target: "gates" },
  { title: "บินเข้าประตูที่ถูก", detail: "กดลูกศรหรือคลิกประตูที่ตรงกับคำศัพท์", target: "correct" },
  { title: "สะสมฝูงมังกร", detail: "ตอบถูกต่อเนื่องเพื่อเพิ่มจำนวนมังกร", target: "score" },
] as const;

export function DragonFlightTeachingGame({ vocabulary, mode, fullscreen = false }: DragonFlightTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((word) => word.term && word.translation);
    return usable.length >= 2 ? usable : FALLBACK_WORDS;
  }, [vocabulary]);
  const [roundIndex, setRoundIndex] = React.useState(0);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [feedback, setFeedback] = React.useState<"correct" | "incorrect" | null>(null);
  const [chosenSide, setChosenSide] = React.useState<GateSide | null>(null);
  const [dragonCount, setDragonCount] = React.useState(1);
  const [correctAnswers, setCorrectAnswers] = React.useState(0);

  const current = words[roundIndex % words.length];
  const decoy = words[(roundIndex + 1) % words.length];
  const correctSide: GateSide = roundIndex % 2 === 0 ? "right" : "left";
  const labels = {
    left: correctSide === "left" ? current.translation : decoy.translation,
    right: correctSide === "right" ? current.translation : decoy.translation,
  };

  const nextRound = React.useCallback(() => {
    setRoundIndex((round) => round + 1);
    setFeedback(null);
    setChosenSide(null);
    setTutorialStep(0);
  }, []);

  const chooseGate = React.useCallback((side: GateSide) => {
    if (feedback) return;
    const isCorrect = side === correctSide;
    setChosenSide(side);
    setFeedback(isCorrect ? "correct" : "incorrect");
    setTutorialStep(3);
    if (isCorrect) {
      setDragonCount((count) => count + 1);
      setCorrectAnswers((count) => count + 1);
    } else {
      setDragonCount((count) => Math.max(1, count - 1));
    }
  }, [correctSide, feedback]);

  React.useEffect(() => {
    setRoundIndex(0);
    setTutorialStep(0);
    setFeedback(null);
    setChosenSide(null);
    setDragonCount(1);
    setCorrectAnswers(0);
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "teacher" || feedback) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") chooseGate("left");
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") chooseGate("right");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseGate, feedback, mode]);

  React.useEffect(() => {
    if (mode !== "teacher" || !feedback) return;
    const timer = window.setTimeout(nextRound, 1200);
    return () => window.clearTimeout(timer);
  }, [feedback, mode, nextRound]);

  React.useEffect(() => {
    if (mode !== "tutorial") return;
    const timers = [
      window.setTimeout(() => setTutorialStep(1), 1500),
      window.setTimeout(() => setTutorialStep(2), 3200),
      window.setTimeout(() => chooseGate(correctSide), 4700),
      window.setTimeout(nextRound, 6500),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [chooseGate, correctSide, mode, nextRound, roundIndex]);

  const gateClass = (side: GateSide) => {
    const isCorrectGate = side === correctSide;
    const isChosen = chosenSide === side;
    const highlighted = mode === "tutorial" && tutorialStep === 2 && isCorrectGate;
    if (isChosen && feedback === "correct") return "ring-8 ring-emerald-300/80 bg-emerald-400/25 scale-105";
    if (isChosen && feedback === "incorrect") return "ring-8 ring-rose-400/80 bg-rose-500/25";
    if (highlighted) return "ring-8 ring-amber-300/90 bg-amber-300/20 scale-105 animate-pulse";
    if (mode === "tutorial" && tutorialStep === 1) return "ring-4 ring-cyan-300/60";
    return "ring-1 ring-white/20 hover:ring-4 hover:ring-cyan-300/70";
  };

  return (
    <div
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : "min-h-[500px] rounded-[32px] shadow-2xl"}`}
      data-testid={`dragon-flight-${mode}`}
    >
      <div className="absolute inset-0 bg-[url('/games/vocabulary/dragon-flight/parallax-bottom-tiling.png')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[url('/games/vocabulary/dragon-flight/parallax-middle-tiling.png')] bg-cover bg-center opacity-80 animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/10 via-sky-900/5 to-slate-950/70" />

      <div className={`relative z-10 flex flex-col p-5 sm:p-7 ${fullscreen ? "h-full min-h-0 pb-28 sm:pb-28" : "min-h-[500px]"}`}>
        <div className="grid grid-cols-[minmax(150px,auto)_1fr_auto] items-start gap-4">
          <div className={`rounded-2xl border bg-black/45 px-5 py-3 backdrop-blur transition-all ${mode === "tutorial" && tutorialStep === 0 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">คำศัพท์เป้าหมาย</p>
            <p className="mt-1 text-3xl font-black">{current.term}</p>
          </div>
          <div className="mt-2 h-5 overflow-hidden rounded-full border border-white/10 bg-black/30">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-violet-500" />
          </div>
          <div className={`rounded-2xl border bg-black/45 px-5 py-3 text-right backdrop-blur transition-all ${mode === "tutorial" && tutorialStep === 3 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/55"><Flame size={12} className="text-amber-300" /> มังกร</p>
            <p className="mt-1 text-3xl font-black">{dragonCount}</p>
          </div>
        </div>

        <div className={`relative grid min-h-0 flex-1 grid-cols-2 items-center gap-10 px-8 ${fullscreen ? "mt-3" : "mt-8"}`}>
          {(["left", "right"] as GateSide[]).map((side) => (
            <button key={side} type="button" disabled={mode === "tutorial" || !!feedback} onClick={() => chooseGate(side)} className={`group relative mx-auto flex h-64 w-48 flex-col items-center justify-end rounded-[80px] border border-white/15 pb-4 transition-all duration-500 disabled:cursor-default ${gateClass(side)}`}>
              <div className="absolute inset-x-2 top-0 h-52 bg-[url('/games/vocabulary/dragon-flight/gates-3x3-sheet-facing-up.png')] bg-[length:300%_300%] bg-[position:0%_0%] bg-no-repeat drop-shadow-[0_15px_20px_rgba(0,0,0,0.5)]" />
              <span className="relative z-10 min-w-[140px] rounded-2xl border border-white/15 bg-black/75 px-4 py-3 text-center text-xl font-black shadow-xl backdrop-blur">{labels[side]}</span>
              {mode === "tutorial" && tutorialStep === 2 && side === correctSide && <span className="absolute -top-4 rounded-full bg-amber-300 px-4 py-2 text-xs font-black text-slate-950 shadow-xl">เลือกประตูนี้</span>}
            </button>
          ))}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div className={`h-32 w-32 bg-[url('/games/vocabulary/dragon-flight/player-3x3-sheet-facing-down.png')] bg-[length:300%_300%] bg-[position:50%_50%] bg-no-repeat drop-shadow-[0_18px_16px_rgba(0,0,0,0.65)] transition-transform duration-700 ${chosenSide === "left" ? "-translate-x-52 -translate-y-24" : chosenSide === "right" ? "translate-x-52 -translate-y-24" : ""}`} />
          </div>
        </div>

        <div className="relative z-20 mt-3 flex items-center justify-between gap-4">
          {mode === "teacher" ? (
            <>
              <button type="button" disabled={!!feedback} onClick={() => chooseGate("left")} className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black backdrop-blur hover:bg-white/20 disabled:opacity-50"><ArrowLeft size={20} /> A / ลูกศรซ้าย</button>
              <p className={`rounded-full px-5 py-2 text-sm font-black ${feedback === "correct" ? "bg-emerald-400 text-emerald-950" : feedback === "incorrect" ? "bg-rose-500 text-white" : "bg-black/40 text-white/65"}`}>{feedback === "correct" ? `✓ ถูกต้อง · ${correctAnswers} คะแนน` : feedback === "incorrect" ? "ยังไม่ถูก ลองอธิบายให้เด็กเห็นจุดสังเกต" : "คลิกประตูหรือใช้คีย์บอร์ดเพื่อเล่น"}</p>
              <button type="button" disabled={!!feedback} onClick={() => chooseGate("right")} className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-black backdrop-blur hover:bg-white/20 disabled:opacity-50">D / ลูกศรขวา <ArrowRight size={20} /></button>
            </>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl items-center gap-4 rounded-3xl border border-amber-300/30 bg-slate-950/85 p-4 shadow-2xl backdrop-blur">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">{tutorialStep === 2 ? <MousePointerClick size={24} /> : <Sparkles size={24} />}</div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-amber-300">ขั้นตอน {tutorialStep + 1} / 4</p><p className="mt-0.5 text-lg font-black">{TUTORIAL_COPY[tutorialStep].title}</p><p className="text-sm font-semibold text-white/60">{TUTORIAL_COPY[tutorialStep].detail}</p></div>
              <div className="flex gap-1.5">{TUTORIAL_COPY.map((_step, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === tutorialStep ? "w-8 bg-amber-300" : "w-2 bg-white/20"}`} />)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
