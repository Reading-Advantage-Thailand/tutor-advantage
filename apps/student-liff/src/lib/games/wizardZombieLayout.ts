import { orbCell, type Arena, type Orb } from "@/lib/games/wizardZombie";
import { fitText, type MeasureText } from "@/lib/games/textFit";

/**
 * Where a round of Wizard vs Zombie sits on the screen.
 *
 * The whole arena always fits the free area between the HUD and the controls.
 * Every answer can be read at once, and nothing walks under a thumb or under the
 * HUD. The arena takes the screen's shape but keeps about the same floor area,
 * so a walk across it takes about as long on any phone.
 */

export type ViewportSize = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Camera = { x: number; y: number; scale: number };
export type ControlSizes = { stick: number; safeBottom?: number };

/** Space for the HUD row and the word to find, at the top of a tall screen. */
export const PORTRAIT_TOP_BAND = 112;
const STICK_BOTTOM_GAP = 12;
const SIDE_COLUMN_EXTRA = 28;
const LANDSCAPE_GAP = 8;

const TARGET_FLOOR_AREA = 262_000;
const MIN_ARENA_SCALE = 0.62;
const MAX_ARENA_SCALE = 1.5;
const MIN_ARENA_SIDE = 340;
const MAX_ARENA_SIDE = 900;

export const isPortraitViewport = (viewport: ViewportSize) => viewport.height >= viewport.width;

/** The part of the screen free of HUD and controls. */
export function computePlayRect(viewport: ViewportSize, { stick, safeBottom = 0 }: ControlSizes): Rect {
  if (isPortraitViewport(viewport)) {
    const y = PORTRAIT_TOP_BAND;
    return {
      x: 0,
      y,
      width: viewport.width,
      height: Math.max(1, viewport.height - y - stick - STICK_BOTTOM_GAP * 2 - safeBottom),
    };
  }
  // A wide screen keeps the HUD and the controls in columns either side of the arena.
  const side = stick + SIDE_COLUMN_EXTRA;
  return {
    x: side,
    y: LANDSCAPE_GAP,
    width: Math.max(1, viewport.width - side * 2),
    height: Math.max(1, viewport.height - LANDSCAPE_GAP * 2 - safeBottom),
  };
}

/** Picks the arena for a round. It stays the same for the whole round. */
export function chooseArena(viewport: ViewportSize, controls: ControlSizes): Arena {
  const rect = computePlayRect(viewport, controls);
  const idealScale = Math.sqrt((rect.width * rect.height) / TARGET_FLOOR_AREA);
  const scale = Math.max(MIN_ARENA_SCALE, Math.min(MAX_ARENA_SCALE, idealScale));
  const clampSide = (side: number) => Math.round(Math.max(MIN_ARENA_SIDE, Math.min(MAX_ARENA_SIDE, side)));
  return { width: clampSide(rect.width / scale), height: clampSide(rect.height / scale) };
}

/** Fits and centres the arena in the free area, whatever the phone did since the round began. */
export function fitCamera(arena: Arena, rect: Rect): Camera {
  const scale = Math.min(rect.width / arena.width, rect.height / arena.height);
  return {
    scale,
    x: rect.x + (rect.width - arena.width * scale) / 2,
    y: rect.y + (rect.height - arena.height * scale) / 2,
  };
}

export const worldToScreen = (camera: Camera, point: { x: number; y: number }) => ({
  x: point.x * camera.scale + camera.x,
  y: point.y * camera.scale + camera.y,
});

export type OrbLabel = {
  text: string;
  fontSize: number;
  lineHeight: number;
  /** Pill size in screen pixels. */
  width: number;
  height: number;
  /** Pill's top-left corner, in screen pixels from the orb's centre. */
  offsetX: number;
  offsetY: number;
};

export const ORB_LABEL_FONT = "Sarabun, Arial";
const LABEL_MAX_FONT = 16;
const LABEL_MIN_FONT = 11;
const LABEL_PADDING_X = 8;
const LABEL_PADDING_Y = 4;
const LABEL_GAP = 3;
const CELL_INSET = 3;

let labelCanvas: CanvasRenderingContext2D | null | undefined;
const measureWithCanvas: MeasureText = (text, fontSize) => {
  if (labelCanvas === undefined) {
    labelCanvas = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  if (!labelCanvas) return text.length * fontSize * 0.6;
  labelCanvas.font = `bold ${fontSize}px ${ORB_LABEL_FONT}`;
  return labelCanvas.measureText(text).width;
};

/**
 * Fits an orb's meaning under or over the orb, wrapped at Thai word boundaries,
 * and keeps it inside the orb's part of the arena. Sizes are in screen pixels so
 * the text stays readable however far the arena is scaled down.
 */
export function layoutOrbLabel(
  orb: Pick<Orb, "x" | "y" | "radius" | "translation">,
  arena: Arena,
  scale: number,
  measure: MeasureText = measureWithCanvas,
): OrbLabel {
  const cell = orbCell(arena, orb);
  const orbRadius = orb.radius * scale;
  const inCellY = (orb.y - cell.y) * scale;
  const cellHeight = cell.height * scale;
  const below = cellHeight - inCellY - orbRadius - LABEL_GAP - CELL_INSET;
  const above = inCellY - orbRadius - LABEL_GAP - CELL_INSET;
  const maxWidth = Math.max(40, cell.width * scale - CELL_INSET * 2);
  const maxHeight = Math.max(20, Math.max(below, above));

  const fit = fitText(orb.translation, {
    width: maxWidth - LABEL_PADDING_X * 2,
    height: maxHeight - LABEL_PADDING_Y * 2,
    maxFontSize: LABEL_MAX_FONT,
    minFontSize: LABEL_MIN_FONT,
    lineHeight: 1.2,
    measure,
  });

  const textWidth = fit.lines.reduce((widest, line) => Math.max(widest, measure(line, fit.fontSize)), 0);
  const width = Math.min(maxWidth, Math.ceil(textWidth) + LABEL_PADDING_X * 2);
  const height = Math.ceil(fit.lines.length * fit.fontSize * fit.lineHeight) + LABEL_PADDING_Y * 2;

  const leftLimit = (cell.x - orb.x) * scale + CELL_INSET;
  const rightLimit = (cell.x + cell.width - orb.x) * scale - CELL_INSET - width;
  const offsetX = Math.max(leftLimit, Math.min(rightLimit, -width / 2));
  const goesBelow = height <= below || below >= above;
  const offsetY = goesBelow ? orbRadius + LABEL_GAP : -orbRadius - LABEL_GAP - height;

  return { text: fit.text, fontSize: fit.fontSize, lineHeight: fit.lineHeight, width, height, offsetX, offsetY };
}
