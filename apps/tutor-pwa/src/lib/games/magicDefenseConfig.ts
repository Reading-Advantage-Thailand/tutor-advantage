import { Difficulty } from "@/store/useGameStore";
import { withBasePath } from "@/lib/games/basePath";

// Castle Configuration
export const CASTLE_CONFIG = {
  sheet: withBasePath("/games/vocabulary/magic-defense/castles_3x2_sheet.png"),
  columns: 2,
  rows: 3,
  sheetWidth: 1536,
  sheetHeight: 1024,
  spriteWidth: 768,
  spriteHeight: 341,
  scale: 0.25,
  barHeight: 8,
  renderWidth: 768 * 0.25, // CASTLE_SPRITE_WIDTH * CASTLE_SCALE
  renderHeight: 341 * 0.25, // CASTLE_SPRITE_HEIGHT * CASTLE_SCALE
  positions: {
    left: 20,
    center: 50,
    right: 80,
  } as const,
};

export const GAME_CONSTANTS = {
  backgroundImage: withBasePath("/games/vocabulary/magic-defense/background.png"),
  timer: 60,
  missileSpawnXRange: 25,
  missileSpawnXOffset: 37.5,
  manaCostSpecial: 100,
};

// Scaling & Difficulty
export const SCALING_CONFIG = {
  spawnRateAdjustment: 200,
  spawnRateLimit: 3000,
  durationAdjustment: 0.5,
  durationLimit: 15,
};

interface GameSettings {
  spawnRate: number;
  duration: number;
  minSpawnRate: number;
  minDuration: number;
}

export const DIFFICULTY_SETTINGS: Record<Difficulty, GameSettings> = {
  easy: {
    spawnRate: 6000,
    duration: 20,
    minSpawnRate: 3000,
    minDuration: 10,
  },
  normal: {
    spawnRate: 5000,
    duration: 15,
    minSpawnRate: 2000,
    minDuration: 8,
  },
  hard: {
    spawnRate: 4000,
    duration: 10,
    minSpawnRate: 1500,
    minDuration: 6,
  },
  extreme: {
    spawnRate: 3000,
    duration: 8,
    minSpawnRate: 800,
    minDuration: 5,
  },
};

export const getInitialSettings = (diff: Difficulty): GameSettings => {
  return DIFFICULTY_SETTINGS[diff] || DIFFICULTY_SETTINGS["normal"];
};
