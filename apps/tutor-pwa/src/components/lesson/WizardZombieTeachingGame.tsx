"use client";

import React from "react";
import { Heart, MousePointerClick, Shield, Sparkles, Timer, WandSparkles, Zap } from "lucide-react";
import {
  advanceWizardZombieTime,
  createWizardZombieState,
  GAME_HEIGHT,
  GAME_WIDTH,
  ROUND_DURATION_MS,
  type InputState,
  type WizardZombieState,
} from "@/lib/games/wizardZombie";
import { hasUsableVocabulary } from "@/lib/games/lessonContent";
import { tx } from "@/lib/games/gameText";
import { VirtualDPad } from "@/lib/games-runtime/VirtualDPad";
import { TeachingEndCard } from "./TeachingEndCard";
import { TEACHING_STAGE_HEIGHT, useStageScale } from "./teachingStageSize";

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
  { title: "ดูคำศัพท์เป้าหมาย", detail: "อ่านคำที่ต้องตามหาในกล่องหาคำแปล", target: "target" },
  { title: "ลากจอยสติกเพื่อเดิน", detail: "พาพ่อมดเดินไปหาลูกแก้วที่ตรงคำศัพท์", target: "controls" },
  { title: "เก็บลูกแก้วที่ถูก", detail: "ถูกตั้งแต่ครั้งแรกจึงได้คะแนน และได้ ⚡ เพิ่ม", target: "orb" },
  { title: "หลบซอมบี้และใช้เวท", detail: "สะสม ⚡ แล้วกดปุ่มร่ายเวทเพื่อผลักซอมบี้ออกไป", target: "zombie" },
] as const;

const TICK_MS = 50;
const TUTORIAL_TIMING = {
  readTarget: 3500,
  showStick: 3500,
  /** The class reads the highlighted orb before the wizard walks to it. */
  holdOnOrb: 2500,
  /** A walk that never arrives still ends the loop. */
  walkLimit: 9000,
  beforeCast: 1200,
  afterCast: 3000,
} as const;
/** On the "how to move" step the wizard walks this share of the way to the right orb. */
const STICK_STEP_WALK_SHARE = 0.45;
const PICK_TOAST_MS = 1800;
const SHOCKWAVE_MS = 700;

type Stick = { dx: number; dy: number };
const STILL: Stick = { dx: 0, dy: 0 };

/** A step toward `to`, or standing still once there. Straight, so the walk passes no other orb. */
function stepToward(from: { x: number; y: number }, to: { x: number; y: number }, stopWithin: number): Stick {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  return distance <= stopWithin ? STILL : { dx: dx / distance, dy: dy / distance };
}

export function WizardZombieTeachingGame({ vocabulary, mode, fullscreen = false }: WizardZombieTeachingGameProps) {
  const words = React.useMemo(() => {
    const usable = vocabulary.filter((word) => word.term && word.translation);
    return hasUsableVocabulary(usable) ? usable : FALLBACK_WORDS;
  }, [vocabulary]);
  const { stageRef, scale } = useStageScale<HTMLDivElement>();
  const [tutorialStep, setTutorialStep] = React.useState(0);
  const [tutorialCycle, setTutorialCycle] = React.useState(0);
  const [gameState, setGameState] = React.useState<WizardZombieState>(() => createWizardZombieState(words, { difficulty: "medium" }));
  const [roundEnded, setRoundEnded] = React.useState(false);
  const [pickToast, setPickToast] = React.useState<string | null>(null);
  const [shockwave, setShockwave] = React.useState(false);
  const [driverStick, setDriverStick] = React.useState<Stick>(STILL);
  const gameStateRef = React.useRef(gameState);
  const inputRef = React.useRef<InputState>({ dx: 0, dy: 0, cast: false });
  const shockwaveTimer = React.useRef(0);

  const startRound = React.useCallback(() => {
    const next = createWizardZombieState(words, { difficulty: "medium" });
    gameStateRef.current = next;
    inputRef.current = { dx: 0, dy: 0, cast: false };
    setGameState(next);
    setRoundEnded(false);
    setPickToast(null);
    setShockwave(false);
    setDriverStick(STILL);
  }, [words]);

  const castSpell = React.useCallback(() => {
    if (gameStateRef.current.player.shockwaveCharges <= 0) return;
    inputRef.current.cast = true;
    setShockwave(true);
    window.clearTimeout(shockwaveTimer.current);
    shockwaveTimer.current = window.setTimeout(() => setShockwave(false), SHOCKWAVE_MS);
  }, []);

  const steerWithStick = React.useCallback((vector: Stick) => {
    inputRef.current.dx = vector.dx;
    inputRef.current.dy = vector.dy;
  }, []);

  React.useEffect(() => {
    startRound();
    setTutorialStep(0);
  }, [mode, startRound]);

  React.useEffect(() => () => window.clearTimeout(shockwaveTimer.current), []);

  // The keyboard is the tutor's extra. Students, and a tutor on a tablet, use the stick and cast button.
  React.useEffect(() => {
    if (mode !== "teacher") return;
    const held = new Set<string>();
    const steer = () => {
      inputRef.current.dx = Number(held.has("right")) - Number(held.has("left"));
      inputRef.current.dy = Number(held.has("down")) - Number(held.has("up"));
    };
    const direction = (key: string) => {
      if (key === "arrowleft" || key === "a") return "left";
      if (key === "arrowright" || key === "d") return "right";
      if (key === "arrowup" || key === "w") return "up";
      if (key === "arrowdown" || key === "s") return "down";
      return null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const heading = direction(key);
      if (!heading && key !== " " && key !== "enter") return;
      // The dock has its own Tab stop: Space and Enter on a button still press that button.
      if ((event.target as HTMLElement | null)?.closest("button, a, input, textarea, select")) {
        if (!heading) return;
      }
      event.preventDefault();
      if (heading) {
        held.add(heading);
        steer();
      } else if (!event.repeat) {
        castSpell();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const heading = direction(event.key.toLowerCase());
      if (!heading) return;
      held.delete(heading);
      steer();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [castSpell, mode]);

  React.useEffect(() => {
    if (roundEnded) return;
    const interval = window.setInterval(() => {
      const current = gameStateRef.current;
      if (current.status === "gameover" || (mode === "teacher" && current.gameTime >= ROUND_DURATION_MS)) {
        // The tutorial's own timers start its next loop.
        if (mode === "teacher") setRoundEnded(true);
        return;
      }
      const next = advanceWizardZombieTime(current, TICK_MS, inputRef.current, words);
      inputRef.current.cast = false;
      if (next.totalAttempts > current.totalAttempts && next.lastPick?.isCorrect) {
        setPickToast(`ถูก! ${next.lastPick.term} = ${next.lastPick.meaning}`);
        if (mode === "tutorial") setTutorialStep(3);
      }
      gameStateRef.current = next;
      setGameState(next);
    }, TICK_MS);
    return () => window.clearInterval(interval);
  }, [mode, roundEnded, words]);

  React.useEffect(() => {
    if (!pickToast) return;
    const timer = window.setTimeout(() => setPickToast(null), PICK_TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [pickToast]);

  // The tutorial plays the real game with the same stick and cast button the children have.
  React.useEffect(() => {
    if (mode !== "tutorial") return;
    setTutorialStep(0);
    const start = { x: gameStateRef.current.player.x, y: gameStateRef.current.player.y };
    const firstRightOrb = gameStateRef.current.orbs.find((orb) => orb.isCorrect);
    let goal: "stay" | "partway" | "orb" = "stay";
    let picked = false;
    const timers: number[] = [];
    const after = (ms: number, action: () => void) => timers.push(window.setTimeout(action, ms));
    const nextLoop = () => {
      startRound();
      setTutorialCycle((cycle) => cycle + 1);
    };

    const { readTarget, showStick, holdOnOrb, walkLimit, beforeCast, afterCast } = TUTORIAL_TIMING;
    after(readTarget, () => {
      setTutorialStep(1);
      goal = "partway";
    });
    after(readTarget + showStick, () => {
      setTutorialStep(2);
      goal = "stay";
    });
    after(readTarget + showStick + holdOnOrb, () => {
      goal = "orb";
    });
    after(readTarget + showStick + holdOnOrb + walkLimit, nextLoop);

    const driver = window.setInterval(() => {
      const state = gameStateRef.current;
      const rightOrb = state.orbs.find((orb) => orb.isCorrect);
      if (state.answeredWords.length > 0) {
        if (picked) return;
        picked = true;
        goal = "stay";
        inputRef.current = { dx: 0, dy: 0, cast: false };
        setDriverStick(STILL);
        after(beforeCast, castSpell);
        after(beforeCast + afterCast, nextLoop);
        return;
      }
      let stick = STILL;
      if (goal === "orb" && rightOrb) stick = stepToward(state.player, rightOrb, 0);
      if (goal === "partway" && firstRightOrb) {
        const partway = {
          x: start.x + (firstRightOrb.x - start.x) * STICK_STEP_WALK_SHARE,
          y: start.y + (firstRightOrb.y - start.y) * STICK_STEP_WALK_SHARE,
        };
        stick = stepToward(state.player, partway, 6);
      }
      inputRef.current.dx = stick.dx;
      inputRef.current.dy = stick.dy;
      setDriverStick((shown) => (shown.dx === stick.dx && shown.dy === stick.dy ? shown : stick));
    }, 80);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(driver);
      inputRef.current = { dx: 0, dy: 0, cast: false };
    };
  }, [castSpell, mode, startRound, tutorialCycle]);

  const orbs = gameState.orbs;
  const secondsLeft = Math.max(0, Math.ceil((ROUND_DURATION_MS - gameState.gameTime) / 1000));
  const charges = gameState.player.shockwaveCharges;
  const highlighted = (target: (typeof TUTORIAL_COPY)[number]["target"]) => mode === "tutorial" && TUTORIAL_COPY[tutorialStep].target === target;

  return (
    <div
      ref={stageRef}
      className={`relative isolate w-full overflow-hidden bg-slate-950 text-white ${fullscreen ? "h-full min-h-0 flex-1 rounded-none shadow-none" : `${TEACHING_STAGE_HEIGHT} rounded-[32px] shadow-2xl`}`}
      data-testid={`wizard-zombie-${mode}`}
    >
      <div className="absolute inset-0 bg-[url('/games/vocabulary/wizard-vs-zombie/tile-ruins.webp')] bg-[length:320px_320px] opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(67,56,202,0.42),transparent_42%),linear-gradient(to_bottom,rgba(15,23,42,0.18),rgba(2,6,23,0.86))]" />

      <div style={{ zoom: scale }} className="relative z-10 flex h-full min-h-0 flex-col p-4 sm:p-5">
        {/* Above the field: a zombie walking along the top edge must not cover the word the class reads. */}
        <div className="relative z-20 flex items-start justify-between gap-4">
          <div className={`rounded-2xl border bg-black/55 px-5 py-2.5 backdrop-blur transition-all ${highlighted("target") ? "border-amber-300 ring-8 ring-amber-300/25" : "border-white/15"}`}>
            <p className="text-sm font-black text-white/70">{tx("Find")}</p>
            <p className="text-4xl font-black text-amber-300">{gameState.targetWord}</p>
          </div>
          {mode === "teacher" ? (
            <div data-testid="wizard-timer" className="flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-5 py-2 text-3xl font-black tabular-nums backdrop-blur">
              <Timer aria-hidden="true" className="size-7 text-cyan-300" />
              {secondsLeft}
            </div>
          ) : (
            <div className="rounded-full border border-violet-300/50 bg-slate-950/90 px-4 py-1.5 text-sm font-black text-violet-200 backdrop-blur">⏸ หยุดเวลา · สาธิตอัตโนมัติ</div>
          )}
          <div className={`rounded-2xl border bg-black/55 px-5 py-2.5 text-right backdrop-blur transition-all ${highlighted("zombie") ? "border-cyan-300 ring-8 ring-cyan-300/25" : "border-white/15"}`}>
            <p className="flex items-center justify-end gap-1 text-sm font-black text-white/70"><Shield size={15} className="text-cyan-300" /> {tx("Cast")}</p>
            <p className="text-4xl font-black">{charges}</p>
          </div>
        </div>

        {/* The field leaves room on both sides for the stick and the cast button, as on a phone held wide. */}
        <div className="relative mx-[8.5rem] mt-3 min-h-0 flex-1">
          {orbs.map((orb) => {
            const isTheOrb = orb.isCorrect && highlighted("orb");
            return (
              <div
                key={orb.id}
                style={{ left: `${(orb.x / GAME_WIDTH) * 100}%`, top: `${(orb.y / GAME_HEIGHT) * 100}%` }}
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ${isTheOrb ? "z-30" : "z-10"}`}
              >
                <span className={`block size-16 rounded-full bg-[url('/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.webp')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_0_24px_rgba(34,211,238,0.9)] ${isTheOrb ? "scale-110 rounded-full ring-8 ring-amber-300/90 animate-pulse" : ""}`} />
                <span className="absolute left-1/2 top-[58px] w-max max-w-[230px] -translate-x-1/2 rounded-xl border border-white/15 bg-black/80 px-3 py-1 text-center text-xl font-black leading-tight shadow-xl backdrop-blur">{orb.translation}</span>
                {isTheOrb && <span className="absolute -top-10 left-1/2 w-max -translate-x-1/2 rounded-full bg-amber-300 px-3 py-1.5 text-sm font-black text-slate-950">เก็บลูกแก้วนี้</span>}
              </div>
            );
          })}

          {gameState.zombies.map((zombie) => (
            <div key={zombie.id} className="pointer-events-none absolute z-10 size-20 bg-[url('/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.webp')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_0_16px_rgba(34,197,94,0.75)]" style={{ left: `${(zombie.x / GAME_WIDTH) * 100}%`, top: `${(zombie.y / GAME_HEIGHT) * 100}%`, transform: "translate(-50%, -50%)" }} />
          ))}
          <div className={`pointer-events-none absolute z-20 transition-all duration-100 ${gameState.player.caughtMs > 0 ? "opacity-40" : ""}`} style={{ left: `${(gameState.player.x / GAME_WIDTH) * 100}%`, top: `${(gameState.player.y / GAME_HEIGHT) * 100}%`, transform: "translate(-50%, -50%)" }}>
            {shockwave && <div className="absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-8 border-cyan-300/90" />}
            <div className="size-28 bg-[url('/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.webp')] bg-[length:300%_300%] bg-[position:50%_0%] bg-no-repeat drop-shadow-[0_14px_15px_rgba(0,0,0,0.8)]" />
          </div>

          {pickToast && !gameState.reveal && (
            <div role="status" data-testid="wizard-toast" className="pointer-events-none absolute left-1/2 top-0 z-40 w-max max-w-full -translate-x-1/2 rounded-2xl border border-emerald-300/70 bg-emerald-950/95 px-5 py-2 text-center text-2xl font-black text-emerald-200 shadow-2xl">
              {pickToast}
            </div>
          )}
          {gameState.reveal && (
            <div role="status" data-testid="wizard-reveal" className="pointer-events-none absolute left-1/2 top-1/2 z-40 w-[min(460px,100%)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-rose-300/70 bg-slate-950/95 px-6 py-4 text-center shadow-2xl">
              <p className="text-lg font-black text-rose-300">ยังไม่ใช่</p>
              <p className="mt-1 text-3xl font-black text-white">{gameState.reveal.term}</p>
              <p className="mt-1 text-2xl font-bold leading-snug text-amber-200">{gameState.reveal.meaning}</p>
            </div>
          )}
          {gameState.player.caughtMs > 0 && !gameState.reveal && (
            <div role="status" data-testid="wizard-caught" className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-rose-300/70 bg-slate-950/95 px-6 py-3 text-center shadow-2xl">
              <p className="text-2xl font-black text-rose-300">ซอมบี้จับได้!</p>
              <p className="text-lg font-bold text-white/80">รอสักครู่ พ่อมดกำลังกลับมา</p>
            </div>
          )}
        </div>

        {/* The same controls the children have on their phones. */}
        <div
          data-testid="wizard-stick"
          className={`absolute bottom-20 left-3 z-30 origin-bottom-left scale-90 rounded-full transition-shadow ${mode === "tutorial" ? "pointer-events-none" : ""} ${highlighted("controls") ? "ring-8 ring-amber-300/60" : ""}`}
        >
          <VirtualDPad onInput={steerWithStick} activeVector={mode === "tutorial" ? driverStick : undefined} />
        </div>
        <button
          type="button"
          data-testid="wizard-cast"
          aria-label={`ร่ายเวท เหลือ ${charges}`}
          disabled={mode === "tutorial"}
          // Pointer down, not click: a click never comes while the other thumb holds the stick.
          onPointerDown={(event) => {
            event.preventDefault();
            castSpell();
          }}
          className={`absolute bottom-24 right-4 z-30 flex size-24 touch-none select-none flex-col items-center justify-center gap-0.5 rounded-full border-2 text-sm font-black transition-all active:scale-95 disabled:cursor-default ${
            charges > 0 ? "border-blue-300 bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.6)]" : "border-slate-500 bg-slate-800 text-slate-200"
          } ${highlighted("zombie") ? "ring-8 ring-amber-300/70" : ""}`}
        >
          <span className="flex items-center gap-0.5 tabular-nums"><Zap aria-hidden="true" className={`size-4 ${charges > 0 ? "fill-yellow-300 text-yellow-300" : ""}`} />{charges}/{gameState.player.maxShockwaveCharges}</span>
          ร่ายเวท
        </button>

        <div className="relative z-20 mt-3 flex items-center justify-between gap-4">
          {mode === "teacher" ? (
            <>
              <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-white/20 bg-black/45 px-5 py-2 text-lg font-black tabular-nums backdrop-blur"><Heart size={20} className="text-rose-400" /> {tx("HP")} {gameState.player.hp}</div>
              <p className="min-w-0 rounded-full bg-black/45 px-5 py-2 text-center text-sm font-bold text-white/75">นักเรียนใช้จอยสติกและปุ่มร่ายเวท · ครูกดลูกศรเดินและ Space ร่ายเวทได้</p>
              <div className="shrink-0 rounded-2xl border border-white/20 bg-black/45 px-5 py-2 text-lg font-black tabular-nums backdrop-blur">ถูก {gameState.correctAnswers}</div>
            </>
          ) : (
            <div className="mx-auto flex w-full max-w-3xl items-center gap-4 rounded-3xl border border-amber-300/30 bg-slate-950/90 p-3 shadow-2xl backdrop-blur">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-amber-300 text-slate-950">{tutorialStep === 2 ? <MousePointerClick size={24} /> : tutorialStep === 3 ? <WandSparkles size={24} /> : <Sparkles size={24} />}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-black text-amber-300">ขั้นตอน {tutorialStep + 1} / 4</p><p className="text-xl font-black leading-tight">{TUTORIAL_COPY[tutorialStep].title}</p><p className="text-base font-semibold leading-snug text-white/70">{TUTORIAL_COPY[tutorialStep].detail}</p></div>
              <div className="flex gap-1.5">{TUTORIAL_COPY.map((_step, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === tutorialStep ? "w-8 bg-amber-300" : "w-2 bg-white/20"}`} />)}</div>
            </div>
          )}
        </div>
      </div>

      {roundEnded && (
        <TeachingEndCard
          title={gameState.status === "gameover" ? "เก็บครบทุกคำแล้ว" : "หมดเวลา"}
          detail={`ถูกตั้งแต่ครั้งแรก ${gameState.correctAnswers} คำ`}
          scale={scale}
          onReplay={startRound}
        />
      )}
    </div>
  );
}
