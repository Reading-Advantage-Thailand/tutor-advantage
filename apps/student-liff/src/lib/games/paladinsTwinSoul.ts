import { GAME_WIDTH, GAME_HEIGHT, PALADINS_TWIN_SOUL_CONFIG } from "./paladinsTwinSoulConfig";

export interface VocabularyItem {
  term: string;
  translation: string;
}

export interface PaladinBullet {
  id: string;
  x: number;
  y: number;
  isPlayer: boolean;
}

export interface PaladinEnemy {
  id: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  type: "normal" | "boss";
  term?: string;
  translation?: string;
  isDiving: boolean;
  isCapturing: boolean;
  hasCapturedPlayer: boolean;
}

export interface PaladinsTwinSoulState {
  player: {
    x: number;
    hp: number;
    maxHp: number;
    lastFireTime: number;
    hasTwinSoul: boolean;
    isCaptured: boolean;
  };
  enemies: PaladinEnemy[];
  bullets: PaladinBullet[];
  vocabulary: VocabularyItem[];
  targetWordIndex: number;
  score: number;
  status: "playing" | "victory" | "defeat";
  wave: number;
  waveDirection: 1 | -1;
  gameTime: number;
  difficulty: string;
  correctAnswers: number;
  totalAttempts: number;
}

export function createPaladinsTwinSoulState(
  vocabulary: VocabularyItem[],
  options: { difficulty?: string } = {},
): PaladinsTwinSoulState {
  const enemies: PaladinEnemy[] = [];
  const { rows, cols, padding, width, height } = PALADINS_TWIN_SOUL_CONFIG.enemy;
  
  const totalWidth = cols * (width + padding) - padding;
  const startX = (GAME_WIDTH - totalWidth) / 2 + width / 2;
  const startY = 100;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isBoss = r === 0 && (c === 2 || c === 3);
      enemies.push({
        id: `enemy-${r}-${c}`,
        x: startX + c * (width + padding),
        y: startY + r * (height + padding),
        baseX: startX + c * (width + padding),
        baseY: startY + r * (height + padding),
        type: isBoss ? "boss" : "normal",
        isDiving: false,
        isCapturing: false,
        hasCapturedPlayer: false,
      });
    }
  }

  return {
    player: {
      x: GAME_WIDTH / 2,
      hp: PALADINS_TWIN_SOUL_CONFIG.player.initialHp,
      maxHp: PALADINS_TWIN_SOUL_CONFIG.player.initialHp,
      lastFireTime: -PALADINS_TWIN_SOUL_CONFIG.player.fireRate,
      hasTwinSoul: false,
      isCaptured: false,
    },
    enemies,
    bullets: [],
    vocabulary,
    targetWordIndex: 0,
    score: 0,
    status: "playing",
    wave: 1,
    waveDirection: 1,
    gameTime: 0,
    difficulty: options.difficulty || "medium",
    correctAnswers: 0,
    totalAttempts: 0,
  };
}

export function tickPaladinsTwinSoul(
  state: PaladinsTwinSoulState,
  delta: number,
  input: { dx: number } = { dx: 0 }
): PaladinsTwinSoulState {
  if (state.status !== "playing") return state;

  const seconds = delta / 1000;
  const playerSpeed = PALADINS_TWIN_SOUL_CONFIG.player.speed;
  
  // Move player
  let nextPlayerX = state.player.x + input.dx * playerSpeed * seconds;
  nextPlayerX = Math.max(20, Math.min(GAME_WIDTH - 20, nextPlayerX));

  // Move Enemies (side to side)
  const enemySpeed = PALADINS_TWIN_SOUL_CONFIG.enemy.speed;
  let nextWaveDirection = state.waveDirection;
  
  let minX = GAME_WIDTH;
  let maxX = 0;
  state.enemies.forEach(e => {
    if (!e.isDiving) {
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
  });

  if (maxX > GAME_WIDTH - 40 && nextWaveDirection === 1) nextWaveDirection = -1;
  else if (minX < 40 && nextWaveDirection === -1) nextWaveDirection = 1;

  const nextEnemies = state.enemies.map(e => {
    if (e.isDiving) {
      return { ...e, y: e.y + enemySpeed * 2 * seconds };
    }
    return {
      ...e,
      x: e.x + nextWaveDirection * enemySpeed * seconds,
    };
  });

  // Shooting & Collisions
  const nextBullets = [...state.bullets.map(b => ({ ...b }))];
  let nextLastFireTime = state.player.lastFireTime;
  const currentTime = state.gameTime + delta;
  let nextHasTwinSoul = state.player.hasTwinSoul;
  let nextIsCaptured = state.player.isCaptured;
  let nextScore = state.score;
  let nextPlayerHp = state.player.hp;
  let nextStatus: PaladinsTwinSoulState['status'] = state.status;

  // Auto-fire
  if (!nextIsCaptured && currentTime - nextLastFireTime >= PALADINS_TWIN_SOUL_CONFIG.player.fireRate) {
    nextLastFireTime = currentTime;
    nextBullets.push({
      id: `bullet-p-${currentTime}`,
      x: nextPlayerX,
      y: PALADINS_TWIN_SOUL_CONFIG.player.y - 20,
      isPlayer: true,
    });
    if (nextHasTwinSoul) {
      nextBullets.push({
        id: `bullet-t-${currentTime}`,
        x: nextPlayerX + 45,
        y: PALADINS_TWIN_SOUL_CONFIG.player.y - 20,
        isPlayer: true,
      });
    }
  }

  const bulletSpeed = PALADINS_TWIN_SOUL_CONFIG.player.bulletSpeed;
  for (let i = nextBullets.length - 1; i >= 0; i--) {
    const b = nextBullets[i];
    if (b.isPlayer) {
      b.y -= bulletSpeed * seconds;
      
      const hitEnemyIndex = nextEnemies.findIndex(e => 
        Math.abs(e.x - b.x) < 20 && Math.abs(e.y - b.y) < 20
      );
      if (hitEnemyIndex !== -1) {
        const hitEnemy = nextEnemies[hitEnemyIndex];
        if (hitEnemy.hasCapturedPlayer) {
          nextHasTwinSoul = true;
          nextIsCaptured = false;
        }
        nextEnemies.splice(hitEnemyIndex, 1);
        nextBullets.splice(i, 1);
        nextScore += PALADINS_TWIN_SOUL_CONFIG.enemy.points;
        continue;
      }
    } else {
      b.y += bulletSpeed * 0.6 * seconds;
      if (Math.abs(b.x - nextPlayerX) < 25 && Math.abs(b.y - PALADINS_TWIN_SOUL_CONFIG.player.y) < 25) {
        nextBullets.splice(i, 1);
        nextPlayerHp -= 1;
        if (nextPlayerHp <= 0) nextStatus = "defeat";
        continue;
      }
    }
    if (b.y < -50 || b.y > GAME_HEIGHT + 50) {
      nextBullets.splice(i, 1);
    }
  }

  // Capture & Dive Collisions
  nextEnemies.forEach((e) => {
    if (e.isCapturing) {
      if (Math.abs(e.x - nextPlayerX) < 40 && e.y < PALADINS_TWIN_SOUL_CONFIG.player.y) {
        nextIsCaptured = true;
        e.hasCapturedPlayer = true;
        e.isCapturing = false;
        e.isDiving = false;
        e.y = e.baseY;
        e.x = e.baseX;

        const targetWord = state.vocabulary[state.targetWordIndex];
        e.term = targetWord.term;
        e.translation = targetWord.translation;

        const otherWords = state.vocabulary.filter((_, i) => i !== state.targetWordIndex);
        nextEnemies.forEach(oe => {
          if (oe.id !== e.id) {
            const distractor = otherWords[Math.floor(Math.random() * otherWords.length)] || targetWord;
            oe.term = distractor.term;
            oe.translation = distractor.translation;
          }
        });
      }
    } else if (e.isDiving) {
      if (Math.abs(e.x - nextPlayerX) < 30 && Math.abs(e.y - PALADINS_TWIN_SOUL_CONFIG.player.y) < 30) {
        nextPlayerHp -= 1;
        if (nextPlayerHp <= 0) nextStatus = "defeat";
        e.y = -100; 
      }
    }
  });

  // Wave Progression
  let nextWave = state.wave;
  let nextTargetWordIndex = state.targetWordIndex;
  let nextCorrectAnswers = state.correctAnswers;
  let nextTotalAttempts = state.totalAttempts;
  if (nextEnemies.length === 0 && nextStatus === "playing") {
    nextWave += 1;
    nextTargetWordIndex += 1;
    nextCorrectAnswers += 1;
    nextTotalAttempts += 1;
    if (nextTargetWordIndex >= state.vocabulary.length) {
      nextStatus = "victory";
    } else {
      // Spawn new wave
      const newState = createPaladinsTwinSoulState(state.vocabulary, { difficulty: state.difficulty });
      nextEnemies.push(...newState.enemies);
    }
  }

  return {
    ...state,
    player: {
      ...state.player,
      x: nextPlayerX,
      lastFireTime: nextLastFireTime,
      hp: nextPlayerHp,
      isCaptured: nextIsCaptured,
      hasTwinSoul: nextHasTwinSoul,
    },
    enemies: nextEnemies,
    bullets: nextBullets,
    waveDirection: nextWaveDirection,
    score: nextScore,
    status: nextStatus,
    wave: nextWave,
    targetWordIndex: nextTargetWordIndex,
    gameTime: currentTime,
    correctAnswers: nextCorrectAnswers,
    totalAttempts: nextTotalAttempts,
  };
}

export function calculateXP(params: {
  correctWords: number;
  totalAttempts: number;
  lives: number;
  initialLives: number;
  gameTime: number;
}): number {
  if (params.totalAttempts === 0) return 0;

  const accuracy = params.correctWords / params.totalAttempts;
  const baseXP = params.correctWords;

  let bonus = 0;
  if (accuracy === 1) bonus += 2; // Perfect accuracy bonus
  if (params.lives / params.initialLives >= 0.5) bonus += 1; // Survival bonus
  if (params.gameTime < 30000) bonus += 1; // Speed bonus (under 30s)

  return Math.min(10, baseXP + bonus);
}
