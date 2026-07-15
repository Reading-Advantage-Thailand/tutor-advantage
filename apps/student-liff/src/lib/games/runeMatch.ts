import type { VocabularyItem } from "@/store/useGameStore";
import { RUNE_MATCH_CONFIG, type MonsterType } from "./runeMatchConfig";

export type GridPosition = {
  row: number;
  col: number;
};

export type VocabularyRune = {
  id: string;
  type: "vocabulary";
  wordId: string; // The unique English term
  text: string; // Thai or English display text
  face: "term" | "translation";
};

export type PowerUpRune = {
  id: string;
  type: "heal" | "shield";
};

export type Rune = VocabularyRune | PowerUpRune;

export type Player = {
  hp: number;
  maxHp: number;
  hasShield: boolean;
};

export type Monster = {
  type: MonsterType;
  hp: number;
  maxHp: number;
  attack: number;
  xp: number;
};

export type FloatingText = {
  id: string;
  text: string;
  x: number; // Grid col or -1 for center
  y: number; // Grid row or -1 for center
  offsetX: number; // Pixel offset
  offsetY: number; // Pixel offset
  color: string;
  opacity: number;
  scale: number;
  duration: number; // Remaining time in ms
  maxDuration: number;
};

export type RuneMatchState = {
  status: "selection" | "playing" | "victory" | "defeat";
  selectedMonster: MonsterType | null;
  player: Player;
  monster: Monster | null;
  grid: Rune[][];
  selectedCell: GridPosition | null;
  powerWord: string | null;
  correctAnswers: number;
  totalAttempts: number;
  nextAttackTimer: number; // Time until next monster attack
  activeVocabulary: VocabularyItem[]; // Subset of vocabulary used in this game session
  vocabulary: VocabularyItem[];
  rng: () => number;
  shakeIntensity: number;
  floatingTexts: FloatingText[];
  monsterState: "idle" | "attack" | "hurt" | "death";
  monsterStateTimer: number; // ms remaining in current state
  currentStreak: number; // Combo streak counter
  specialMoves: {
    shuffle: number;
    bomb: number;
    freeze: number;
  };
  isFrozen: boolean; // Monster is frozen (won't attack next turn)
  hintCells: GridPosition[]; // Cells to highlight for hint
  hintsRemaining: number; // Max 2 hints per game
  gameTimeMs: number;
};

export type RuneMatchConfig = {
  rng?: () => number;
};

const generateId = () => Math.random().toString(36).substring(2, 9);

const getMatchKey = (rune: Rune) => {
  return rune.type === "vocabulary" ? rune.wordId : rune.type;
};

const wouldCreateLineOfThree = (
  grid: (Rune | null)[][],
  row: number,
  col: number,
  rune: Rune,
) => {
  const key = getMatchKey(rune);
  const same = (other: Rune | null | undefined) =>
    !!other && other.type === rune.type && getMatchKey(other) === key;

  return (
    (same(grid[row]?.[col - 1]) && same(grid[row]?.[col - 2])) ||
    (same(grid[row - 1]?.[col]) && same(grid[row - 2]?.[col]))
  );
};

// Create a grid and ensure it has at least one possible move
export const initializeGrid = (
  vocabulary: VocabularyItem[],
  { rng = Math.random }: RuneMatchConfig = {},
): Rune[][] => {
  let attempts = 0;
  const maxAttempts = 50;

  while (attempts < maxAttempts) {
    attempts++;
    const grid = createGridWithoutMatches(vocabulary, rng);
    const possibleMoves = findPossibleMoves(grid);

    if (possibleMoves.length > 0) {
      return grid; // Grid is playable
    }
  }

  // Fallback: return a grid even if no moves found (should be rare)
  return createGridWithoutMatches(vocabulary, rng);
};

// Create a grid without initial matches
const createGridWithoutMatches = (
  vocabulary: VocabularyItem[],
  rng: () => number,
): Rune[][] => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  const grid: Rune[][] = Array.from({ length: rows }, () => []);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      let validRune: Rune | null = null;
      let attempts = 0;

      while (!validRune && attempts < 100) {
        attempts++;
        const rune = createRandomRune(vocabulary, rng);
        if (!wouldCreateLineOfThree(grid, r, c, rune)) {
          validRune = rune;
        }
      }
      grid[r][c] = validRune || createRandomRune(vocabulary, rng);
    }
  }
  return grid;
};

export const initializeEmptyGrid = (vocabulary: VocabularyItem[]): Rune[][] => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  const grid: Rune[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < columns; c++) {
      const item = vocabulary[(r * columns + c) % vocabulary.length];
      grid[r][c] = {
        id: `empty-${r}-${c}`,
        type: "vocabulary",
        wordId: `word-${r}-${c}`,
        text: item.term,
        face: "term",
      };
    }
  }
  return grid;
};

export const swapRunes = (
  grid: Rune[][],
  pos1: GridPosition,
  pos2: GridPosition,
): Rune[][] => {
  const newGrid = grid.map((row) => [...row]);
  const temp = newGrid[pos1.row][pos1.col];
  newGrid[pos1.row][pos1.col] = newGrid[pos2.row][pos2.col];
  newGrid[pos2.row][pos2.col] = temp;
  return newGrid;
};

export type MatchGroup = {
  coords: GridPosition[];
  isSpecial: boolean;
  type: "vocabulary" | "heal" | "shield";
  wordId?: string;
};

export type MatchResult = {
  grid: Rune[][];
  cascades: number;
  groups: (MatchGroup & { cascadeIndex: number })[];
};

// Find all possible valid moves (for hint system)
export const findPossibleMoves = (
  grid: Rune[][],
): { from: GridPosition; to: GridPosition }[] => {
  const rows = grid.length;
  const cols = grid[0].length;
  const moves: { from: GridPosition; to: GridPosition }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1 && isRunePairMatch(grid[r][c], grid[r][c + 1])) {
        moves.push({ from: { row: r, col: c }, to: { row: r, col: c + 1 } });
      }
      if (r < rows - 1 && isRunePairMatch(grid[r][c], grid[r + 1][c])) {
        moves.push({ from: { row: r, col: c }, to: { row: r + 1, col: c } });
      }
    }
  }
  return moves;
};

export const isRunePairMatch = (first?: Rune, second?: Rune) =>
  !!first &&
  !!second &&
  first.type === "vocabulary" &&
  second.type === "vocabulary" &&
  first.wordId === second.wordId &&
  first.face !== second.face;

export const findMatches = (grid: Rune[][]): MatchGroup[] => {
  const rows = grid.length;
  const cols = grid[0].length;
  const horizontalMatches: GridPosition[][] = [];
  const verticalMatches: GridPosition[][] = [];

  for (let r = 0; r < rows; r++) {
    let segment: GridPosition[] = [{ row: r, col: 0 }];
    for (let c = 1; c <= cols; c++) {
      const r1 = c < cols ? grid[r][c] : null;
      const r2 = grid[r][c - 1];
      if (r1 && r1.type === r2.type && getMatchKey(r1) === getMatchKey(r2)) {
        segment.push({ row: r, col: c });
      } else {
        if (segment.length >= 3) horizontalMatches.push(segment);
        if (c < cols) segment = [{ row: r, col: c }];
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let segment: GridPosition[] = [{ row: 0, col: c }];
    for (let r = 1; r <= rows; r++) {
      const r1 = r < rows ? grid[r][c] : null;
      const r2 = r > 0 ? grid[r - 1][c] : null;
      if (
        r1 &&
        r2 &&
        r1.type === r2.type &&
        getMatchKey(r1) === getMatchKey(r2)
      ) {
        segment.push({ row: r, col: c });
      } else {
        if (segment.length >= 3) verticalMatches.push(segment);
        if (r < rows) segment = [{ row: r, col: c }];
      }
    }
  }

  const allSegments = [...horizontalMatches, ...verticalMatches];
  if (allSegments.length === 0) return [];

  const groups: MatchGroup[] = [];
  const visitedSegments = new Set<number>();

  for (let i = 0; i < allSegments.length; i++) {
    if (visitedSegments.has(i)) continue;
    const currentGroupCoords = new Map<string, GridPosition>();
    const queue = [i];
    visitedSegments.add(i);
    let hasIntersection = false;
    while (queue.length > 0) {
      const segIdx = queue.shift()!;
      const segment = allSegments[segIdx];
      for (const p of segment) {
        const key = `${p.row},${p.col}`;
        if (currentGroupCoords.has(key)) hasIntersection = true;
        currentGroupCoords.set(key, p);
      }
      for (let j = 0; j < allSegments.length; j++) {
        if (visitedSegments.has(j)) continue;
        const otherSegment = allSegments[j];
        const overlaps = otherSegment.some((p) =>
          segment.some((sp) => sp.row === p.row && sp.col === p.col),
        );
        if (overlaps) {
          visitedSegments.add(j);
          queue.push(j);
        }
      }
    }
    const coords = Array.from(currentGroupCoords.values());
    const firstRune = grid[coords[0].row][coords[0].col];
    groups.push({
      coords,
      isSpecial: hasIntersection && coords.length >= 5,
      type: firstRune.type,
      wordId:
        firstRune.type === "vocabulary"
          ? (firstRune as VocabularyRune).wordId
          : undefined,
    });
  }
  return groups;
};

export const applyGravity = (
  grid: Rune[][],
  matchedCoords: GridPosition[],
  vocabulary: VocabularyItem[],
  { rng = Math.random }: RuneMatchConfig = {},
): Rune[][] => {
  const rows = grid.length;
  const cols = grid[0].length;
  const newGrid: (Rune | null)[][] = grid.map((row) => [...row]);
  for (const { row, col } of matchedCoords) {
    newGrid[row][col] = null;
  }
  for (let c = 0; c < cols; c++) {
    const columnRunes: Rune[] = [];
    for (let r = rows - 1; r >= 0; r--) {
      if (newGrid[r][c] !== null) columnRunes.push(newGrid[r][c] as Rune);
    }
    for (let r = rows - 1; r >= 0; r--) {
      const existingRune = columnRunes.shift();
      if (existingRune) {
        newGrid[r][c] = existingRune;
      } else {
        let validRune: Rune | null = null;
        let attempts = 0;
        while (!validRune && attempts < 20) {
          attempts++;
          const rune = createRandomRune(vocabulary, rng);
          if (!wouldCreateLineOfThree(newGrid, r, c, rune)) validRune = rune;
        }
        newGrid[r][c] = validRune || createRandomRune(vocabulary, rng);
      }
    }
  }
  return newGrid as Rune[][];
};

export const processMatches = (
  grid: Rune[][],
  vocabulary: VocabularyItem[],
  { rng = Math.random }: RuneMatchConfig = {},
): MatchResult => {
  let currentGrid = grid;
  let totalCascades = 0;
  const allGroups: (MatchGroup & { cascadeIndex: number })[] = [];
  let groups = findMatches(currentGrid);
  while (groups.length > 0) {
    for (const group of groups) {
      allGroups.push({ ...group, cascadeIndex: totalCascades });
    }
    currentGrid = applyGravity(
      currentGrid,
      groups.flatMap((g) => g.coords),
      vocabulary,
      { rng },
    );
    totalCascades++;
    groups = findMatches(currentGrid);
    if (totalCascades > 100) break;
  }
  return { grid: currentGrid, cascades: totalCascades, groups: allGroups };
};

export const advanceTime = (
  state: RuneMatchState,
  deltaMs: number,
): RuneMatchState => {
  if (state.status !== "playing") return state;
  const newState = { ...state };
  newState.gameTimeMs = state.gameTimeMs + deltaMs;
  newState.player = {
    ...newState.player,
    hp: Math.max(0, RUNE_MATCH_CONFIG.game.durationMs - newState.gameTimeMs),
  };

  if (newState.gameTimeMs >= RUNE_MATCH_CONFIG.game.durationMs) {
    newState.status = "defeat";
    return newState;
  }

  // Advance monster state
  if (newState.monsterStateTimer > 0) {
    newState.monsterStateTimer -= deltaMs;
    if (newState.monsterStateTimer <= 0) {
      newState.monsterState = "idle";
      newState.monsterStateTimer = 0;
    }
  }

  // Decay shake
  newState.shakeIntensity = Math.max(
    0,
    newState.shakeIntensity - deltaMs / 500,
  );

  newState.floatingTexts = newState.floatingTexts
    .map((ft) => {
      const remaining = ft.duration - deltaMs;
      const progress = 1 - remaining / ft.maxDuration;
      return {
        ...ft,
        offsetX: ft.offsetX + (deltaMs / 1000) * 40,
        offsetY: ft.offsetY - (deltaMs / 1000) * 80,
        opacity: Math.max(0, 1 - progress),
        scale: 1 + progress * 0.8,
        duration: remaining,
      };
    })
    .filter((ft) => ft.duration > 0);

  // Realtime monster pressure only shows feedback now; the 60s timer is HP.
  if (newState.monster && !newState.isFrozen && newState.status === "playing") {
    newState.nextAttackTimer -= deltaMs;
    if (newState.nextAttackTimer <= 0) {
      if (newState.player.hasShield) {
        newState.player = { ...newState.player, hasShield: false };
        newState.floatingTexts = [
          ...newState.floatingTexts,
          {
            id: generateId(),
            text: "BLOCKED!",
            x: -1,
            y: -1,
            offsetX: 0,
            offsetY: 0,
            color: "#60a5fa",
            opacity: 1,
            scale: 1,
            duration: 2000,
            maxDuration: 2000,
          },
        ];
      } else {
        newState.floatingTexts = [
          ...newState.floatingTexts,
          {
            id: generateId(),
            text: "HURRY!",
            x: -1,
            y: -1,
            offsetX: 0,
            offsetY: 0,
            color: "#ef4444",
            opacity: 1,
            scale: 1,
            duration: 2000,
            maxDuration: 2000,
          },
        ];
        newState.shakeIntensity = 1.0;
      }

      newState.monsterState = "attack";
      newState.monsterStateTimer = 500;
      newState.nextAttackTimer = 3000 + state.rng() * 2000;
    }
  }

  return newState;
};

// Special move: Shuffle all runes
export const shuffleGrid = (state: RuneMatchState): RuneMatchState => {
  if (state.specialMoves.shuffle <= 0) return state;
  const newGrid = initializeGrid(state.activeVocabulary || state.vocabulary, {
    rng: state.rng,
  });
  return {
    ...state,
    grid: newGrid,
    specialMoves: {
      ...state.specialMoves,
      shuffle: state.specialMoves.shuffle - 1,
    },
    floatingTexts: [
      ...state.floatingTexts,
      {
        id: generateId(),
        text: "SHUFFLE!",
        x: -1,
        y: -1,
        offsetX: 0,
        offsetY: 0,
        color: "#22c55e",
        opacity: 1,
        scale: 1,
        duration: 2000,
        maxDuration: 2000,
      },
    ],
  };
};

// Special move: Freeze monster (skip next attack)
export const freezeMonster = (state: RuneMatchState): RuneMatchState => {
  if (state.specialMoves.freeze <= 0) return state;
  return {
    ...state,
    isFrozen: true,
    specialMoves: {
      ...state.specialMoves,
      freeze: state.specialMoves.freeze - 1,
    },
    floatingTexts: [
      ...state.floatingTexts,
      {
        id: generateId(),
        text: "FROZEN!",
        x: -1,
        y: -1,
        offsetX: 0,
        offsetY: 0,
        color: "#60a5fa",
        opacity: 1,
        scale: 1,
        duration: 2000,
        maxDuration: 2000,
      },
    ],
  };
};

export const calculateMatchDamage = (
  runeCount: number,
  isPowerRune: boolean,
): number => {
  const { combat } = RUNE_MATCH_CONFIG;
  let damage = 0;
  if (runeCount === 2) damage = combat.match3Damage;
  else if (runeCount === 3) damage = combat.match3Damage;
  else if (runeCount === 4) damage = combat.match4Damage;
  else if (runeCount >= 5) damage = combat.match5Damage;
  if (isPowerRune) damage *= combat.powerRuneMultiplier;
  return damage;
};

export const applyPairMatchResult = (
  state: RuneMatchState,
  first: GridPosition,
  second: GridPosition,
): RuneMatchState => {
  if (state.status !== "playing") return state;

  const firstRune = state.grid[first.row]?.[first.col];
  const secondRune = state.grid[second.row]?.[second.col];
  if (!isRunePairMatch(firstRune, secondRune)) return state;

  const vocabulary = state.activeVocabulary || state.vocabulary;
  const matchedWordId =
    firstRune.type === "vocabulary" ? firstRune.wordId : "";
  const matchedWord = vocabulary.find(
    (word) => word.term.toLowerCase().trim() === matchedWordId,
  );
  const isPower = matchedWord?.translation === state.powerWord;
  const damage = calculateMatchDamage(2, isPower);
  const correctAnswers = state.correctAnswers + 1;
  const totalAttempts = state.totalAttempts + 1;
  const nextMonsterHp = Math.max(0, (state.monster?.hp || 0) - damage);
  const isVictory = correctAnswers >= RUNE_MATCH_CONFIG.game.targetMatches;

  return {
    ...state,
    grid: applyGravity(state.grid, [first, second], vocabulary, {
      rng: state.rng,
    }),
    selectedCell: null,
    status: isVictory ? "victory" : state.status,
    monster: state.monster
      ? { ...state.monster, hp: isVictory ? nextMonsterHp : Math.max(1, nextMonsterHp) }
      : null,
    correctAnswers,
    totalAttempts,
    monsterState: "hurt",
    monsterStateTimer: 500,
    floatingTexts: [
      ...state.floatingTexts,
      {
        id: generateId(),
        text: `${isPower ? "POWER! " : ""}+1 / ${damage}`,
        x: second.col,
        y: second.row,
        offsetX: 0,
        offsetY: 0,
        color: isPower ? "#facc15" : "#22c55e",
        opacity: 1,
        scale: 1,
        duration: 1800,
        maxDuration: 1800,
      },
    ],
  };
};

export const applyMatchResult = (
  state: RuneMatchState,
  result: MatchResult,
): RuneMatchState => {
  if (state.status !== "playing") return state;
  let monsterHp = state.monster?.hp || 0;
  let hasShield = state.player.hasShield;
  let correctAnswers = state.correctAnswers;
  const totalAttempts = state.totalAttempts + 1;
  let totalDamage = 0;
  let hasVocabularyMatch = false;
  const newFloatingTexts = [...state.floatingTexts];

  for (const group of result.groups) {
    const firstCoord = group.coords[0];
    const tx = firstCoord.col;
    const ty = firstCoord.row;

    if (group.type === "vocabulary") {
      const isPower = group.wordId === state.powerWord;
      hasVocabularyMatch = true;
      const baseDamage = calculateMatchDamage(group.coords.length, isPower);
      const specialBonus = group.isSpecial
        ? RUNE_MATCH_CONFIG.combat.lShapeDamage
        : 0;
      const groupTotal = baseDamage + specialBonus;
      totalDamage += groupTotal;
      newFloatingTexts.push({
        id: generateId(),
        text: `${isPower ? "POWER! " : ""}${groupTotal}`,
        x: tx,
        y: ty,
        offsetX: 0,
        offsetY: 0,
        color: isPower ? "#facc15" : "#ffffff",
        opacity: 1,
        scale: 1,
        duration: 3000,
        maxDuration: 3000,
      });
    } else if (group.type === "heal") {
      const healAmt =
        group.coords.length * RUNE_MATCH_CONFIG.powerUps.healAmount;
      newFloatingTexts.push({
        id: generateId(),
        text: `+${healAmt}`,
        x: tx,
        y: ty,
        offsetX: 0,
        offsetY: 0,
        color: "#22c55e",
        opacity: 1,
        scale: 1,
        duration: 3000,
        maxDuration: 3000,
      });
    } else if (group.type === "shield") {
      hasShield = true;
      newFloatingTexts.push({
        id: generateId(),
        text: "SHIELD!",
        x: tx,
        y: ty,
        offsetX: 0,
        offsetY: 0,
        color: "#60a5fa",
        opacity: 1,
        scale: 1,
        duration: 3000,
        maxDuration: 3000,
      });
    }
  }

  const uniqueCascadeLevels = new Set(result.groups.map((g) => g.cascadeIndex));
  uniqueCascadeLevels.forEach((idx) => {
    if (idx > 0) {
      totalDamage += RUNE_MATCH_CONFIG.combat.cascadeBonus;
      newFloatingTexts.push({
        id: generateId(),
        text: `COMBO x${idx + 1}!`,
        x: -1,
        y: -1,
        offsetX: 0,
        offsetY: 0,
        color: "#fb923c",
        opacity: 1,
        scale: 1,
        duration: 3000,
        maxDuration: 3000,
      });
    }
  });

  if (hasVocabularyMatch) correctAnswers++;

  monsterHp = Math.max(0, monsterHp - totalDamage);

  let status: RuneMatchState["status"] = state.status;
  let monsterState = state.monsterState;
  let monsterStateTimer = state.monsterStateTimer;

  if (totalDamage > 0) {
    if (correctAnswers >= RUNE_MATCH_CONFIG.game.targetMatches) {
      status = "victory";
      monsterState = "death";
      monsterStateTimer = 2000; // Show death pose for 2s
    } else {
      monsterHp = Math.max(1, monsterHp);
      monsterState = "hurt";
      monsterStateTimer = 500;
    }
  }

  return {
    ...state,
    grid: result.grid,
    status,
    monster: state.monster ? { ...state.monster, hp: monsterHp } : null,
    player: { ...state.player, hasShield },
    correctAnswers,
    totalAttempts,
    floatingTexts: newFloatingTexts,
    monsterState,
    monsterStateTimer,
  };
};

const createRandomRune = (
  vocabulary: VocabularyItem[],
  rng: () => number,
): Rune => {
  const roll = rng();
  const { spawnRate } = RUNE_MATCH_CONFIG.powerUps;
  if (roll < spawnRate)
    return { id: generateId(), type: rng() > 0.5 ? "heal" : "shield" };

  // Use the provided vocabulary (should already be limited/active subset)
  const item = vocabulary[Math.floor(rng() * vocabulary.length)];
  const face = rng() > 0.5 ? "translation" : "term";
  return {
    id: generateId(),
    type: "vocabulary",
    wordId: item.term.toLowerCase().trim(), // Use English term as key (normalized)
    text: face === "translation" ? item.translation : item.term,
    face,
  };
};

export const createRuneMatchState = (
  vocabulary: VocabularyItem[],
  { rng = Math.random }: RuneMatchConfig = {},
): RuneMatchState => {
  if (vocabulary.length === 0) throw new Error("Vocabulary cannot be empty");

  // Shuffle vocabulary to avoid repetitive words
  const shuffledVocab = [...vocabulary].sort(() => rng() - 0.5);

  // Select active vocabulary for the 10-match objective.
  const maxWords = Math.min(10, shuffledVocab.length);
  const activeVocabulary = shuffledVocab.slice(0, maxWords);

  // Pick power word from active vocabulary
  const powerWord =
    activeVocabulary[Math.floor(rng() * activeVocabulary.length)].translation;

  return {
    status: "selection",
    selectedMonster: null,
    player: {
      hp: RUNE_MATCH_CONFIG.game.durationMs,
      maxHp: RUNE_MATCH_CONFIG.game.durationMs,
      hasShield: false,
    },
    monster: null,
    grid: [],
    selectedCell: null,
    powerWord,
    correctAnswers: 0,
    totalAttempts: 0,
    nextAttackTimer: 3000,
    activeVocabulary,
    vocabulary,
    rng,
    shakeIntensity: 0,
    floatingTexts: [],
    monsterState: "idle",
    monsterStateTimer: 0,
    currentStreak: 0,
    specialMoves: { shuffle: 1, bomb: 0, freeze: 0 },
    isFrozen: false,
    hintCells: [],
    hintsRemaining: 2,
    gameTimeMs: 0,
  };
};
