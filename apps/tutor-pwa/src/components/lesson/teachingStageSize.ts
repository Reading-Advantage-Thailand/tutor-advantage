import React from "react";

/**
 * Height of a teaching game on the presenter outside fullscreen: the space left
 * above the dock, so the controls a demo needs to show are not cut off.
 * 18rem covers the lesson bar, phase progress, stage header and the dock.
 */
export const TEACHING_STAGE_HEIGHT = "h-[max(340px,calc(100dvh-18rem))]";

// Sizes in the games are drawn for a laptop. A back row needs text at about 3% of
// the screen's height, so a bigger stage draws everything bigger.
const BASE_STAGE_WIDTH = 960;
const BASE_STAGE_HEIGHT = 640;
const MAX_STAGE_SCALE = 2.2;

/** How much bigger than laptop size to draw on this stage. Never below 1, and a narrow stage stays at 1. */
export function stageScale(width: number, height: number): number {
  if (width <= 0 || height <= 0) return 1;
  const fit = Math.min(width / BASE_STAGE_WIDTH, height / BASE_STAGE_HEIGHT);
  return Math.round(Math.min(MAX_STAGE_SCALE, Math.max(1, fit)) * 100) / 100;
}

/** Gives the stage element its scale, kept up to date when the stage resizes (fullscreen, hiding the dock). */
export function useStageScale<T extends HTMLElement>() {
  const [node, setNode] = React.useState<T | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    if (!node) return;
    const measure = () => setScale(stageScale(node.clientWidth, node.clientHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { stageRef: setNode, scale };
}
