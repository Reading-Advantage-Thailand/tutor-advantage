"use client";

import { Group, Image as KonvaImage } from "react-konva";
import { useMemo } from "react";
import { getRoadTileInfo, TILE_SIZE } from "@/lib/games/castleDefense";
import { useGameImages } from "@/lib/games/useGameImages";

const ASSETS = {
  grass: [
    "/games/sentence/castle-defense/grass_A.webp",
    "/games/sentence/castle-defense/grass_B.webp",
    "/games/sentence/castle-defense/grass_C.webp",
    "/games/sentence/castle-defense/grass_D.webp",
  ],
  road: {
    EW: "/games/sentence/castle-defense/road_EW.webp",
    NS: "/games/sentence/castle-defense/road_NS.webp",
    CORNER: "/games/sentence/castle-defense/road_corner.webp",
  },
};

/** Map tiles, so the game can hold its clock until the map can be drawn. */
export const CASTLE_BACKGROUND_PATHS = [...ASSETS.grass, ASSETS.road.EW, ASSETS.road.NS, ASSETS.road.CORNER];
const TILE_IMAGES = Object.fromEntries(CASTLE_BACKGROUND_PATHS.map((src) => [src, src]));

interface BackgroundLayerProps {
  grassMap: number[][];
  path: { x: number; y: number }[];
}

export function BackgroundLayer({ grassMap, path }: BackgroundLayerProps) {
  // Each tile appears as it arrives, so a failed image only leaves its own squares empty.
  const { images } = useGameImages(TILE_IMAGES);

  const tiles = useMemo(() => {
    const grid: React.ReactNode[] = [];

    for (let r = 0; r < grassMap.length; r++) {
      for (let c = 0; c < grassMap[0].length; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        const grassIdx = grassMap[r][c];
        const grassSrc = ASSETS.grass[grassIdx];

        if (
          images[grassSrc] &&
          images[grassSrc].width > 0 &&
          images[grassSrc].height > 0
        ) {
          grid.push(
            <KonvaImage
              key={`grass-${r}-${c}`}
              image={images[grassSrc]}
              x={x}
              y={y}
              width={TILE_SIZE}
              height={TILE_SIZE}
            />,
          );
        }

        const roadInfo = getRoadTileInfo(c, r, path);
        if (roadInfo) {
          const roadSrc = ASSETS.road[roadInfo.type];
          if (
            images[roadSrc] &&
            images[roadSrc].width > 0 &&
            images[roadSrc].height > 0
          ) {
            const cx = x + TILE_SIZE / 2;
            const cy = y + TILE_SIZE / 2;

            grid.push(
              <KonvaImage
                key={`road-${r}-${c}`}
                image={images[roadSrc]}
                x={cx}
                y={cy}
                width={TILE_SIZE}
                height={TILE_SIZE}
                offsetX={TILE_SIZE / 2}
                offsetY={TILE_SIZE / 2}
                rotation={roadInfo.rotation}
              />,
            );
          }
        }
      }
    }
    return grid;
  }, [images, grassMap, path]);

  return <Group listening={false}>{tiles}</Group>;
}
