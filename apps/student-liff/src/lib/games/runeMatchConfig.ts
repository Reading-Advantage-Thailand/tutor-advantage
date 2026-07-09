export type MonsterType = "goblin" | "skeleton" | "orc" | "dragon";

export type Difficulty = "easy" | "medium" | "hard";

export const MONSTER_DIFFICULTY: Record<MonsterType, Difficulty> = {
  goblin: "easy",
  skeleton: "medium",
  orc: "hard",
  dragon: "hard",
};

export type MonsterConfig = {
  hp: number;
  attack: number;
  xp: number;
};

export type RuneMatchConfig = {
  player: {
    maxHp: number;
  };
  monsters: Record<MonsterType, MonsterConfig>;
  combat: {
    attackIntervalMs: number;
    match3Damage: number;
    match4Damage: number;
    match5Damage: number;
    lShapeDamage: number;
    cascadeBonus: number;
    powerRuneMultiplier: number;
    invalidSwapPenalty: number;
  };
  powerUps: {
    healAmount: number;
    shieldDuration: number;
    spawnRate: number;
  };
  grid: {
    columns: number;
    rows: number;
  };
};

export const RUNE_MATCH_CONFIG: RuneMatchConfig = {
  player: {
    maxHp: 100,
  },
  monsters: {
    goblin: { hp: 50, attack: 2, xp: 3 },
    skeleton: { hp: 80, attack: 4, xp: 6 },
    orc: { hp: 120, attack: 6, xp: 9 },
    dragon: { hp: 160, attack: 8, xp: 12 },
  },
  combat: {
    attackIntervalMs: 5000,
    match3Damage: 10,
    match4Damage: 20,
    match5Damage: 30,
    lShapeDamage: 25,
    cascadeBonus: 5,
    powerRuneMultiplier: 2,
    invalidSwapPenalty: 1,
  },
  powerUps: {
    healAmount: 5,
    shieldDuration: 1,
    spawnRate: 0.1,
  },
  grid: {
    columns: 6,
    rows: 8,
  },
};
