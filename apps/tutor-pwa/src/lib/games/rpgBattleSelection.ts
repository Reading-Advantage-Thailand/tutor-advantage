import { withBasePath } from './basePath'

export type BattleHeroId = 'male' | 'female'
export type BattleLocationId = 'forest-clearing' | 'ruined-road' | 'magic-arena' | 'throne-hall'
export type BattleEnemyId = 'slime' | 'goblin' | 'spectre' | 'elemental'

export interface BattleHeroOption {
  id: BattleHeroId
  label: string
  sprite: string
}

export interface BattleLocationOption {
  id: BattleLocationId
  label: string
  background: string
}

export interface BattleEnemyOption {
  id: BattleEnemyId
  label: string
  multiplier: number
  sprite: string
}

export const battleHeroes: BattleHeroOption[] = [
  {
    id: 'male',
    label: 'Male',
    sprite: withBasePath('/games/vocabulary/rpg-battle/hero_male_pose_sheet_3x3.png'),
  },
  {
    id: 'female',
    label: 'Female',
    sprite: withBasePath('/games/vocabulary/rpg-battle/hero_female_pose_sheet_3x3.png'),
  },
]

export const battleLocations: BattleLocationOption[] = [
  {
    id: 'forest-clearing',
    label: 'Forest Clearing',
    background: withBasePath('/games/vocabulary/rpg-battle/background_forest_clearing.png'),
  },
  {
    id: 'ruined-road',
    label: 'Ruined Road',
    background: withBasePath('/games/vocabulary/rpg-battle/background_ruined_road.png'),
  },
  {
    id: 'magic-arena',
    label: 'Magic Arena',
    background: withBasePath('/games/vocabulary/rpg-battle/background_magic_arena.png'),
  },
  {
    id: 'throne-hall',
    label: 'Throne Hall',
    background: withBasePath('/games/vocabulary/rpg-battle/background_throne_hall.png'),
  },
]

export const battleEnemies: BattleEnemyOption[] = [
  {
    id: 'slime',
    label: 'Slime',
    multiplier: 0.5,
    sprite: withBasePath('/games/vocabulary/rpg-battle/enemy_slime_pose_sheet_3x3.png'),
  },
  {
    id: 'goblin',
    label: 'Goblin',
    multiplier: 1,
    sprite: withBasePath('/games/vocabulary/rpg-battle/enemy_goblin_pose_sheet_3x3.png'),
  },
  {
    id: 'spectre',
    label: 'Spectre',
    multiplier: 1.5,
    sprite: withBasePath('/games/vocabulary/rpg-battle/enemy_spectre_pose_sheet_3x3.png'),
  },
  {
    id: 'elemental',
    label: 'Elemental',
    multiplier: 2,
    sprite: withBasePath('/games/vocabulary/rpg-battle/enemy_elemental_pose_sheet_3x3.png'),
  },
]
