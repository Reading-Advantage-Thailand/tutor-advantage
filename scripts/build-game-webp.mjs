#!/usr/bin/env node
// Re-encodes the images of the live lesson games to WebP, next to their PNG
// sources, in both apps (student-liff and tutor-pwa carry the same art).
//
//   node scripts/build-game-webp.mjs
//
// The games load the .webp files. Keep the PNGs as the editable source and
// re-run this script after changing one. Sizes are about what a phone at DPR 3
// or a 1080p tutor screen actually draws, so going lower starts to look soft.
//
// Before resizing a sheet, check how its game scales it. Frame sizes come from
// the loaded image, but Dragon Flight clamps its player, boss and army scale
// against the frame width, so those three keep their source width.
import { existsSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["apps/student-liff", "apps/tutor-pwa"];

const SPRITE = { quality: 80, alphaQuality: 90 };
const BACKDROP = { quality: 72, alphaQuality: 85 };

// path under public/games -> { width (max, omitted keeps the source width), ...encoding }
const MANIFEST = {
  "vocabulary/dragon-flight/gates-3x3-sheet-facing-up.png": { width: 810, ...SPRITE },
  "vocabulary/dragon-flight/boss-3x3-sheet-facing-up.png": SPRITE,
  "vocabulary/dragon-flight/dragon-army-3x3-sheet-facing-up.png": SPRITE,
  "vocabulary/dragon-flight/player-3x3-sheet-facing-down.png": SPRITE,
  "vocabulary/dragon-flight/parallax-top-tiling.png": BACKDROP,
  "vocabulary/dragon-flight/parallax-middle-tiling.png": BACKDROP,
  "vocabulary/dragon-flight/parallax-bottom-tiling.png": BACKDROP,
  "vocabulary/dragon-flight/loading-screen-background.png": { quality: 60 },

  "vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.png": { width: 810, ...SPRITE },
  "vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.png": { width: 620, ...SPRITE },
  "vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.png": SPRITE,
  "vocabulary/wizard-vs-zombie/tile-ruins.png": BACKDROP,

  "vocabulary/enchanted-library/player_3x3_pose_sheet.png": SPRITE,
  "vocabulary/enchanted-library/spirit_3x3_pose_sheet.png": SPRITE,
  "vocabulary/enchanted-library/book_3x1_sheet.png": { width: 670, ...SPRITE },
  "vocabulary/enchanted-library/library_background.png": BACKDROP,

  "vocabulary/rune-match/monsters/goblin_3x4_pose_sheet.png": SPRITE,
  "vocabulary/rune-match/runes/rune_base_3x2_pose_sheet.png": { width: 600, ...SPRITE },
  "vocabulary/rune-match/ui/background-tiled.png": BACKDROP,

  "sentence/castle-defense/player_3x3_pose_sheet.png": { width: 810, ...SPRITE },
  "sentence/castle-defense/goblin_3x3_pose_sheet.png": SPRITE,
  "sentence/castle-defense/orc_3x3_pose_sheet.png": SPRITE,
  "sentence/castle-defense/troll_3x3_pose_sheet.png": SPRITE,
  "sentence/castle-defense/tower-base.png": { width: 256, ...SPRITE },
  "sentence/castle-defense/tower-built.png": { width: 300, ...SPRITE },
  "sentence/castle-defense/player-castle.png": { width: 360, ...SPRITE },
  "sentence/castle-defense/grass_A.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/grass_B.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/grass_C.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/grass_D.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/road_EW.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/road_NS.png": { width: 256, ...BACKDROP },
  "sentence/castle-defense/road_corner.png": { width: 256, ...BACKDROP },

  "sentence/potion-rush/shop-wall.png": BACKDROP,
  "sentence/potion-rush/shop-floor.png": BACKDROP,
  "sentence/potion-rush/shop-counter.png": BACKDROP,
  "sentence/potion-rush/character-sheet-adjusted.png": SPRITE,
  "sentence/potion-rush/character-sheet-2-adjusted.png": SPRITE,
  "sentence/potion-rush/cauldron-blue.png": SPRITE,
  "sentence/potion-rush/cauldron-green.png": SPRITE,
  "sentence/potion-rush/cauldron-yellow.png": SPRITE,
  "sentence/potion-rush/herb.png": SPRITE,
  "sentence/potion-rush/mineral.png": SPRITE,
  "sentence/potion-rush/mushroom.png": SPRITE,
  "sentence/potion-rush/potion.png": SPRITE,
};

let before = 0;
let after = 0;
for (const [file, { width, ...encoding }] of Object.entries(MANIFEST)) {
  const source = path.join(ROOT, APPS[0], "public/games", file);
  if (!existsSync(source)) throw new Error(`Missing source image: ${source}`);
  const image = sharp(source);
  if (width) image.resize({ width, withoutEnlargement: true });
  const data = await image.webp({ effort: 6, ...encoding }).toBuffer();
  before += statSync(source).size;
  after += data.length;
  for (const app of APPS) {
    await writeFile(path.join(ROOT, app, "public/games", file.replace(/\.png$/, ".webp")), data);
  }
}
console.log(`${Object.keys(MANIFEST).length} images: ${(before / 1e6).toFixed(2)} MB of PNG became ${(after / 1e6).toFixed(2)} MB of WebP, in each app`);
