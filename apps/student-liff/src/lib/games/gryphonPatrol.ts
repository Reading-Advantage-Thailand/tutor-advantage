import { GRYPHON_PATROL_CONFIG } from './gryphonPatrolConfig';

export interface Position {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export interface Entity extends Position, Velocity {
  id: string;
  size: number;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  invulnerableTime: number;
}

export interface Enemy extends Entity {
  word: string;
  isTarget: boolean;
  isActive: boolean;
}

export interface Orb extends Entity {
  word: string;
  isActive: boolean;
}

export interface Projectile extends Entity {
  isActive: boolean;
}

export interface GameState {
  player: Player;
  enemies: Enemy[];
  orbs: Orb[];
  projectiles: Projectile[];
  cameraX: number;
  sentence: string[];
  collectedWords: string[];
  status: 'playing' | 'won' | 'lost' | 'paused' | 'start';
  score: number;
  xp: number;
  time: number;
}

export const createInitialGryphonPatrolState = (sentence: string[]): GameState => ({
  player: {
    id: 'player',
    x: 0,
    y: 400,
    vx: 0,
    vy: 0,
    size: 40,
    hp: 3,
    maxHp: 3,
    invulnerableTime: 0,
  },
  enemies: [],
  orbs: [],
  projectiles: [],
  cameraX: 0,
  sentence,
  collectedWords: [],
  status: 'start',
  score: 0,
  xp: 0,
  time: 0,
});

export const spawnGryphonPatrolEnemies = (
  state: GameState,
  rng: () => number = Math.random
): GameState => {
  const enemies: Enemy[] = [];
  const { sentence } = state;
  const { mapWidth, gameHeight, enemy: enemyConfig } = GRYPHON_PATROL_CONFIG;

  for (let i = 0; i < enemyConfig.count; i++) {
    const word = sentence[i % sentence.length];
    enemies.push({
      id: `enemy-${i}`,
      x: rng() * mapWidth,
      y: 100 + rng() * (gameHeight - 200),
      vx: (rng() - 0.5) * enemyConfig.speed,
      vy: (rng() - 0.5) * enemyConfig.speed,
      size: enemyConfig.size,
      word,
      isTarget: word === sentence[0],
      isActive: true,
    });
  }

  return { ...state, enemies };
};

export const hitGryphonPatrolEnemy = (state: GameState, enemyId: string): GameState => {
  const { enemies, orbs, sentence, collectedWords } = state;
  const enemyIndex = enemies.findIndex(e => e.id === enemyId);
  if (enemyIndex === -1 || !enemies[enemyIndex].isActive) return state;

  const enemy = enemies[enemyIndex];
  const targetWord = sentence[collectedWords.length];

  const nextEnemies = [...enemies];
  nextEnemies[enemyIndex] = { ...enemy, isActive: false };

  const nextOrbs = [...orbs];
  if (enemy.word === targetWord) {
    nextOrbs.push({
      id: `orb-${Date.now()}`,
      x: enemy.x,
      y: enemy.y,
      vx: 0,
      vy: 0,
      size: GRYPHON_PATROL_CONFIG.orb.size,
      word: enemy.word,
      isActive: true,
    });
  }

  // Update target word on other enemies
  const nextTargetWord = sentence[collectedWords.length + (enemy.word === targetWord ? 1 : 0)];
  const updatedEnemies = nextEnemies.map(e => ({
    ...e,
    isTarget: e.word === nextTargetWord
  }));

  return {
    ...state,
    enemies: updatedEnemies,
    orbs: nextOrbs,
  };
};

export const shootGryphonPatrolProjectile = (state: GameState): GameState => {
  if (state.status !== 'playing') return state;
  const { player, projectiles } = state;
  
  const vx = player.vx === 0 ? 500 : (player.vx / Math.abs(player.vx)) * 500;

  const newProjectile: Projectile = {
    id: `proj-${Date.now()}`,
    x: player.x,
    y: player.y,
    vx: vx,
    vy: 0,
    size: 8,
    isActive: true,
  };

  return {
    ...state,
    projectiles: [...projectiles, newProjectile],
  };
};

const checkCollision = (a: Entity, b: Entity): boolean => {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  const wrappedDx = Math.min(dx, GRYPHON_PATROL_CONFIG.mapWidth - dx);
  const distance = Math.sqrt(wrappedDx * wrappedDx + dy * dy);
  return distance < (a.size + b.size) / 2;
};

export const tickGryphonPatrol = (state: GameState, deltaTime: number): GameState => {
  if (state.status !== 'playing') return state;

  const { player, enemies, projectiles, sentence } = state;
  const { mapWidth, gameWidth, gameHeight, physics } = GRYPHON_PATROL_CONFIG;

  // Update Player Position
  let nextX = player.x + player.vx * deltaTime;
  let nextY = player.y + player.vy * deltaTime;
  nextX = (nextX + mapWidth) % mapWidth;
  nextY = Math.max(0, Math.min(gameHeight, nextY));

  // Update Player Velocity
  let nextVx = player.vx * physics.friction;
  let nextVy = player.vy * physics.friction;
  if (Math.abs(nextVx) < 1) nextVx = 0;
  if (Math.abs(nextVy) < 1) nextVy = 0;

  // Update Player Status
  let nextHp = player.hp;
  let nextInvulnerableTime = Math.max(0, player.invulnerableTime - deltaTime);
  let nextStatus: GameState['status'] = state.status;

  // Projectile/Enemy collision logic
  let finalState = {
    ...state,
    player: { ...player, x: nextX, y: nextY, vx: nextVx, vy: nextVy, invulnerableTime: nextInvulnerableTime },
    time: state.time + deltaTime,
  };

  // Update Projectiles
  const nextProjectiles = projectiles.map(proj => {
    if (!proj.isActive) return proj;
    const px = (proj.x + proj.vx * deltaTime + mapWidth) % mapWidth;
    const py = proj.y + proj.vy * deltaTime;
    
    for (const enemy of enemies) {
      if (enemy.isActive && checkCollision(proj, enemy)) {
        finalState = hitGryphonPatrolEnemy(finalState, enemy.id);
        return { ...proj, isActive: false };
      }
    }
    return { ...proj, x: px, y: py };
  }).filter(p => p.isActive);

  // Update Enemies and check player collision
  const nextEnemies = finalState.enemies.map(enemy => {
    if (!enemy.isActive) return enemy;

    if (nextInvulnerableTime === 0 && checkCollision(player, enemy)) {
      nextHp -= 1;
      nextInvulnerableTime = 1; // 1 second invulnerability
      if (nextHp <= 0) {
        nextStatus = 'lost';
      }
    }

    const ex = (enemy.x + enemy.vx * deltaTime + mapWidth) % mapWidth;
    let ey = enemy.y + enemy.vy * deltaTime;
    let evy = enemy.vy;
    if (ey < 50 || ey > gameHeight - 50) {
      evy = -evy;
      ey = Math.max(50, Math.min(gameHeight - 50, ey));
    }

    return { ...enemy, x: ex, y: ey, vy: evy };
  });

  // Update Orbs & Collect
  const nextCollectedWords = [...finalState.collectedWords];
  const finalOrbs = finalState.orbs.map(orb => {
    if (!orb.isActive) return orb;
    if (checkCollision(finalState.player, orb)) {
      nextCollectedWords.push(orb.word);
      return { ...orb, isActive: false };
    }
    return orb;
  });

  // Update Camera
  let nextCameraX = finalState.player.x - gameWidth / 2;
  nextCameraX = (nextCameraX + mapWidth) % mapWidth;

  // Check Win Condition
  if (nextCollectedWords.length === sentence.length) {
    nextStatus = 'won';
  }

  return {
    ...finalState,
    player: { ...finalState.player, hp: nextHp, invulnerableTime: nextInvulnerableTime },
    enemies: nextEnemies,
    projectiles: nextProjectiles,
    orbs: finalOrbs,
    collectedWords: nextCollectedWords,
    cameraX: nextCameraX,
    status: nextStatus,
    xp: nextCollectedWords.length,
    score: nextCollectedWords.length * 100,
  };
};

export const handleGryphonPatrolInput = (state: GameState, input: { dx: number, dy: number }): GameState => {
  if (state.status !== 'playing') return state;

  const { player } = state;
  const { speed } = GRYPHON_PATROL_CONFIG.player;

  return {
    ...state,
    player: {
      ...player,
      vx: player.vx + input.dx * speed,
      vy: player.vy + input.dy * speed,
    }
  };
};

export interface XPParams {
  collectedWords: number;
  totalWords: number;
  hp: number;
  maxHp: number;
  time: number;
}

export const calculateXP = (params: XPParams): number => {
  const { collectedWords, totalWords, hp, maxHp, time } = params;
  if (totalWords === 0) return 0;

  const accuracy = collectedWords / totalWords;
  const survivalBonus = hp / maxHp;
  const speedBonus = Math.max(0, 1 - time / 120); // Bonus for completing under 2 minutes

  let xp = Math.round((accuracy * 5 + survivalBonus * 3 + speedBonus * 2));
  xp = Math.max(1, Math.min(10, xp));
  return xp;
};
