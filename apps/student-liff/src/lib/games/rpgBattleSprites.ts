import { withBasePath } from './basePath'

const HERO_SPRITES = [
  withBasePath('/games/vocabulary/rpg-battle/hero_male_pose_sheet_3x3.png'),
  withBasePath('/games/vocabulary/rpg-battle/hero_female_pose_sheet_3x3.png'),
]

const ENEMY_SPRITES = [
  withBasePath('/games/vocabulary/rpg-battle/enemy_slime_pose_sheet_3x3.png'),
  withBasePath('/games/vocabulary/rpg-battle/enemy_goblin_pose_sheet_3x3.png'),
  withBasePath('/games/vocabulary/rpg-battle/enemy_spectre_pose_sheet_3x3.png'),
  withBasePath('/games/vocabulary/rpg-battle/enemy_elemental_pose_sheet_3x3.png'),
]

type RandomFn = () => number

const pickRandom = (items: string[], rng: RandomFn) => {
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length))
  return items[index]
}

export const selectRandomHeroSprite = (rng: RandomFn = Math.random) => {
  return pickRandom(HERO_SPRITES, rng)
}

export const selectRandomEnemySprite = (rng: RandomFn = Math.random) => {
  return pickRandom(ENEMY_SPRITES, rng)
}

export const spriteCatalog = {
  heroes: HERO_SPRITES,
  enemies: ENEMY_SPRITES,
}
