"use client";

import React from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Flame, MousePointerClick, Sparkles } from "lucide-react";
import { MS_PER_WORD } from "@/lib/games/dragonFlight";
import { tx } from "@/lib/games/gameText";
import { hasUsableVocabulary } from "@/lib/games/lessonContent";
import { pickDecoys } from "@/lib/games/pickDecoys";
import { TEACHING_STAGE_HEIGHT, useStageScale } from "./teachingStageSize";

export type DragonFlightTeachingWord = {
  term: string;
  translation: string;
};

type GateSide = "left" | "right";
type TeachingMode = "teacher" | "tutorial";
/** "timeout": nobody answered before the gates reached the dragon. */
type Feedback = "correct" | "incorrect" | "timeout";

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
  { title: "อ่านคำศัพท์", detail: "ดูคำในกล่องหาคำแปลด้านบนก่อน", target: "prompt" },
  { title: "เปรียบเทียบสองประตู", detail: "อ่านความหมายทั้งซ้ายและขวา ประตูลอยลงมา มีเวลาคำละ 5 วินาที", target: "gates" },
  { title: "บินเข้าประตูที่ถูก", detail: "กดลูกศรซ้ายหรือขวาที่ตรงกับคำศัพท์", target: "correct" },
  { title: "สะสมฝูงมังกร", detail: "ตอบถูกได้ 1 คะแนน และมังกรเพิ่มขึ้น", target: "score" },
] as const;

const TUTORIAL_STEP_MS = 3000;
const TUTORIAL_ANSWER_AT_MS = TUTORIAL_STEP_MS * 3;
const TUTORIAL_NEXT_WORD_AT_MS = TUTORIAL_STEP_MS * 4;
const NEXT_WORD_AFTER_RIGHT_MS = 1400;

/** Small seeded generator: the same round always reads the same, however often the stage re-renders. */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export type DragonRound = {
  word: DragonFlightTeachingWord;
  correctSide: GateSide;
  labels: Record<GateSide, string>;
};

/**
 * One word's two gates. The side and the wrong answer come from a random pick, so
 * the class cannot learn the answer from a left-right pattern or from last round's
 * wrong gate. Two words can share a meaning, so the wrong gate must read differently.
 */
export function buildDragonRound(words: readonly DragonFlightTeachingWord[], roundIndex: number, seed: number): DragonRound {
  const word = words[roundIndex % words.length];
  const random = seededRandom(seed + roundIndex * 7919);
  const correctSide: GateSide = random() < 0.5 ? "left" : "right";
  const decoy = pickDecoys(word, words as DragonFlightTeachingWord[], 1, random)[0] ?? word;
  return {
    word,
    correctSide,
    labels: {
      left: correctSide === "left" ? word.translation : decoy.translation,
      right: correctSide === "right" ? word.translation : decoy.translation,
    },
  };
}

function feedbackMessage(feedback: Feedback | null, round: DragonRound, correctAnswers: number) {
  if (feedback === "correct") return `ถูกต้อง · ${correctAnswers} คะแนน`;
  if (feedback === "incorrect") return `ยังไม่ถูก · คำตอบคือ ${round.word.translation}`;
  if (feedback === "timeout") return `หมดเวลา · คำตอบคือ ${round.word.translation}`;
  return "คลิกประตู หรือกดปุ่มลูกศรซ้าย-ขวา";
}

export function DragonFlightTeachingGame({ vocabulary, mode, fullscreen = false }: DragonFlightTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((word) => word.term && word.translation);
    return hasUsableVocabulary(usable) ? usable : FALLBACK_WORDS;
  }, [vocabulary]);
  const { stageRef, scale } = useStageScale<HTMLDivElement>();
  const [seed] = React.useState(() => Math.floor(Math.random() * 1_000_000));
  const [roundIndex, setRoundIndex] = React.useState(0);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [chosenSide, setChosenSide] = React.useState<GateSide | null>(null);
  const [dragonCount, setDragonCount] = React.useState(1);
  const [correctAnswers, setCorrectAnswers] = React.useState(0);
  const [flight, setFlight] = React.useState<{ x: number; y: number } | null>(null);

  const round = React.useMemo(() => buildDragonRound(words, roundIndex, seed), [words, roundIndex, seed]);
  const { correctSide, labels } = round;

  const fieldRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLDivElement>(null);
  const dragonRef = React.useRef<HTMLDivElement>(null);
  const gateRefs = React.useRef<Record<GateSide, HTMLDivElement | null>>({ left: null, right: null });
  const scaleRef = React.useRef(scale);
  scaleRef.current = scale;

  const nextRound = React.useCallback(() => {
    setRoundIndex((index) => index + 1);
    setFeedback(null);
    setChosenSide(null);
    setFlight(null);
    setTutorialStep(0);
  }, []);

  // The dragon flies to wherever the gate is now, at any stage size.
  const flyInto = React.useCallback((side: GateSide) => {
    const gate = gateRefs.current[side]?.getBoundingClientRect();
    const dragon = dragonRef.current?.getBoundingClientRect();
    if (!gate || !dragon) return;
    const zoom = scaleRef.current || 1;
    setFlight({
      x: (gate.left + gate.width / 2 - (dragon.left + dragon.width / 2)) / zoom,
      y: (gate.top + gate.height / 2 - (dragon.top + dragon.height / 2)) / zoom,
    });
  }, []);

  const chooseGate = React.useCallback((side: GateSide) => {
    if (feedback) return;
    const isCorrect = side === correctSide;
    setChosenSide(side);
    setFeedback(isCorrect ? "correct" : "incorrect");
    setTutorialStep(3);
    flyInto(side);
    if (isCorrect) {
      setDragonCount((count) => count + 1);
      setCorrectAnswers((count) => count + 1);
    } else {
      setDragonCount((count) => Math.max(1, count - 1));
    }
  }, [correctSide, feedback, flyInto]);

  React.useEffect(() => {
    setRoundIndex(0);
    setTutorialStep(0);
    setFeedback(null);
    setChosenSide(null);
    setFlight(null);
    setDragonCount(1);
    setCorrectAnswers(0);
  }, [mode]);

  // A right answer moves on by itself. After a wrong one the class is looking at the
  // right gate, so the tutor decides when to go on.
  React.useEffect(() => {
    if (mode !== "teacher" || feedback !== "correct") return;
    const timer = window.setTimeout(nextRound, NEXT_WORD_AFTER_RIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [feedback, mode, nextRound]);

  React.useEffect(() => {
    if (mode !== "teacher") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      // The dock has its own Tab stop: a key on one of its buttons is for that button.
      if ((event.target as HTMLElement | null)?.closest("button, a, input, textarea, select")) return;
      if (!feedback) {
        if (key === "arrowleft" || key === "a") chooseGate("left");
        if (key === "arrowright" || key === "d") chooseGate("right");
        return;
      }
      if (feedback !== "correct" && (key === "enter" || key === " " || key === "arrowright")) {
        event.preventDefault();
        nextRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [chooseGate, feedback, mode, nextRound]);

  // One timeline per word. Nothing here may depend on what the answer changes, or
  // the steps would start over after the answer and run backwards.
  React.useEffect(() => {
    if (mode !== "tutorial") return;
    const timers = [
      window.setTimeout(() => setTutorialStep(1), TUTORIAL_STEP_MS),
      window.setTimeout(() => setTutorialStep(2), TUTORIAL_STEP_MS * 2),
      window.setTimeout(() => {
        setChosenSide(round.correctSide);
        setFeedback("correct");
        setTutorialStep(3);
        flyInto(round.correctSide);
        setDragonCount((count) => count + 1);
        setCorrectAnswers((count) => count + 1);
      }, TUTORIAL_ANSWER_AT_MS),
      window.setTimeout(nextRound, TUTORIAL_NEXT_WORD_AT_MS),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [flyInto, mode, nextRound, round]);

  // The clock the phone has: a real countdown while the gates float down to the dragon.
  const roundMs = mode === "tutorial" ? TUTORIAL_ANSWER_AT_MS : MS_PER_WORD;
  React.useEffect(() => {
    const field = fieldRef.current;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const running: Animation[] = [];
    const bar = barRef.current?.animate?.([{ width: "100%" }, { width: "0%" }], { duration: roundMs, fill: "forwards", easing: "linear" });
    if (bar) running.push(bar);
    if (field && !reduceMotion) {
      for (const gate of Object.values(gateRefs.current)) {
        if (!gate) continue;
        // Unzoomed lengths on both sides, so the gate stays inside its row at any stage size.
        const room = Math.max(0, field.offsetHeight - gate.offsetHeight) / 2;
        const animation = gate.animate?.(
          [{ transform: `translateY(${-room}px)` }, { transform: `translateY(${room}px)` }],
          { duration: roundMs, fill: "forwards", easing: "linear" },
        );
        if (animation) running.push(animation);
      }
    }
    return () => running.forEach((animation) => animation.cancel());
    // A new word starts it again, and so does a resized stage.
  }, [roundIndex, roundMs, mode, scale]);

  // An answer stops the clock where it is.
  React.useEffect(() => {
    if (!feedback) return;
    for (const node of [barRef.current, gateRefs.current.left, gateRefs.current.right]) {
      node?.getAnimations?.().forEach((animation) => animation.pause());
    }
  }, [feedback]);

  // Nobody answered: show the right gate and let the tutor talk about it.
  React.useEffect(() => {
    if (mode !== "teacher" || feedback) return;
    const timer = window.setTimeout(() => setFeedback("timeout"), MS_PER_WORD);
    return () => window.clearTimeout(timer);
  }, [feedback, mode, roundIndex]);

  const gateClass = (side: GateSide) => {
    const isCorrectGate = side === correctSide;
    const isChosen = chosenSide === side;
    const highlighted = mode === "tutorial" && tutorialStep === 2 && !feedback && isCorrectGate;
    if (feedback && isCorrectGate) return "ring-8 ring-emerald-300/80 bg-emerald-400/25 scale-105";
    if (isChosen && feedback === "incorrect") return "ring-8 ring-rose-400/80 bg-rose-500/25";
    if (highlighted) return "ring-8 ring-amber-300/90 bg-amber-300/20 scale-105 animate-pulse";
    if (mode === "tutorial" && tutorialStep === 1) return "ring-4 ring-cyan-300/60";
    return "ring-1 ring-white/20 hover:ring-4 hover:ring-cyan-300/70";
  };

  const canGoOn = mode === "teacher" && (feedback === "incorrect" || feedback === "timeout");

  return (
    <div
      ref={stageRef}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : `${TEACHING_STAGE_HEIGHT} rounded-[32px] shadow-2xl`}`}
      data-testid={`dragon-flight-${mode}`}
    >
      <div className="absolute inset-0 bg-[url('/games/vocabulary/dragon-flight/parallax-bottom-tiling.webp')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-[url('/games/vocabulary/dragon-flight/parallax-middle-tiling.webp')] bg-cover bg-center opacity-80 animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/10 via-sky-900/5 to-slate-950/70" />

      <div style={{ zoom: scale }} className="relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(150px,auto)_1fr_auto] items-start gap-4">
          <div className={`rounded-2xl border bg-black/55 px-5 py-2.5 backdrop-blur transition-all ${mode === "tutorial" && tutorialStep === 0 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="text-sm font-black text-white/70">{tx("Find")}</p>
            <p className="text-4xl font-black text-amber-300">{round.word.term}</p>
          </div>
          <div className="mt-2 h-5 overflow-hidden rounded-full border border-white/10 bg-black/30" data-testid="dragon-countdown">
            <div ref={barRef} className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-blue-500 to-violet-500" />
          </div>
          <div className={`rounded-2xl border bg-black/55 px-5 py-2.5 text-right backdrop-blur transition-all ${mode === "tutorial" && tutorialStep === 3 ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="flex items-center gap-1 text-sm font-black text-white/70"><Flame size={15} className="text-amber-300" /> มังกร</p>
            <p className="text-4xl font-black">{dragonCount}</p>
          </div>
        </div>

        <div ref={fieldRef} className="relative mt-2 grid min-h-0 flex-1 grid-cols-2 items-center gap-10 px-8">
          {(["left", "right"] as GateSide[]).map((side) => (
            <div key={side} ref={(node) => { gateRefs.current[side] = node; }} className="mx-auto">
              {/* A new key for each word, so last round's red does not fade across the new word. */}
              <button
                key={roundIndex}
                type="button"
                disabled={mode === "tutorial" || !!feedback}
                onClick={() => chooseGate(side)}
                className={`group relative flex h-64 w-56 flex-col items-center justify-end rounded-[80px] border border-white/15 pb-4 transition-transform duration-300 disabled:cursor-default ${gateClass(side)}`}
                data-testid={`dragon-gate-${side}`}
              >
                <div className="absolute inset-x-4 top-0 h-52 bg-[url('/games/vocabulary/dragon-flight/gates-3x3-sheet-facing-up.webp')] bg-[length:300%_300%] bg-[position:0%_0%] bg-no-repeat drop-shadow-[0_15px_20px_rgba(0,0,0,0.5)]" />
                <span className="relative z-10 min-w-[140px] max-w-[300px] rounded-2xl border border-white/15 bg-black/80 px-4 py-2.5 text-center text-2xl font-black leading-tight shadow-xl backdrop-blur">{labels[side]}</span>
                {mode === "tutorial" && tutorialStep === 2 && !feedback && side === correctSide && <span className="absolute -top-4 rounded-full bg-amber-300 px-4 py-2 text-sm font-black text-slate-950 shadow-xl">เลือกประตูนี้</span>}
              </button>
            </div>
          ))}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div
              ref={dragonRef}
              data-testid="dragon-player"
              className="h-32 w-32 bg-[url('/games/vocabulary/dragon-flight/player-3x3-sheet-facing-down.webp')] bg-[length:300%_300%] bg-[position:50%_50%] bg-no-repeat drop-shadow-[0_18px_16px_rgba(0,0,0,0.65)] transition-transform duration-700"
              style={flight ? { transform: `translate(${flight.x}px, ${flight.y}px) scale(0.7)` } : undefined}
            />
          </div>
        </div>

        <div className="relative z-20 mt-2 flex items-center justify-between gap-4">
          {mode === "teacher" ? (
            <>
              <button type="button" aria-label="ประตูซ้าย" disabled={!!feedback} onClick={() => chooseGate("left")} className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-lg font-black backdrop-blur hover:bg-white/20 disabled:opacity-50"><ArrowLeft size={26} /> <span className="text-sm font-bold text-white/70">A</span></button>
              <div className="flex min-w-0 items-center gap-2">
                <p role="status" data-testid="dragon-message" className={`min-w-0 rounded-full px-5 py-2 text-center text-lg font-black leading-tight ${feedback === "correct" ? "bg-emerald-400 text-emerald-950" : feedback ? "bg-rose-500 text-white" : "bg-black/50 text-white/80"}`}>{feedbackMessage(feedback, round, correctAnswers)}</p>
                {canGoOn && (
                  <button type="button" data-testid="dragon-next" onClick={nextRound} className="flex shrink-0 items-center gap-1 rounded-full bg-white px-5 py-2 text-lg font-black text-slate-950 shadow-xl hover:bg-white/90">
                    ไปข้อต่อไป <ChevronRight size={22} />
                  </button>
                )}
              </div>
              <button type="button" aria-label="ประตูขวา" disabled={!!feedback} onClick={() => chooseGate("right")} className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-2.5 text-lg font-black backdrop-blur hover:bg-white/20 disabled:opacity-50"><span className="text-sm font-bold text-white/70">D</span> <ArrowRight size={26} /></button>
            </>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl items-center gap-4 rounded-3xl border border-amber-300/30 bg-slate-950/85 p-3 shadow-2xl backdrop-blur">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">{tutorialStep === 2 ? <MousePointerClick size={24} /> : <Sparkles size={24} />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-black text-amber-300">ขั้นตอน {tutorialStep + 1} / 4</p><p className="text-xl font-black leading-tight">{TUTORIAL_COPY[tutorialStep].title}</p><p className="text-base font-semibold leading-snug text-white/70">{TUTORIAL_COPY[tutorialStep].detail}</p></div>
              <div className="flex gap-1.5">{TUTORIAL_COPY.map((_step, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === tutorialStep ? "w-8 bg-amber-300" : "w-2 bg-white/20"}`} />)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
