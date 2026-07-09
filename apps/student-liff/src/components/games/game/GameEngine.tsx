"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  useGameStore,
  VocabularyItem,
  CastleId,
  MAX_CASTLE_HP,
} from "@/store/useGameStore";
import {
  CASTLE_CONFIG,
  GAME_CONSTANTS,
  SCALING_CONFIG,
} from "@/lib/games/magicDefenseConfig";
import { useInterval } from "@/hooks/useInterval";
import { useSound } from "@/hooks/useSound";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { nanoid } from "nanoid";
import { InputController } from "./InputController";
import { AnimatePresence, motion } from "framer-motion";
import { Wand2 } from "lucide-react";
import { Enemy } from "./Enemy";
import { Explosion } from "./Explosion";
import { MagicBolt } from "./MagicBolt";
import { HUD } from "./HUD";

interface ActiveMissile extends VocabularyItem {
  id: string;
  x: number;
  targetX: number;
  targetCastleId: CastleId;
  state: "falling" | "targeted" | "dying";
}

interface ActiveExplosion {
  id: string;
  x: number;
  y: number;
}

interface ActiveBolt {
  id: string;
  startX: number;
  targetX: number;
  targetY: number;
  targetEnemyId: string;
}

const getCastleSpriteStyle = (column: number, row: number) => ({
  backgroundImage: `url(${CASTLE_CONFIG.sheet})`,
  backgroundSize: `${CASTLE_CONFIG.sheetWidth}px ${CASTLE_CONFIG.sheetHeight}px`,
  backgroundPosition: `${(column / (CASTLE_CONFIG.columns - 1)) * 100}% ${(row / (CASTLE_CONFIG.rows - 1)) * 100}%`,
  backgroundRepeat: "no-repeat",
});

const getCastleRowForHp = (hp: number) => {
  if (hp >= MAX_CASTLE_HP) return 0;
  if (hp === 2) return 1;
  return 2;
};

const getNearestAliveCastleId = (
  x: number,
  castles: Record<CastleId, number>,
): CastleId => {
  const entries = (
    Object.entries(CASTLE_CONFIG.positions) as [CastleId, number][]
  ).filter(([castleId]) => castles[castleId] > 0);
  if (entries.length === 0) return "center";

  return entries.reduce((closest, [castleId, position]) => {
    const closestDistance = Math.abs(x - CASTLE_CONFIG.positions[closest]);
    const currentDistance = Math.abs(x - position);
    return currentDistance < closestDistance ? castleId : closest;
  }, entries[0][0]);
};

const getRandomAliveCastleId = (
  castles: Record<CastleId, number>,
): CastleId => {
  const aliveCastles = (Object.keys(castles) as CastleId[]).filter(
    (castleId) => castles[castleId] > 0,
  );
  if (aliveCastles.length === 0) return "center";

  return aliveCastles[Math.floor(Math.random() * aliveCastles.length)];
};

const getCastleMotion = (hp: number) => ({
  opacity: hp > 0 ? 1 : 0.2,
  scale: hp > 0 ? 1 : 0.85,
  y: hp > 0 ? 0 : 20,
  filter: hp > 0 ? "none" : "grayscale(100%) brightness(0.4)",
});

const getHealthPercent = (hp: number) =>
  `${(Math.max(hp, 0) / MAX_CASTLE_HP) * 100}%`;

import { Difficulty } from "@/store/useGameStore";

interface GameEngineProps {
  difficulty?: Difficulty;
}

export function GameEngine({ difficulty = "normal" }: GameEngineProps) {
  // Detect touch/mobile device
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    setIsMobile(
      typeof window !== "undefined" &&
        (navigator.maxTouchPoints > 0 || "ontouchstart" in window),
    );
  }, []);
  const {
    vocabulary,
    status,
    castles,
    score,
    correctAnswers,
    totalAttempts,
    damageCastle,
    increaseScore,
    incrementAttempts,
    addMissedWord,
    incrementCombo,
    resetCombo,
    addMana,
    spendMana,
    combo,
    mana,
  } = useGameStore();
  const { playSound } = useSound();
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const [activeMissiles, setActiveMissiles] = useState<ActiveMissile[]>([]);
  const handledHitsRef = useRef<Set<string>>(new Set());
  const [explosions, setExplosions] = useState<ActiveExplosion[]>([]);
  const [bolts, setBolts] = useState<ActiveBolt[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );

  // Timer State (60 seconds)
  const [timeRemaining, setTimeRemaining] = useState(60);
  const { endGame } = useGameStore();

  // Fullscreen management
  useEffect(() => {
    if (status === "playing") {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }, [status, enterFullscreen, exitFullscreen]);

  useInterval(() => {
    if (status === "playing") {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }
  }, 1000);

  // Difficulty settings
  const getInitialSettings = (diff: Difficulty) => {
    switch (diff) {
      case "easy":
        return {
          spawnRate: 6000,
          duration: 20,
          minSpawnRate: 3000,
          minDuration: 10,
        };
      case "hard":
        return {
          spawnRate: 4000,
          duration: 10,
          minSpawnRate: 1500,
          minDuration: 6,
        };
      case "extreme":
        return {
          spawnRate: 3000,
          duration: 8,
          minSpawnRate: 800,
          minDuration: 5,
        };
      case "normal":
      default:
        return {
          spawnRate: 5000,
          duration: 15,
          minSpawnRate: 2000,
          minDuration: 8,
        };
    }
  };

  const settings = useRef(getInitialSettings(difficulty));

  // Update settings ref when difficulty changes and reset spawn rates
  useEffect(() => {
    const newSettings = getInitialSettings(difficulty);
    settings.current = newSettings;
    setSpawnRate(newSettings.spawnRate);
    setMissileDuration(newSettings.duration);
    setTimeRemaining(60); // Reset timer on difficulty change/start
  }, [difficulty]);

  const [spawnRate, setSpawnRate] = useState(settings.current.spawnRate);
  const [missileDuration, setMissileDuration] = useState(
    settings.current.duration,
  );

  const accuracy = totalAttempts > 0 ? correctAnswers / totalAttempts : 0;
  const leftCastleRow = getCastleRowForHp(castles.left);
  const centerCastleRow = getCastleRowForHp(castles.center);
  const rightCastleRow = getCastleRowForHp(castles.right);

  const spawnMissile = useCallback(() => {
    if (status !== "playing" || vocabulary.length === 0) return;

    const randomVocab =
      vocabulary[Math.floor(Math.random() * vocabulary.length)];
    const startX =
      Math.random() * GAME_CONSTANTS.missileSpawnXRange +
      GAME_CONSTANTS.missileSpawnXOffset;
    const targetCastleId = getNearestAliveCastleId(startX, castles);
    const newMissile: ActiveMissile = {
      ...randomVocab,
      id: nanoid(),
      x: startX,
      targetCastleId,
      targetX: CASTLE_CONFIG.positions[targetCastleId],
      state: "falling",
    };

    setActiveMissiles((prev) => [...prev, newMissile]);
  }, [status, vocabulary, castles]);

  useInterval(spawnMissile, status === "playing" ? spawnRate : null);

  // Special Ability: Thunder Storm
  const activateSpecialAbility = useCallback(() => {
    if (mana >= GAME_CONSTANTS.manaCostSpecial) {
      playSound("success"); // Add a better sound later like "thunder"
      spendMana(GAME_CONSTANTS.manaCostSpecial);

      // Destroy all falling missiles
      const fallingMissiles = activeMissiles.filter(
        (m) => m.state === "falling",
      );

      if (fallingMissiles.length > 0) {
        // Create explosions for all
        const newExplosions = fallingMissiles.map((m) => ({
          id: nanoid(),
          x: m.x,
          y: 50, // Approximate Y
        }));
        setExplosions((prev) => [...prev, ...newExplosions]);

        // Remove missiles
        setActiveMissiles((prev) => prev.filter((m) => m.state !== "falling"));

        // Optional: Add visual effect for global attack
      }
    }
  }, [mana, activeMissiles, spendMana, playSound]);

  // Keyboard listener for Special Ability (Spacebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        activateSpecialAbility();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateSpecialAbility]);

  const handleReachBottom = useCallback(
    (id: string) => {
      if (handledHitsRef.current.has(id)) return;
      handledHitsRef.current.add(id);

      const target = activeMissiles.find((missile) => missile.id === id);
      if (!target) return;

      playSound("missile-hit");
      setSpawnRate((prev) =>
        Math.min(
          prev + SCALING_CONFIG.spawnRateAdjustment,
          SCALING_CONFIG.spawnRateLimit,
        ),
      );
      setMissileDuration((prev) =>
        Math.min(
          prev + SCALING_CONFIG.durationAdjustment,
          SCALING_CONFIG.durationLimit,
        ),
      );

      incrementAttempts();
      resetCombo(); // Reset combo on hit

      // Add missed word
      const vocabItem: VocabularyItem = {
        term: target.term,
        translation: target.translation,
      };
      addMissedWord(vocabItem);

      damageCastle(getNearestAliveCastleId(target.targetX, castles));
      setActiveMissiles((prev) => prev.filter((missile) => missile.id !== id));
    },
    [
      activeMissiles,
      damageCastle,
      playSound,
      incrementAttempts,
      castles,
      resetCombo,
      addMissedWord,
    ],
  );

  const handleBoltComplete = useCallback(
    (boltId: string, enemyId: string, enemyX: number) => {
      setBolts((prev) => prev.filter((b) => b.id !== boltId));

      // Trigger explosion
      setExplosions((prev) => [
        ...prev,
        {
          id: nanoid(),
          x: enemyX,
          y: 50, // Approximate Y since we don't track it perfectly
        },
      ]);

      // Start death animation on hit
      setActiveMissiles((prev) =>
        prev.map((missile) =>
          missile.id === enemyId ? { ...missile, state: "dying" } : missile,
        ),
      );
    },
    [],
  );

  const handleDeathComplete = useCallback((enemyId: string) => {
    setActiveMissiles((prev) =>
      prev.filter((missile) => missile.id !== enemyId),
    );
  }, []);

  const checkAnswer = useCallback(
    (answer: string) => {
      const matchingMissile = activeMissiles.find(
        (m) =>
          m.state === "falling" &&
          m.translation.toLowerCase() === answer.toLowerCase(),
      );

      if (matchingMissile) {
        playSound("success");
        setFeedback("correct");

        incrementCombo();
        addMana(10);

        setActiveMissiles((prev) =>
          prev.map((missile) =>
            missile.id === matchingMissile.id
              ? { ...missile, state: "targeted" }
              : missile,
          ),
        );

        const casterId = getRandomAliveCastleId(castles);
        const casterX = CASTLE_CONFIG.positions[casterId];

        // Spawn Bolt
        const boltId = nanoid();
        setBolts((prev) => [
          ...prev,
          {
            id: boltId,
            startX: casterX,
            targetX: matchingMissile.targetX,
            targetY: 20, // Aim high
            targetEnemyId: matchingMissile.id,
          },
        ]);

        if ((combo + 1) % 3 === 0) {
          setSpawnRate((prev) =>
            Math.max(prev - 200, settings.current.minSpawnRate),
          );
          setMissileDuration((prev) =>
            Math.max(prev - 0.5, settings.current.minDuration),
          );
        }

        increaseScore(10);
        setTimeout(() => setFeedback(null), 500);
        return true;
      } else {
        playSound("error");
        setFeedback("incorrect");
        resetCombo();
        incrementAttempts();
        setTimeout(() => setFeedback(null), 500);
        return false;
      }
    },
    [
      activeMissiles,
      playSound,
      combo,
      increaseScore,
      incrementAttempts,
      castles,
      settings,
      incrementCombo,
      addMana,
      resetCombo,
    ],
  );

  if (status !== "playing") return null;

  return (
    <div
      ref={containerRef}
      data-testid="game-stage"
      className="relative w-full h-full overflow-hidden bg-slate-900"
      style={{
        backgroundImage: `url(${GAME_CONSTANTS.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-300 ${
          feedback === "correct"
            ? "bg-emerald-500/20"
            : feedback === "incorrect"
              ? "bg-red-900/40"
              : "bg-transparent"
        }`}
        aria-hidden="true"
      />
      <div className="relative z-10 h-full">
        <HUD
          score={score}
          accuracy={accuracy}
          combo={combo}
          mana={mana}
          timeRemaining={timeRemaining}
        />

        <AnimatePresence>
          {activeMissiles.map((missile) => (
            <Enemy
              key={missile.id}
              id={missile.id}
              x={missile.x}
              targetX={missile.targetX}
              term={missile.term}
              duration={missileDuration}
              state={missile.state}
              onReachBottom={handleReachBottom}
              onDeathComplete={handleDeathComplete}
            />
          ))}
        </AnimatePresence>

        {bolts.map((bolt) => (
          <MagicBolt
            key={bolt.id}
            startX={bolt.startX}
            startY={80} // Wizard position
            targetX={bolt.targetX}
            targetY={bolt.targetY}
            onComplete={() =>
              handleBoltComplete(bolt.id, bolt.targetEnemyId, bolt.targetX)
            }
          />
        ))}

        {explosions.map((exp) => (
          <Explosion
            key={exp.id}
            x={exp.x}
            y={exp.y}
            onComplete={() =>
              setExplosions((prev) => prev.filter((e) => e.id !== exp.id))
            }
          />
        ))}

        {/* Bases/Castles at the bottom */}
        <div className="absolute bottom-0 w-full flex justify-around p-2 pb-14 sm:pb-2 items-end pointer-events-none">
          {/* Left Castle */}
          <motion.div
            animate={getCastleMotion(castles.left)}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.renderHeight}px`,
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  ...getCastleSpriteStyle(0, leftCastleRow),
                  width: `${CASTLE_CONFIG.spriteWidth}px`,
                  height: `${CASTLE_CONFIG.spriteHeight}px`,
                  transform: `scale(${CASTLE_CONFIG.scale})`,
                  transformOrigin: "top left",
                }}
                aria-hidden="true"
              />
            </div>
            <div
              className="bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700"
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.barHeight}px`,
              }}
            >
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: getHealthPercent(castles.left) }}
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </motion.div>

          {/* Center Castle */}
          <motion.div
            animate={getCastleMotion(castles.center)}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.renderHeight}px`,
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  ...getCastleSpriteStyle(1, centerCastleRow),
                  width: `${CASTLE_CONFIG.spriteWidth}px`,
                  height: `${CASTLE_CONFIG.spriteHeight}px`,
                  transform: `scale(${CASTLE_CONFIG.scale})`,
                  transformOrigin: "top left",
                }}
                aria-hidden="true"
              />
            </div>
            <div
              className="bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700"
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.barHeight}px`,
              }}
            >
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: getHealthPercent(castles.center) }}
                className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
              />
            </div>
          </motion.div>

          {/* Right Castle */}
          <motion.div
            animate={getCastleMotion(castles.right)}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.renderHeight}px`,
              }}
              aria-hidden="true"
            >
              <div
                style={{
                  ...getCastleSpriteStyle(0, rightCastleRow),
                  width: `${CASTLE_CONFIG.spriteWidth}px`,
                  height: `${CASTLE_CONFIG.spriteHeight}px`,
                  transform: `scale(${CASTLE_CONFIG.scale})`,
                  transformOrigin: "top left",
                }}
                aria-hidden="true"
              />
            </div>
            <div
              className="bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700"
              style={{
                width: `${CASTLE_CONFIG.renderWidth}px`,
                height: `${CASTLE_CONFIG.barHeight}px`,
              }}
            >
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: getHealthPercent(castles.right) }}
                className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
              />
            </div>
          </motion.div>
        </div>

        {/* Magician Avatar */}
        <div className="absolute bottom-[80px] sm:bottom-32 left-1/2 -translate-x-1/2 pointer-events-none">
          <motion.div
            animate={
              feedback === "correct"
                ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }
                : {}
            }
            className="relative"
          >
            <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl animate-pulse" />
            <Wand2 className="w-12 h-12 text-primary relative z-10" />
          </motion.div>
        </div>

        {/* Input Controller */}
        {isMobile ? (
          // Mobile: clean bar pinned to bottom
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <InputController onSubmit={checkAnswer} mobile />
          </div>
        ) : (
          // Desktop: invisible keyboard input, centered
          <div className="absolute top-1/2 left-0 right-0 z-20 -translate-y-1/2 pointer-events-none">
            <InputController onSubmit={checkAnswer} />
          </div>
        )}

        {/* Mobile-only Ultimate button (sits above input bar) */}
        <AnimatePresence>
          {isMobile && mana >= GAME_CONSTANTS.manaCostSpecial && (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onPointerDown={(e) => {
                e.preventDefault();
                activateSpecialAbility();
              }}
              className="absolute bottom-[56px] right-3 z-30 flex items-center gap-1.5 rounded-xl border border-cyan-400/40 bg-cyan-950/90 px-3 py-2 text-cyan-300 text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.4)] animate-pulse pointer-events-auto"
            >
              ✨ Ultimate!
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
