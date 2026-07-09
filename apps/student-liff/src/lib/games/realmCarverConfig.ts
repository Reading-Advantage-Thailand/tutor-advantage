export const GAME_WIDTH = 390;
export const GAME_HEIGHT = 600;
export const GRID_SIZE = 100; // 100x100 logical grid

export const REALM_CARVER_CONFIG = {
  gridSize: GRID_SIZE,
  gameWidth: GAME_WIDTH,
  gameHeight: GAME_HEIGHT,
  
  player: {
    speed: 150, // units per second
    initialHp: 3,
    radius: 10,
  },
  
  monster: {
    speed: 100,
    count: 2,
    radius: 12,
  },
  
  word: {
    radius: 15,
  },

  colors: {
    wild: "#0f172a", // slate-900
    claimed: "#1e293b", // slate-800
    trail: "#f59e0b", // amber-500
    player: "#fbbf24", // amber-400
    monster: "#ef4444", // red-500
    word: "#a78bfa", // violet-400
    targetWord: "#fbbf24", // amber-400
  }
};
