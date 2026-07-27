import { withBasePath } from "@/lib/games/basePath";

const imageCache = new Map<string, Promise<HTMLImageElement> | HTMLImageElement>();

const GAME_ASSET_PATHS: Record<string, string[]> = {
  "wizard-vs-zombie": [
    "/games/vocabulary/wizard-vs-zombie/player_3x3_pose_sheet.png",
    "/games/vocabulary/wizard-vs-zombie/zombie_3x3_pose_sheet.png",
    "/games/vocabulary/wizard-vs-zombie/orb_3x3_pose_sheet.png",
    "/games/vocabulary/wizard-vs-zombie/tile-ruins.png",
  ],
  "enchanted-library": [
    "/games/vocabulary/enchanted-library/player_3x3_pose_sheet.png",
    "/games/vocabulary/enchanted-library/spirit_3x3_pose_sheet.png",
    "/games/vocabulary/enchanted-library/book_3x1_sheet.png",
    "/games/vocabulary/enchanted-library/library_background.png",
  ],
  "castle-defense": [
    "/games/sentence/castle-defense/player_3x3_pose_sheet.png",
    "/games/sentence/castle-defense/goblin_3x3_pose_sheet.png",
    "/games/sentence/castle-defense/orc_3x3_pose_sheet.png",
    "/games/sentence/castle-defense/troll_3x3_pose_sheet.png",
    "/games/sentence/castle-defense/tower-base.png",
    "/games/sentence/castle-defense/tower-built.png",
    "/games/sentence/castle-defense/player-castle.png",
    "/games/sentence/castle-defense/grass_A.png",
    "/games/sentence/castle-defense/grass_B.png",
    "/games/sentence/castle-defense/grass_C.png",
    "/games/sentence/castle-defense/grass_D.png",
    "/games/sentence/castle-defense/road_EW.png",
    "/games/sentence/castle-defense/road_NS.png",
    "/games/sentence/castle-defense/road_corner.png",
  ],
};

export function loadGameImage(src: string): Promise<HTMLImageElement> {
  const resolvedSrc = withBasePath(src);
  const cached = imageCache.get(resolvedSrc);

  if (cached instanceof HTMLImageElement) {
    return Promise.resolve(cached);
  }

  if (cached) {
    return cached;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      imageCache.set(resolvedSrc, image);
      resolve(image);
    };
    image.onerror = reject;
    image.src = resolvedSrc;
  });

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
