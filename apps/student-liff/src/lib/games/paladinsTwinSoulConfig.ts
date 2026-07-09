export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 844;

export const PALADINS_TWIN_SOUL_CONFIG = {
  gameWidth: GAME_WIDTH,
  gameHeight: GAME_HEIGHT,
  
  player: {
    width: 40,
    height: 40,
    speed: 300, // pixels per second
    initialHp: 3,
    bulletSpeed: 500,
    fireRate: 500, // ms
    y: GAME_HEIGHT - 100,
  },
  
  enemy: {
    width: 30,
    height: 30,
    rows: 4,
    cols: 6,
    padding: 20,
    speed: 50,
    diveProbability: 0.005,
    points: 100,
  },

  colors: {
    background: "#020617", // slate-950
    player: "#fbbf24", // amber-400
    twinSoul: "#fbbf24",
    bullet: "#fde047", // amber-300
    enemy: "#ef4444", // red-500
    targetEnemy: "#fbbf24", // amber-400
    text: "#ffffff",
  }
};
