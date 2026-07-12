"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Stage, Layer, Text, Group, Rect } from "react-konva";
import type { VocabularyItem } from "@/store/useGameStore";
import {
  AlchemistsSynthesisState,
  createAlchemistsSynthesisState,
  advanceAlchemistsSynthesisTime,
  handleAnswer,
  getAlchemistsSynthesisResults,
  GAME_WIDTH,
  GAME_HEIGHT,
} from "@/lib/games/alchemistsSynthesis";
import { useGameFullscreen } from "@/hooks/useGameFullscreen";
import { useAccessibilitySettings } from "@/hooks/useAccessibilitySettings";
import { GameStartScreen } from "@/components/games/game/GameStartScreen";
import { GameEndScreen } from "@/components/games/game/GameEndScreen";
import { useScopedI18n } from "@/locales/client";

export type AlchemistsSynthesisGameResult = {
  xp: number;
  accuracy: number;
  score: number;
  correctAnswers: number;
  totalAttempts: number;
  gameTime: number;
  difficulty: string;
};

interface AlchemistsSynthesisGameProps {
  vocabulary: VocabularyItem[];
  onComplete: (results: AlchemistsSynthesisGameResult) => void;
}

export function AlchemistsSynthesisGame({
  vocabulary,
  onComplete,
}: AlchemistsSynthesisGameProps): React.JSX.Element {
  const t = useScopedI18n("games.alchemistsSynthesis");
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize, getEffectiveTouchTarget } =
    useAccessibilitySettings();

  const [gameState, setGameState] = useState<AlchemistsSynthesisState>(() =>
    createAlchemistsSynthesisState(vocabulary, "normal")
  );

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const vocabularyRef = useRef(vocabulary);
  vocabularyRef.current = vocabulary;

  const lastTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const handleStart = useCallback(() => {
    const newState = createAlchemistsSynthesisState(
      vocabularyRef.current,
      gameStateRef.current.difficulty
    );
    setGameState({ ...newState, status: "playing" });
    enterFullscreen();
    lastTimeRef.current = null;
  }, [enterFullscreen]);

  const handleRestart = useCallback(() => {
    const newState = createAlchemistsSynthesisState(
      vocabularyRef.current,
      gameStateRef.current.difficulty
    );
    setGameState({ ...newState, status: "idle" });
    exitFullscreen();
  }, [exitFullscreen]);

  const handleSelectOption = useCallback(
    (option: VocabularyItem) => {
      const newState = handleAnswer(
        gameStateRef.current,
        option,
        vocabularyRef.current
      );
      setGameState(newState);

      if (newState.status === "victory" || newState.status === "gameover") {
        exitFullscreen();
        const results = getAlchemistsSynthesisResults(newState);
        onComplete(results);
      }
    },
    [onComplete, exitFullscreen]
  );

  useEffect(() => {
    if (gameState.status !== "playing") {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    const gameLoop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const deltaMs = Math.min(timestamp - lastTimeRef.current, 50);
      lastTimeRef.current = timestamp;

      const currentState = gameStateRef.current;
      const newState = advanceAlchemistsSynthesisTime(
        currentState,
        deltaMs
      );

      if (newState !== currentState) {
        setGameState(newState);

        if (newState.status === "gameover") {
          exitFullscreen();
          const results = getAlchemistsSynthesisResults(newState);
          onComplete(results);
        }
      }

      rafIdRef.current = requestAnimationFrame(gameLoop);
    };

    rafIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [gameState.status, onComplete, exitFullscreen]);

  const textSize = getEffectiveTextSize(18);
  const touchTargetSize = getEffectiveTouchTarget(50);

  const instructions = [
    {
      step: 1,
      text: t("instructions.match"),
    },
    {
      step: 2,
      text: t("instructions.time"),
    },
  ];

  if (gameState.status === "idle") {
    return (
      <div ref={containerRef} className="relative w-full h-full">
        <GameStartScreen
          gameTitle={t("title")}
          gameSubtitle={t("subtitle")}
          vocabulary={vocabulary}
          onStart={handleStart}
          instructions={instructions}
        />
      </div>
    );
  }

  if (gameState.status === "gameover" || gameState.status === "victory") {
    const results = getAlchemistsSynthesisResults(gameState);
    return (
      <div ref={containerRef} className="relative w-full h-full">
        <GameEndScreen
          status={gameState.status === "victory" ? "victory" : "defeat"}
          score={results.score}
          xp={results.xp}
          accuracy={results.accuracy}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <Stage
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: `${GAME_WIDTH}px`,
          margin: "0 auto",
        }}
      >
        <Layer>
          <Rect
            x={0}
            y={0}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            fill="#1a1a2e"
          />

          {gameState.currentWord && (
            <>
              <Text
                x={0}
                y={60}
                width={GAME_WIDTH}
                align="center"
                text={gameState.currentWord.translation}
                fontSize={textSize + 4}
                fill="#ffffff"
                fontStyle="bold"
              />

              <Text
                x={0}
                y={100}
                width={GAME_WIDTH}
                align="center"
                text={`${t("round")} ${gameState.round}/${gameState.maxRounds}`}
                fontSize={textSize - 2}
                fill="#888888"
              />

              <Text
                x={0}
                y={140}
                width={GAME_WIDTH}
                align="center"
                text={`${t("score")}: ${gameState.score}`}
                fontSize={textSize}
                fill="#ffd700"
              />

              {gameState.options.map((option, index) => {
                const row = Math.floor(index / 2);
                const col = index % 2;
                const x = 30 + col * 175;
                const y = 250 + row * (touchTargetSize + 20);

                return (
                  <Group
                    key={option.term}
                    x={x}
                    y={y}
                    onClick={() => handleSelectOption(option)}
                    onTap={() => handleSelectOption(option)}
                  >
                    <Rect
                      width={touchTargetSize}
                      height={touchTargetSize}
                      fill="#16213e"
                      stroke="#0f3460"
                      strokeWidth={2}
                      cornerRadius={8}
                    />
                    <Text
                      x={0}
                      y={touchTargetSize / 2 - textSize / 2}
                      width={touchTargetSize}
                      align="center"
                      text={option.term}
                      fontSize={textSize}
                      fill="#ffffff"
                    />
                  </Group>
                );
              })}
            </>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
