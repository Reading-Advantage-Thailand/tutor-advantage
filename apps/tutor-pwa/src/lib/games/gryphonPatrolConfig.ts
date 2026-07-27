export const GRYPHON_PATROL_CONFIG = {
  gameWidth: 390,
  gameHeight: 844,
  mapWidth: 2000,
  
  player: {
    speed: 400,
    initialHp: 3,
    size: 40,
  },
  
  enemy: {
    count: 10,
    speed: 100,
    size: 32,
  },

  orb: {
    size: 24,
  },

  colors: {
    sky: "#4a90e2",
    ground: "#8b4513",
    player: "#f1c40f",
    enemy: "#e74c3c",
    target: "#2ecc71",
    orb: "#ffffff",
  },

  physics: {
    gravity: 0,
    friction: 0.95,
  }
};
