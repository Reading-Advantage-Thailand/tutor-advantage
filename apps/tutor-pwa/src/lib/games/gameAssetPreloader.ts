import { withBasePath } from "@/lib/games/basePath";

const imageCache = new Map<string, Promise<HTMLImageElement> | HTMLImageElement>();

// Phones in class drop the odd request, so one failure must not end the game.
const IMAGE_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [700, 2_000];

const GAME_ASSET_PATHS: Record<string, string[]> = {
  "dragon-flight": [
    "/games/vocabulary/dragon-flight/gates-3x3-sheet-facing-up.webp",
    "/games/vocabulary/dragon-flight/player-3x3-sheet-facing-down.webp",
    "/games/vocabulary/dragon-flight/dragon-army-3x3-sheet-facing-up.webp",
    "/games/vocabulary/dragon-flight/boss-3x3-sheet-facing-up.webp",
    "/games/vocabulary/dragon-flight/parallax-top-tiling.webp",
    "/games/vocabulary/dragon-flight/parallax-middle-tiling.webp",
    "/games/vocabulary/dragon-flight/parallax-bottom-tiling.webp",
    "/games/vocabulary/dragon-flight/loading-screen-background.webp",
  ],
  "wizard-vs-zombie": [
    "/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.webp",
    "/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.webp",
    "/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.webp",
    "/games/vocabulary/wizard-vs-zombie/tile-ruins.webp",
  ],
  "enchanted-library": [
    "/games/vocabulary/enchanted-library/player_3x3_pose_sheet.webp",
    "/games/vocabulary/enchanted-library/spirit_3x3_pose_sheet.webp",
    "/games/vocabulary/enchanted-library/book_3x1_sheet.webp",
    "/games/vocabulary/enchanted-library/library_background.webp",
  ],
  "rune-match": [
    "/games/vocabulary/rune-match/monsters/goblin_3x4_pose_sheet.webp",
    "/games/vocabulary/rune-match/runes/rune_base_3x2_pose_sheet.webp",
    "/games/vocabulary/rune-match/ui/background-tiled.webp",
  ],
  "castle-defense": [
    "/games/sentence/castle-defense/player_3x3_pose_sheet.webp",
    "/games/sentence/castle-defense/goblin_3x3_pose_sheet.webp",
    "/games/sentence/castle-defense/orc_3x3_pose_sheet.webp",
    "/games/sentence/castle-defense/troll_3x3_pose_sheet.webp",
    "/games/sentence/castle-defense/tower-base.webp",
    "/games/sentence/castle-defense/tower-built.webp",
    "/games/sentence/castle-defense/player-castle.webp",
    "/games/sentence/castle-defense/grass_A.webp",
    "/games/sentence/castle-defense/grass_B.webp",
    "/games/sentence/castle-defense/grass_C.webp",
    "/games/sentence/castle-defense/grass_D.webp",
    "/games/sentence/castle-defense/road_EW.webp",
    "/games/sentence/castle-defense/road_NS.webp",
    "/games/sentence/castle-defense/road_corner.webp",
  ],
  "potion-rush": [
    "/games/sentence/potion-rush/shop-wall.webp",
    "/games/sentence/potion-rush/shop-floor.webp",
    "/games/sentence/potion-rush/shop-counter.webp",
    "/games/sentence/potion-rush/character-sheet-adjusted.webp",
    "/games/sentence/potion-rush/character-sheet-2-adjusted.webp",
    "/games/sentence/potion-rush/cauldron-blue.webp",
    "/games/sentence/potion-rush/cauldron-green.webp",
    "/games/sentence/potion-rush/cauldron-yellow.webp",
    "/games/sentence/potion-rush/herb.webp",
    "/games/sentence/potion-rush/mineral.webp",
    "/games/sentence/potion-rush/mushroom.webp",
    "/games/sentence/potion-rush/potion.webp",
  ],
};

function requestImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error(`Timed out loading ${src}`));
    }, IMAGE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Failed to load ${src}`));
    };
    image.src = src;
  });
}

async function requestImageWithRetry(src: string): Promise<HTMLImageElement> {
  for (const delayMs of RETRY_DELAYS_MS) {
    try {
      return await requestImage(src);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return requestImage(src);
}

export function loadGameImage(src: string): Promise<HTMLImageElement> {
  const resolvedSrc = withBasePath(src);
  const cached = imageCache.get(resolvedSrc);

  if (cached instanceof HTMLImageElement) {
    return Promise.resolve(cached);
  }

  if (cached) {
    return cached;
  }

  const promise = requestImageWithRetry(resolvedSrc).then(
    (image) => {
      imageCache.set(resolvedSrc, image);
      return image;
    },
    (error) => {
      // Forget the failure so the game's retry button really tries again.
      imageCache.delete(resolvedSrc);
      throw error;
    },
  );

  imageCache.set(resolvedSrc, promise);
  return promise;
}

export function getCachedGameImage(src: string): HTMLImageElement | null {
  const cached = imageCache.get(withBasePath(src));
  return cached instanceof HTMLImageElement ? cached : null;
}

export function preloadGameAssets(gameId?: string | null) {
  const paths = gameId ? GAME_ASSET_PATHS[gameId] : null;
  if (!paths) return Promise.resolve([]);
  return Promise.allSettled(paths.map((path) => loadGameImage(path)));
}

export function getGameAssetPaths(gameId: string): readonly string[] {
  return GAME_ASSET_PATHS[gameId] ?? [];
}
