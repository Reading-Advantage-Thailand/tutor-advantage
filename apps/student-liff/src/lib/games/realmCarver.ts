import { GRID_SIZE, REALM_CARVER_CONFIG } from "./realmCarverConfig";

export type Point = { x: number; y: number };

export type CellState = "wild" | "claimed" | "trail";

export interface RealmCarverMonster {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RealmCarverWord {
  id: string;
  term: string;
  translation: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface SentenceItem {
  term: string;
  translation: string;
}

export type RealmCarverDifficulty = "easy" | "medium" | "hard";

export interface RealmCarverState {
  grid: CellState[][];
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    maxHp: number;
  };
  monsters: RealmCarverMonster[];
  words: RealmCarverWord[];
  currentSentence: SentenceItem;
  fullSentence: SentenceItem[];
  targetWordIndex: number;
  score: number;
  status: "playing" | "victory" | "defeat";
  gameTime: number;
  difficulty: RealmCarverDifficulty;
}

function getDifficultySettings(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return { monsterCount: 1, playerHp: 5, monsterSpeed: 80 };
    case "hard":
      return { monsterCount: 4, playerHp: 2, monsterSpeed: 120 };
    case "medium":
    default:
      return { monsterCount: 2, playerHp: 3, monsterSpeed: 100 };
  }
}

export function createRealmCarverState(
  fullSentence: SentenceItem[],
  options: { difficulty?: string } = {},
): RealmCarverState {
  const rawDifficulty = options.difficulty || "medium";
  const difficulty: RealmCarverDifficulty = ["easy", "medium", "hard"].includes(rawDifficulty)
    ? (rawDifficulty as RealmCarverDifficulty)
    : "medium";
  const settings = getDifficultySettings(difficulty);

  const grid: CellState[][] = Array(GRID_SIZE)
    .fill(null)
    .map(() => Array(GRID_SIZE).fill("wild"));

  for (let i = 0; i < GRID_SIZE; i++) {
    grid[0][i] = "claimed";
    grid[GRID_SIZE - 1][i] = "claimed";
    grid[i][0] = "claimed";
    grid[i][GRID_SIZE - 1] = "claimed";
  }

  const monsters: RealmCarverMonster[] = [];
  for (let i = 0; i < settings.monsterCount; i++) {
    monsters.push({
      id: `monster-${i}`,
      x: GRID_SIZE / 2 + (Math.random() - 0.5) * 20,
      y: GRID_SIZE / 2 + (Math.random() - 0.5) * 20,
      vx: (Math.random() > 0.5 ? 1 : -1) * 0.5,
      vy: (Math.random() > 0.5 ? 1 : -1) * 0.5,
    });
  }

  const words: RealmCarverWord[] = fullSentence.map((item, index) => ({
    id: `word-${index}`,
    ...item,
    x: Math.random() * (GRID_SIZE - 10) + 5,
    y: Math.random() * (GRID_SIZE - 10) + 5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
  }));

  return {
    grid,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      hp: settings.playerHp,
      maxHp: settings.playerHp,
    },
    monsters,
    words,
    currentSentence: fullSentence[0],
    fullSentence,
    targetWordIndex: 0,
    score: 0,
    status: "playing",
    gameTime: 0,
    difficulty,
  };
}

function fillTerritory(state: RealmCarverState, grid: CellState[][]): CellState[][] {
  const nextGrid = grid.map(row => [...row]);
  const canBeReachedByMonster = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
  const stack: {x: number, y: number}[] = [];
  
  state.monsters.forEach(monster => {
    const mx = Math.floor(monster.x);
    const my = Math.floor(monster.y);
    if (mx >= 0 && mx < GRID_SIZE && my >= 0 && my < GRID_SIZE) {
      if (nextGrid[my][mx] === "wild") {
        stack.push({x: mx, y: my});
        canBeReachedByMonster[my][mx] = true;
      }
    }
  });
  
  while (stack.length > 0) {
    const {x, y} = stack.pop()!;
    const neighbors = [
      {nx: x + 1, ny: y}, {nx: x - 1, ny: y},
      {nx: x, ny: y + 1}, {nx: x, ny: y - 1},
    ];
    for (const {nx, ny} of neighbors) {
      if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
        if (nextGrid[ny][nx] === "wild" && !canBeReachedByMonster[ny][nx]) {
          canBeReachedByMonster[ny][nx] = true;
          stack.push({x: nx, y: ny});
        }
      }
    }
  }
  
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (nextGrid[y][x] === "wild" && !canBeReachedByMonster[y][x]) {
        nextGrid[y][x] = "claimed";
      }
    }
  }
  return nextGrid;
}

export function tickRealmCarver(state: RealmCarverState, delta: number): RealmCarverState {
  if (state.status !== "playing") return state;

  const seconds = delta / 1000;
  const speed = REALM_CARVER_CONFIG.player.speed;
  const currentGridX = Math.round(state.player.x);
  const currentGridY = Math.round(state.player.y);

  let nextX = state.player.x + state.player.vx * speed * seconds;
  let nextY = state.player.y + state.player.vy * speed * seconds;

  nextX = Math.max(0, Math.min(GRID_SIZE - 1, nextX));
  nextY = Math.max(0, Math.min(GRID_SIZE - 1, nextY));

  const nextGridX = Math.round(nextX);
  const nextGridY = Math.round(nextY);

  let nextGrid = [...state.grid.map(row => [...row])];
  let nextStatus: "playing" | "victory" | "defeat" = state.status;
  let nextPlayerHp = state.player.hp;
  let nextScore = state.score;
  let nextTargetWordIndex = state.targetWordIndex;
  const nextWords = [...state.words];

  if (nextGridX !== currentGridX || nextGridY !== currentGridY) {
    const nextCell = nextGrid[nextGridY][nextGridX];
    
    if (nextCell === "wild") {
      nextGrid[nextGridY][nextGridX] = "trail";
    } else if (nextCell === "trail") {
      nextPlayerHp -= 1;
      nextStatus = nextPlayerHp <= 0 ? "defeat" : "playing";
      if (nextStatus === "playing") {
        nextX = 0; nextY = 0;
        for (let y = 0; y < GRID_SIZE; y++) {
          for (let x = 0; x < GRID_SIZE; x++) {
            if (nextGrid[y][x] === "trail") nextGrid[y][x] = "wild";
          }
        }
      }
    } else if (nextCell === "claimed") {
      let hasTrail = false;
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (nextGrid[y][x] === "trail") {
            hasTrail = true;
            nextGrid[y][x] = "claimed";
          }
        }
      }
      if (hasTrail) {
        const oldGrid = state.grid;
        nextGrid = fillTerritory(state, nextGrid);
        for (let i = nextWords.length - 1; i >= 0; i--) {
          const word = nextWords[i];
          const wx = Math.round(word.x);
          const wy = Math.round(word.y);
          if (wx >= 0 && wx < GRID_SIZE && wy >= 0 && wy < GRID_SIZE) {
            if (oldGrid[wy][wx] !== "claimed" && nextGrid[wy][wx] === "claimed") {
              if (word.term === state.fullSentence[nextTargetWordIndex].term) {
                nextWords.splice(i, 1);
                nextTargetWordIndex++;
                nextScore += 100;
                if (nextTargetWordIndex >= state.fullSentence.length) nextStatus = "victory";
              } else {
                nextWords.splice(i, 1);
              }
            }
          }
        }
      }
    }
  }

  const monsterSpeed = REALM_CARVER_CONFIG.monster.speed;
  const nextMonsters = state.monsters.map(monster => {
    let mx = monster.x + monster.vx * monsterSpeed * seconds;
    let my = monster.y + monster.vy * monsterSpeed * seconds;
    let mvx = monster.vx;
    let mvy = monster.vy;
    const gmx = Math.round(mx);
    const gmy = Math.round(my);
    
    if (gmx <= 0 || gmx >= GRID_SIZE - 1 || nextGrid[gmy]?.[gmx] === "claimed") {
      mvx *= -1;
      mx = monster.x + mvx * monsterSpeed * seconds;
    }
    if (gmy <= 0 || gmy >= GRID_SIZE - 1 || nextGrid[gmy]?.[gmx] === "claimed") {
      mvy *= -1;
      my = monster.y + mvy * monsterSpeed * seconds;
    }

    return { ...monster, x: mx, y: my, vx: mvx, vy: mvy };
  });

  // Check monster-trail collision
  for (const monster of nextMonsters) {
    const mx = Math.round(monster.x);
    const my = Math.round(monster.y);
    if (mx >= 0 && mx < GRID_SIZE && my >= 0 && my < GRID_SIZE) {
      if (nextGrid[my][mx] === "trail") {
        nextPlayerHp -= 1;
        nextStatus = nextPlayerHp <= 0 ? "defeat" : "playing";
        if (nextStatus === "playing") {
          nextX = 0; nextY = 0;
          for (let ty = 0; ty < GRID_SIZE; ty++) {
            for (let tx = 0; tx < GRID_SIZE; tx++) {
              if (nextGrid[ty][tx] === "trail") nextGrid[ty][tx] = "wild";
            }
          }
        }
        break;
      }
    }
  }

  return {
    ...state,
    grid: nextGrid,
    player: { ...state.player, x: nextX, y: nextY, hp: nextPlayerHp },
    monsters: nextMonsters,
    words: nextWords,
    targetWordIndex: nextTargetWordIndex,
    currentSentence: state.fullSentence[nextTargetWordIndex] || state.fullSentence[state.fullSentence.length - 1],
    status: nextStatus,
    score: nextScore,
    gameTime: state.gameTime + delta,
  };
}

export function calculateXP(params: {
  targetWordIndex: number;
  fullSentenceLength: number;
  hp: number;
  maxHp: number;
  gameTime: number;
}): number {
  if (params.fullSentenceLength === 0) return 0;

  const accuracy = params.targetWordIndex / params.fullSentenceLength;
  const baseXP = params.targetWordIndex;

  let bonus = 0;
  if (accuracy === 1 && params.targetWordIndex > 0) bonus += 2; // Perfect accuracy bonus
  if (params.hp / params.maxHp >= 0.5) bonus += 1; // Survival bonus
  if (params.gameTime < 30000) bonus += 1; // Speed bonus (under 30s)

  return Math.min(10, baseXP + bonus);
}
