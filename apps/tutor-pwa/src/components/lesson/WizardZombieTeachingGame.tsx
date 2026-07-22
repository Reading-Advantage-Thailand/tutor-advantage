"use client";

import React from "react";
import { Heart, MousePointerClick, Shield, Sparkles, WandSparkles } from "lucide-react";
import {
  advanceWizardZombieTime,
  createWizardZombieState,
  GAME_HEIGHT,
  GAME_WIDTH,
  type InputState,
  type WizardZombieState,
} from "@/lib/games/wizardZombie";

export type WizardZombieTeachingWord = {
  term: string;
  translation: string;
};

type TeachingMode = "teacher" | "tutorial";

type WizardZombieTeachingGameProps = {
  vocabulary: WizardZombieTeachingWord[];
  mode: TeachingMode;
  fullscreen?: boolean;
};

const FALLBACK_WORDS: WizardZombieTeachingWord[] = [
  { term: "explore", translation: "สำรวจ" },
  { term: "ancient", translation: "เก่าแก่" },
  { term: "journey", translation: "การเดินทาง" },
  { term: "mystery", translation: "ปริศนา" },
];

const TUTORIAL_COPY = [
  { title: "ดูคำศัพท์เป้าหมาย", detail: "อ่านคำที่ต้องตามหาในกล่อง Find", target: "target" },
  { title: "ใช้ WASD หรือลูกศร", detail: "พาพ่อมดเดินไปหาลูกแก้วที่ตรงคำศัพท์", target: "controls" },
  { title: "เก็บลูกแก้วที่ถูก", detail: "ลูกแก้วที่ถูกจะเพิ่มคะแนนและพลังป้องกัน", target: "orb" },
  { title: "หลบซอมบี้และใช้เวท", detail: "สะสม Shockwave แล้วใช้ Space เพื่อเปิดทาง", target: "zombie" },
] as const;

export function WizardZombieTeachingGame({ vocabulary, mode, fullscreen = false }: WizardZombieTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((word) => word.term && word.translation);
    return usable.length >= 4 ? usable : FALLBACK_WORDS;
  }, [vocabulary]);
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [tutorialCycle, setTutorialCycle] = React.useState(0);
  const [gameState, setGameState] = React.useState<WizardZombieState>(() => createWizardZombieState(words, { difficulty: "medium" }));
  const gameStateRef = React.useRef(gameState);
  const inputRef = React.useRef<InputState>({ dx: 0, dy: 0, cast: false });
  const previousScoreRef = React.useRef(gameState.score);
  const tutorialStepRef = React.useRef(tutorialStep);
  const tutorialCastRef = React.useRef(false);
  const [tutorialShockwave, setTutorialShockwave] = React.useState(false);

  React.useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  React.useEffect(() => { tutorialStepRef.current = tutorialStep; }, [tutorialStep]);

  React.useEffect(() => {
    const next = createWizardZombieState(words, { difficulty: "medium" });
    setGameState(next);
    gameStateRef.current = next;
    previousScoreRef.current = next.score;
    inputRef.current = { dx: 0, dy: 0, cast: false };
    tutorialCastRef.current = false;
    setTutorialShockwave(false);
    setTutorialStep(0);
  }, [mode, words]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", " ", "enter"].includes(key)) return;
      event.preventDefault();
      if (key === "arrowleft" || key === "a") inputRef.current.dx = -1;
      if (key === "arrowright" || key === "d") inputRef.current.dx = 1;
      if (key === "arrowup" || key === "w") inputRef.current.dy = -1;
      if (key === "arrowdown" || key === "s") inputRef.current.dy = 1;
      if (key === " " || key === "enter") inputRef.current.cast = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a" || key === "arrowright" || key === "d") inputRef.current.dx = 0;
      if (key === "arrowup" || key === "w" || key === "arrowdown" || key === "s") inputRef.current.dy = 0;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      const current = gameStateRef.current;
      const next = current.status === "gameover"
        ? createWizardZombieState(words, { difficulty: "medium" })
        : advanceWizardZombieTime(current, 50, inputRef.current, words);
      inputRef.current.cast = false;
      if (next.score > previousScoreRef.current && mode === "tutorial") setTutorialStep(3);
      previousScoreRef.current = next.score;
      gameStateRef.current = next;
      setGameState(next);
    }, 50);
    return () => window.clearInterval(interval);
  }, [mode, words]);

  React.useEffect(() => {
    if (mode !== "tutorial") return;
    tutorialCastRef.current = false;
    setTutorialShockwave(false);
    setTutorialStep(0);
    const timers = [
      window.setTimeout(() => setTutorialStep(1), 1400),
      window.setTimeout(() => {
        setTutorialStep(2);
        setGameState((current) => ({
          ...current,
          player: { ...current.player, x: 270, y: 300 },
          orbs: current.orbs.map((orb) => orb.isCorrect ? { ...orb, x: 530, y: 300 } : orb),
        }));
      }, 2800),
      window.setTimeout(() => {
        const next = createWizardZombieState(words, { difficulty: "medium" });
        gameStateRef.current = next;
        previousScoreRef.current = next.score;
        inputRef.current = { dx: 0, dy: 0, cast: false };
        setGameState(next);
        setTutorialCycle((cycle) => cycle + 1);
      }, 7200),
    ];
    const driver = window.setInterval(() => {
      const state = gameStateRef.current;
      if (state.correctAnswers > 0) {
        if (!tutorialCastRef.current) {
          tutorialCastRef.current = true;
          inputRef.current = { dx: 0, dy: 0, cast: true };
          const clearedState = { ...state, zombies: [] };
          gameStateRef.current = clearedState;
          setGameState(clearedState);
          setTutorialShockwave(true);
          window.setTimeout(() => setTutorialShockwave(false), 700);
          return;
        }
        inputRef.current = { dx: 0, dy: 0, cast: false };
        return;
      }
      if (tutorialStepRef.current < 2) return;
      const correctOrb = state.orbs.find((orb) => orb.isCorrect);
      if (!correctOrb) return;
      inputRef.current.dx = Math.abs(correctOrb.x - state.player.x) < 12 ? 0 : correctOrb.x > state.player.x ? 1 : -1;
      inputRef.current.dy = Math.abs(correctOrb.y - state.player.y) < 12 ? 0 : correctOrb.y > state.player.y ? 1 : -1;
    }, 80);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(driver);
      inputRef.current = { dx: 0, dy: 0, cast: false };
    };
  }, [mode, tutorialCycle, words]);

  const current = { term: gameState.targetWord };
  const orbs = gameState.orbs;

  const highlighted = (target: (typeof TUTORIAL_COPY)[number]["target"]) => mode === "tutorial" && TUTORIAL_COPY[tutorialStep].target === target;

  return (
    <div className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : "min-h-[500px] rounded-[32px] shadow-2xl"}`} data-testid={`wizard-zombie-${mode}`}>
      <div className="absolute inset-0 bg-[url('/games/vocabulary/wizard-vs-zombie/tile-ruins.png')] bg-[length:160px_160px] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(67,56,202,0.42),transparent_42%),linear-gradient(to_bottom,rgba(15,23,42,0.18),rgba(2,6,23,0.86))]" />

      <div className={`relative z-10 flex flex-col p-5 sm:p-7 ${fullscreen ? "h-full min-h-0 pb-28 sm:pb-28" : "min-h-[500px]"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className={`rounded-2xl border bg-black/55 px-5 py-3 backdrop-blur transition-all ${highlighted("target") ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Find</p>
            <p className="mt-1 text-3xl font-black text-amber-300">{current.term}</p>
          </div>
          <div className={`rounded-2xl border bg-black/55 px-5 py-3 text-right backdrop-blur transition-all ${highlighted("zombie") ? "border-cyan-300 ring-8 ring-cyan-300/25" : "border-white/15"}`}>
            <p className="flex items-center justify-end gap-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/55"><Shield size={12} className="text-cyan-300" /> Shockwave</p>
            <p className="mt-1 text-3xl font-black">{gameState.player.shockwaveCharges}</p>
          </div>
        </div>

        <div className={`relative min-h-0 flex-1 ${fullscreen ? "mt-3" : "mt-8"}`}>
          {orbs.map((orb) => (
            <div
              key={orb.id}
              style={{ left: `${(orb.x / GAME_WIDTH) * 100}%`, top: `${(orb.y / GAME_HEIGHT) * 100}%` }}
              className={`group pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ${orb.isCorrect && highlighted("orb") ? "scale-110 rounded-full ring-8 ring-amber-300/90 animate-pulse" : ""}`}
            >
              <span className="block size-20 rounded-full bg-[url('/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.png')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_0_24px_rgba(34,211,238,0.9)]" />
              <span className="absolute left-1/2 top-[72px] w-max max-w-[150px] -translate-x-1/2 rounded-xl border border-white/15 bg-black/75 px-3 py-1.5 text-sm font-black shadow-xl backdrop-blur">{orb.translation}</span>
              {orb.isCorrect && highlighted("orb") && <span className="absolute -top-10 left-1/2 w-max -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-black text-slate-950">เก็บลูกแก้วนี้</span>}
            </div>
          ))}

          {gameState.zombies.map((zombie) => (
            <div key={zombie.id} className="pointer-events-none absolute z-10 size-20 bg-[url('/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.png')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_0_16px_rgba(34,197,94,0.75)]" style={{ left: `${(zombie.x / GAME_WIDTH) * 100}%`, top: `${(zombie.y / GAME_HEIGHT) * 100}%`, transform: "translate(-50%, -50%)" }} />
          ))}
          <div className="pointer-events-none absolute z-20 transition-all duration-100" style={{ left: `${(gameState.player.x / GAME_WIDTH) * 100}%`, top: `${(gameState.player.y / GAME_HEIGHT) * 100}%`, transform: "translate(-50%, -50%)" }}>
            {tutorialShockwave && <div className="absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-8 border-cyan-300/90" />}
            <div className="size-28 bg-[url('/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.png')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_14px_15px_rgba(0,0,0,0.8)]" />
          </div>
        </div>

        <div className="relative z-20 mt-3 flex items-center justify-between gap-4">
          {mode === "teacher" ? (
            <>
              <div className="flex items-center gap-2 rounded-2xl border border-white/20 bg-black/45 px-5 py-3 text-sm font-black backdrop-blur"><Heart size={20} className="text-rose-400" /> HP {gameState.player.hp}</div>
              <p className="rounded-full bg-black/45 px-5 py-2 text-sm font-black text-white/70">WASD / ลูกศร เดิน · Space / Enter ใช้ Shockwave</p>
              <div className="rounded-2xl border border-white/20 bg-black/45 px-5 py-3 text-sm font-black backdrop-blur">Score {gameState.score}</div>
            </>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl items-center gap-4 rounded-3xl border border-amber-300/30 bg-slate-950/90 p-4 shadow-2xl backdrop-blur">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">{tutorialStep === 2 ? <MousePointerClick size={24} /> : tutorialStep === 3 ? <WandSparkles size={24} /> : <Sparkles size={24} />}</div>
              <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-amber-300">ขั้นตอน {tutorialStep + 1} / 4</p><p className="mt-0.5 text-lg font-black">{TUTORIAL_COPY[tutorialStep].title}</p><p className="text-sm font-semibold text-white/60">{TUTORIAL_COPY[tutorialStep].detail}</p></div>
              <div className="flex gap-1.5">{TUTORIAL_COPY.map((_step, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === tutorialStep ? "w-8 bg-amber-300" : "w-2 bg-white/20"}`} />)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
