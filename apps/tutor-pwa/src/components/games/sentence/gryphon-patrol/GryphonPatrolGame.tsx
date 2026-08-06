"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Circle, Line } from 'react-konva';
import {
  createInitialGryphonPatrolState, 
  tickGryphonPatrol, 
  handleGryphonPatrolInput, 
  spawnGryphonPatrolEnemies,
  shootGryphonPatrolProjectile,
  calculateXP,
  GameState 
} from '@/lib/games/gryphonPatrol';
import { VocabularyItem } from '@/store/useGameStore';
import { useDirectionalInput } from '@/hooks/useDirectionalInput';
import { useGameFullscreen } from '@/hooks/useGameFullscreen';
import { useAccessibilitySettings } from '@/hooks/useAccessibilitySettings';
import { GameStartScreen } from '@/components/games/game/GameStartScreen';
import { GameEndScreen } from '@/components/games/game/GameEndScreen';
import { Bird, Shield, Target } from 'lucide-react';

export interface GryphonPatrolGameProps {
  vocabList: VocabularyItem[];
  difficulty: string;
  onComplete: (results: { xp: number; accuracy: number; difficulty: string; score: number }) => void;
}

const GryphonPatrolGame: React.FC<GryphonPatrolGameProps> = ({ vocabList, difficulty, onComplete }) => {
  const [gameState, setGameState] = useState<GameState>(() => 
    createInitialGryphonPatrolState(vocabList[0]?.term?.split(' ') || [])
  );
  
  const [dimensions, setDimensions] = useState({ width: 390, height: 844 });
  const { containerRef, enterFullscreen, exitFullscreen } = useGameFullscreen();
  const { getEffectiveTextSize } = useAccessibilitySettings();
  const lastFrameRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const { input, consumeCast } = useDirectionalInput();

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerRef]);

  // Game Loop with requestAnimationFrame
  useEffect(() => {
    if (gameState.status !== 'playing') {
      lastFrameRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      const delta = lastFrameRef.current ? timestamp - lastFrameRef.current : 16;
      lastFrameRef.current = timestamp;
      const clampedDelta = Math.min(delta, 50);
      const deltaTime = clampedDelta / 1000;

      setGameState((prev) => {
        let next = tickGryphonPatrol(prev, deltaTime);
        if (input.dx !== 0 || input.dy !== 0) {
          next = handleGryphonPatrolInput(next, { dx: input.dx, dy: input.dy });
        }
        if (input.cast) {
          next = shootGryphonPatrolProjectile(next);
          consumeCast();
        }
        return next;
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = 0;
    };
  }, [gameState.status, input, consumeCast]);

  // Fullscreen handling
  useEffect(() => {
    if (gameState.status === 'playing') {
      enterFullscreen();
    } else if (gameState.status === 'won' || gameState.status === 'lost') {
      exitFullscreen();
    }
  }, [gameState.status, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (gameState.status === 'won' || gameState.status === 'lost') {
      const accuracy = gameState.sentence.length > 0 
        ? gameState.collectedWords.length / gameState.sentence.length 
        : 0;
      const xp = calculateXP({
        collectedWords: gameState.collectedWords.length,
        totalWords: gameState.sentence.length,
        hp: gameState.player.hp,
        maxHp: gameState.player.maxHp,
        time: gameState.time,
      });
      onComplete({
        xp,
        accuracy,
        difficulty,
        score: gameState.score
      });
    }
  }, [gameState.status, gameState.xp, gameState.score, gameState.collectedWords.length, gameState.sentence.length, gameState.player.hp, gameState.player.maxHp, gameState.time, difficulty, onComplete]);

  const handleStart = () => {
    const initialState = createInitialGryphonPatrolState(vocabList[0]?.term?.split(' ') || []);
    const withEnemies = spawnGryphonPatrolEnemies(initialState);
    setGameState({ ...withEnemies, status: 'playing' });
    lastFrameRef.current = 0;
  };

  const scale = Math.min(dimensions.width / 390, dimensions.height / 844);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-950">
      {gameState.status === 'start' && (
        <GameStartScreen
          gameTitle="Gryphon Patrol"
          gameSubtitle="Patrol the skies and hunt down the sentence!"
          icon={Bird}
          vocabulary={vocabList}
          instructions={[
            { step: 1, text: "Fly using Arrow Keys or WASD", icon: Bird },
            { step: 2, text: "Shoot using Space to reveal words from enemies", icon: Shield },
            { step: 3, text: "Collect word orbs in the correct sentence order", icon: Target }
          ]}
          controls={[
            { label: "Move", keys: "WASD / Arrows", color: "bg-blue-500" },
            { label: "Shoot", keys: "Space", color: "bg-red-500" }
          ]}
          startButtonText="START PATROL"
          onStart={handleStart}
        />
      )}

      {(gameState.status === 'playing' || gameState.status === 'won' || gameState.status === 'lost') && (
        <Stage width={dimensions.width} height={dimensions.height} scaleX={scale} scaleY={scale}>
          <Layer>
            {/* Parallax Background */}
            <Rect 
              width={390} height={844} 
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: 0, y: 844 }}
              fillLinearGradientColorStops={[0, '#1a365d', 1, '#2d3748']}
            />

            {/* Landscape (Wrap-around) */}
            {[0, 1, 2].map(i => {
              const x = (i * 1000 - gameState.cameraX * 0.5 + 2000) % 2000;
              return (
                <Group key={i} x={x}>
                   <Line
                    points={[0, 844, 200, 600, 400, 844, 600, 500, 800, 844, 1000, 844]}
                    fill="#2d3748"
                    closed
                    opacity={0.3}
                  />
                </Group>
              );
            })}

            {/* Enemies */}
            {gameState.enemies.map(enemy => {
              if (!enemy.isActive) return null;
              // Handle wrap-around rendering
              let ex = (enemy.x - gameState.cameraX + 2000) % 2000;
              if (ex > 450) ex -= 2000; // Show on left if wrapped
              if (ex < -100) ex += 2000; // Show on right if wrapped

              return (
                <Group key={enemy.id} x={ex} y={enemy.y}>
                  <Circle
                    radius={enemy.size / 2}
                    fill={enemy.isTarget ? "#2ecc71" : "#e74c3c"}
                    stroke="white"
                    strokeWidth={2}
                  />
                  <Text
                    text={enemy.word}
                    x={-50} y={enemy.size / 2 + 5}
                    width={100}
                    align="center"
                    fill="white"
                    fontSize={getEffectiveTextSize(16)}
                    fontStyle="bold"
                  />
                </Group>
              );
            })}

            {/* Projectiles */}
            {gameState.projectiles.map(proj => {
              const px = (proj.x - gameState.cameraX + 2000) % 2000;
              return (
                <Rect
                  key={proj.id}
                  x={px - proj.size / 2}
                  y={proj.y - proj.size / 2}
                  width={proj.size}
                  height={proj.size}
                  fill="#f1c40f"
                  shadowBlur={5}
                  shadowColor="yellow"
                />
              );
            })}

            {/* Orbs */}
            {gameState.orbs.map(orb => {
              if (!orb.isActive) return null;
              const ox = (orb.x - gameState.cameraX + 2000) % 2000;
              return (
                <Group key={orb.id} x={ox} y={orb.y}>
                  <Circle
                    radius={orb.size / 2}
                    fill="white"
                    shadowBlur={10}
                    shadowColor="white"
                  />
                  <Text
                    text={orb.word}
                    x={-50} y={orb.size / 2 + 5}
                    width={100}
                    align="center"
                    fill="#f1c40f"
                    fontSize={getEffectiveTextSize(16)}
                    fontStyle="bold"
                  />
                </Group>
              );
            })}

            {/* Player */}
            <Group 
              x={390 / 2} 
              y={gameState.player.y}
              opacity={gameState.player.invulnerableTime > 0 ? 0.5 : 1}
            >
              <Rect 
                width={gameState.player.size}
                height={gameState.player.size}
                fill="#f1c40f"
                cornerRadius={5}
              />
              <Rect 
                x={-gameState.player.size / 2}
                y={-gameState.player.size / 2}
                width={gameState.player.size}
                height={gameState.player.size}
                fill="#f1c40f"
                cornerRadius={5}
              />
            </Group>

            {/* HUD */}
            <Group y={20} x={10}>
              <Rect width={370} height={80} fill="rgba(0,0,0,0.6)" cornerRadius={10} />
              <Text 
                text={gameState.sentence.join(' ')}
                x={10} y={10} width={350} align="center"
                fontSize={getEffectiveTextSize(16)} fill="white" opacity={0.5}
              />
              <Text 
                text={gameState.collectedWords.join(' ')}
                x={10} y={40} width={350} align="center"
                fontSize={getEffectiveTextSize(20)} fill="#2ecc71" fontStyle="bold"
              />
            </Group>

            {/* Mini-map */}
            <Group x={10} y={844 - 100}>
              <Rect 
                width={370} height={40} 
                fill="rgba(0,0,0,0.5)" 
                stroke="rgba(255,255,255,0.3)" 
                strokeWidth={1}
                cornerRadius={5}
              />
              {/* Player on mini-map */}
              <Rect 
                x={(gameState.player.x / 2000) * 370}
                y={15} width={4} height={10} fill="yellow"
              />
              {/* Enemies on mini-map */}
              {gameState.enemies.map(e => e.isActive && (
                <Rect 
                  key={e.id}
                  x={(e.x / 2000) * 370}
                  y={18} width={2} height={4} 
                  fill={e.isTarget ? "#2ecc71" : "#e74c3c"}
                />
              ))}
              {/* Target Indicator */}
              <Text 
                text="MINI-MAP"
                x={0} y={-15} fontSize={getEffectiveTextSize(16)} fill="white" opacity={0.5}
              />
            </Group>

            {/* HP Bar */}
            <Group x={10} y={110}>
              {[...Array(gameState.player.maxHp)].map((_, i) => (
                <Circle 
                  key={i}
                  x={i * 25 + 10}
                  y={10}
                  radius={8}
                  fill={i < gameState.player.hp ? "#e74c3c" : "#2d3748"}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      )}

      {gameState.status === 'won' && (
        <GameEndScreen
          status="victory"
          title="Mission Accomplished!"
          subtitle="You've successfully patrolled the skies and decoded the message."
          score={gameState.score}
          xp={gameState.xp}
          accuracy={gameState.collectedWords.length / gameState.sentence.length}
          onRestart={handleStart}
          onExit={() => {}}
        />
      )}

      {gameState.status === 'lost' && (
        <GameEndScreen
          status="defeat"
          title="Gryphon Down!"
          subtitle="The skies were too dangerous today. Retreat and recover."
          score={gameState.score}
          xp={gameState.xp}
          accuracy={gameState.collectedWords.length / gameState.sentence.length}
          onRestart={handleStart}
          onExit={() => {}}
        />
      )}
    </div>
  );
};

export default GryphonPatrolGame;
