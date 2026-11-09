"use client";

import { useEffect, useState } from "react";

import { getCachedGameImage, loadGameImage } from "@/lib/games/gameAssetPreloader";

/**
 * Loads a fixed set of game images and hands each one over as soon as it
 * arrives. `settled` turns true once every image loaded or finally failed.
 * Pass a module-level object: a new object restarts the loading.
 */
export function useGameImages(paths: Record<string, string>) {
  const [images, setImages] = useState<Record<string, HTMLImageElement>>(() => {
    const cached: Record<string, HTMLImageElement> = {};
    Object.entries(paths).forEach(([key, src]) => {
      const image = getCachedGameImage(src);
      if (image) cached[key] = image;
    });
    return cached;
  });
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let mounted = true;
    const entries = Object.entries(paths);
    void Promise.allSettled(
      entries.map(([key, src]) =>
        loadGameImage(src).then((image) => {
          if (mounted) setImages((current) => ({ ...current, [key]: image }));
        }),
      ),
    ).then((results) => {
      if (!mounted) return;
      results.forEach((result, index) => {
        if (result.status === "rejected") console.error(`Failed to load ${entries[index][1]}`);
      });
      setSettled(true);
    });
    return () => {
      mounted = false;
    };
  }, [paths]);

  return { images, settled };
}
