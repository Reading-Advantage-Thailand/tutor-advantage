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
  game: {
    durationMs: number;
    targetMatches: number;
  };
  monsters: Record<MonsterType, MonsterConfig>;
  board: {
    /** Different unfinished words on the board at once; the rest wait their turn. */
    wordsOnBoard: number;
    /** Tiles one unfinished word may hold, so the last words do not fill the board. */
    tilesPerWord: number;
    /** Tiles one finished word may keep as a decoy. */
    decoyTilesPerWord: number;
    /** Touching pairs a new board always starts with. */
    newBoardPairs: number;
    /** Touching pairs left after every match. */
    refillPairs: number;
  };
  friction: {
    /** Tiles stop answering after a wrong pair, longer each time in a row. */
    wrongPairLockMs: number[];
    /** A second tap on the same tile this soon is a shaky double tap, not a cancel. */
    doubleTapMs: number;
  };
  grid: {
    columns: number;
    rows: number;
  };
};

export const RUNE_MATCH_CONFIG: RuneMatchConfig = {
  player: {
    maxHp: 60000,
  },
  game: {
    durationMs: 60000,
    targetMatches: 10,
  },
  monsters: {
    goblin: { hp: 90, attack: 2, xp: 3 },
    skeleton: { hp: 130, attack: 4, xp: 6 },
    orc: { hp: 180, attack: 6, xp: 9 },
    dragon: { hp: 240, attack: 8, xp: 12 },
  },
  board: {
    wordsOnBoard: 7,
    tilesPerWord: 4,
    decoyTilesPerWord: 3,
    newBoardPairs: 4,
    refillPairs: 3,
  },
  friction: {
    wrongPairLockMs: [800, 1600, 2600, 3600],
    doubleTapMs: 300,
  },
  grid: {
    columns: 4,
    rows: 6,
  },
};
