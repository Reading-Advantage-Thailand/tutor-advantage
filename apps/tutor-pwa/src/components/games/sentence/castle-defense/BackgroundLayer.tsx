"use client";

import { Group, Image as KonvaImage } from "react-konva";
import { useEffect, useState, useMemo } from "react";
import { getRoadTileInfo, TILE_SIZE } from "@/lib/games/castleDefense";
import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";

const ASSETS = {
  grass: [
    "/games/sentence/castle-defense/grass_A.png",
    "/games/sentence/castle-defense/grass_B.png",
    "/games/sentence/castle-defense/grass_C.png",
    "/games/sentence/castle-defense/grass_D.png",
  ],
  road: {
    EW: "/games/sentence/castle-defense/road_EW.png",
    NS: "/games/sentence/castle-defense/road_NS.png",
    CORNER: "/games/sentence/castle-defense/road_corner.png",
  },
};

interface BackgroundLayerProps {
  grassMap: number[][];
  path: { x: number; y: number }[];
}

export function BackgroundLayer({ grassMap, path }: BackgroundLayerProps) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>(() => {
    const cached: Record<string, HTMLImageElement> = {};
    [...ASSETS.grass, ASSETS.road.EW, ASSETS.road.NS, ASSETS.road.CORNER].forEach((src) => {
      const image = getCachedGameImage(src);
      if (image) cached[src] = image;
    });
    return cached;
  });
  const [loaded, setLoaded] = useState(
    [...ASSETS.grass, ASSETS.road.EW, ASSETS.road.NS, ASSETS.road.CORNER].every((src) =>
      Boolean(getCachedGameImage(src)),
    ),
  );

  useEffect(() => {
    const toLoad = [
      ...ASSETS.grass,
      ASSETS.road.EW,
      ASSETS.road.NS,
      ASSETS.road.CORNER,
    ];

    let mounted = true;

    Promise.allSettled(toLoad.map((src) => loadGameImage(src))).then((results) => {
      if (!mounted) return;
      const loadedImgs: Record<string, HTMLImageElement> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          loadedImgs[toLoad[index]] = result.value;
        }
      });
      setImages(loadedImgs);
      setLoaded(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const tiles = useMemo(() => {
    if (!loaded) return null;

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
  }, [loaded, images, grassMap, path]);

  if (!loaded) return <Group />;

  return <Group listening={false}>{tiles}</Group>;
}
