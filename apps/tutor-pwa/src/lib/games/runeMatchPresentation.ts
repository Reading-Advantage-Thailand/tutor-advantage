import { fitText, splitWords, type MeasureText } from "./textFit";
import { RUNE_MATCH_CONFIG } from "./runeMatchConfig";

export type RuneLabelMetrics = {
  fontSize: number;
  lineHeight: number;
};

export type RuneLabelPresentation = RuneLabelMetrics & { text: string };

/** The smallest a word may be drawn on a tile. Below this a Thai tone mark cannot be read. */
export const RUNE_LABEL_MIN_FONT = 11;

const LABEL_FONT = { fontFamily: "Sarabun, Arial", fontStyle: "bold" } as const;
const LABEL_LINE_HEIGHT = 1.12;

const VOWEL = /[aeiouy]/i;
// A Thai line must not start with one of these marks, or end on a leading vowel.
const THAI_FOLLOWS_BASE = /^[ะัาำิ-ฺๅ็-๎]/;
const THAI_LEADS_BASE = /[เ-ไ]$/;

/** Where a too-long English word reads best when cut: after a vowel, before a consonant. */
function latinCutPoint(word: string, longestFit: number): number {
  const lowest = Math.max(2, Math.ceil(longestFit * 0.55));
  for (let cut = Math.min(longestFit, word.length - 2); cut >= lowest; cut--) {
    if (VOWEL.test(word[cut - 1]) && !VOWEL.test(word[cut])) return cut;
    if (word[cut - 1].toLowerCase() === word[cut].toLowerCase()) return cut;
  }
  return Math.max(2, Math.min(longestFit, word.length - 2));
}

function thaiCutPoint(word: string, longestFit: number): number {
  for (let cut = Math.min(longestFit, word.length - 1); cut > 0; cut--) {
    if (!THAI_FOLLOWS_BASE.test(word.slice(cut)) && !THAI_LEADS_BASE.test(word.slice(0, cut))) return cut;
  }
  return Math.max(1, longestFit);
}

/**
 * Cuts one word that cannot fit the tile even at the smallest size. Latin pieces
 * get a hyphen; Thai has no such mark and is cut between letters.
 */
function cutLongWord(word: string, width: number, fontSize: number, measure: MeasureText): string[] {
  const isLatin = /^[ -~]+$/.test(word);
  const hyphen = isLatin ? "-" : "";
  const pieces: string[] = [];
  let rest = word;
  while (measure(rest, fontSize) > width && rest.length > 3) {
    let longestFit = rest.length - 1;
    while (longestFit > 1 && measure(rest.slice(0, longestFit) + hyphen, fontSize) > width) longestFit--;
    const cut = isLatin ? latinCutPoint(rest, longestFit) : thaiCutPoint(rest, longestFit);
    pieces.push(rest.slice(0, cut) + hyphen);
    rest = rest.slice(cut);
  }
  pieces.push(rest);
  return pieces;
}

type LabelPiece = { text: string; spaceAfter: boolean; mustBreakAfter: boolean };

function wrapPieces(pieces: LabelPiece[], width: number, fontSize: number, measure: MeasureText): string[] | null {
  const lines: string[] = [];
  let line = "";
  let breakNext = false;
  for (const piece of pieces) {
    if (measure(piece.text, fontSize) > width) return null;
    const candidate = line + piece.text;
    if (line && (breakNext || measure(candidate, fontSize) > width)) {
      lines.push(line.trimEnd());
      line = piece.text;
    } else {
      line = candidate;
    }
    if (piece.spaceAfter) line += " ";
    breakNext = piece.mustBreakAfter;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/**
 * Fits a rune's word (English or Thai) inside its stone. The font shrinks to a
 * real floor and lines break between words. A word that still cannot fit at the
 * floor is cut ("impercep-" / "tible") rather than drawn too small to read. The
 * label box matches the Text node in the board (rune = cell - 4, box = rune - 8
 * wide and 80% of the rune tall). Presentation only; matching keys are unaffected.
 */
export function fitRuneLabel(
  text: string,
  cellSize: number,
  textSizeMultiplier = 1,
  measure?: MeasureText,
): RuneLabelPresentation {
  const runeSize = cellSize - 4;
  const width = Math.max(8, runeSize - 9);
  const height = Math.max(8, runeSize * 0.8 - 4);
  const options = {
    width,
    height,
    maxFontSize: Math.min(36, cellSize * 0.23 * Math.max(1, textSizeMultiplier)),
    minFontSize: RUNE_LABEL_MIN_FONT,
    lineHeight: LABEL_LINE_HEIGHT,
    measure,
    ...LABEL_FONT,
  };
  const fit = fitText(text, options);
  if (fit.fontSize >= RUNE_LABEL_MIN_FONT) {
    return { text: fit.text, fontSize: fit.fontSize, lineHeight: fit.lineHeight };
  }

  const measureAt = measure ?? measureWithCanvas;
  const pieces: LabelPiece[] = splitWords(text).flatMap((token) => {
    const word = token.trimEnd();
    if (measureAt(word, RUNE_LABEL_MIN_FONT) <= width) {
      return [{ text: word, spaceAfter: word !== token, mustBreakAfter: false }];
    }
    const cuts = cutLongWord(word, width, RUNE_LABEL_MIN_FONT, measureAt);
    return cuts.map((cut, index) => ({
      text: cut,
      spaceAfter: index === cuts.length - 1 && word !== token,
      mustBreakAfter: cut.endsWith("-") && index < cuts.length - 1,
    }));
  });
  for (let fontSize = Math.floor(options.maxFontSize); fontSize >= RUNE_LABEL_MIN_FONT; fontSize--) {
    const lines = wrapPieces(pieces, width, fontSize, measureAt);
    if (lines && lines.length * fontSize * LABEL_LINE_HEIGHT <= height) {
      return { text: lines.join("\n"), fontSize, lineHeight: LABEL_LINE_HEIGHT };
    }
  }

  // A whole phrase on one tile: keep the floor and end with "…". Tapping the tile
  // shows all of it in the message line above the board.
  const lines = wrapPieces(pieces, width, RUNE_LABEL_MIN_FONT, measureAt) ?? pieces.map((piece) => piece.text);
  const kept = lines.slice(0, Math.max(1, Math.floor(height / (RUNE_LABEL_MIN_FONT * LABEL_LINE_HEIGHT))));
  let last = kept[kept.length - 1];
  while (last.length > 1 && measureAt(`${last}…`, RUNE_LABEL_MIN_FONT) > width) last = last.slice(0, -1);
  kept[kept.length - 1] = `${last}…`;
  return { text: kept.join("\n"), fontSize: RUNE_LABEL_MIN_FONT, lineHeight: LABEL_LINE_HEIGHT };
}

let labelCanvas: CanvasRenderingContext2D | null | undefined;
function measureWithCanvas(text: string, fontSize: number): number {
  if (labelCanvas === undefined) {
    labelCanvas = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  }
  if (!labelCanvas) return Array.from(text).length * fontSize * 0.6;
  labelCanvas.font = `${LABEL_FONT.fontStyle} ${fontSize}px ${LABEL_FONT.fontFamily}`;
  return labelCanvas.measureText(text).width;
}

export function getTimePresentation(currentMs: number, maxMs: number) {
  const seconds = Math.max(0, Math.ceil(currentMs / 1000));
  const ratio = maxMs > 0 ? currentMs / maxMs : 0;

  if (ratio <= 0.2) {
    return { seconds, color: "#ef4444", background: "#450a0a", urgent: true };
  }
  if (ratio <= 0.4) {
    return { seconds, color: "#fbbf24", background: "#422006", urgent: false };
  }
  return { seconds, color: "#34d399", background: "#052e2b", urgent: false };
}

// --- Layout ------------------------------------------------------------------

export type Box = { x: number; y: number; width: number; height: number };

export type RuneMatchLayout = {
  cellSize: number;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  /** Landscape draws the board on its side: 6 across, 4 down. Rules and adjacency do not change. */
  transposed: boolean;
  /** Portrait: status panel above the board. Landscape: sidebar beside it. */
  isMobile: boolean;
  /** Short screen: everything around the board is squeezed so the tiles stay big. */
  compact: boolean;
  sidebarWidth: number;
  panel: Box;
  goblin: Box;
  hpBar: Box;
  /** Portrait only: the two cards beside the goblin. */
  statCards: { left: Box; right: Box } | null;
  /** Landscape only: the time bar and the pair count under it. */
  timeBar: Box | null;
  matchesY: number;
  comboY: number | null;
  /** The line that states the rule and answers every tap. */
  strip: Box;
  skills: Box;
};

const STAT_INLINE_HEIGHT = 26;
/** The tutorial step card sits over the foot of the stage. */
const TUTORIAL_CARD_SPACE = 124;
/** One cell of the goblin sheet is a little wider than it is tall. */
const GOBLIN_ASPECT = 1.127;

function portraitLayout(width: number, height: number, bottomOffset: number): RuneMatchLayout {
  const { columns, rows } = RUNE_MATCH_CONFIG.grid;
  const sideGutter = 10;
  const widestCell = (width - sideGutter * 2) / columns;

  const tallTop = 168;
  const tallSkills = 52;
  const tallBottom = height - bottomOffset - tallSkills - 8 - 10;
  const compactTop = 106;
  const compactSkills = 44;
  const compactBottom = height - bottomOffset - compactSkills - 6 - 8;
  const tallCell = Math.min(widestCell, (tallBottom - tallTop) / rows);
  const compactCell = Math.min(widestCell, (compactBottom - compactTop) / rows);
  const compact = tallCell < compactCell && tallCell < 100;

  const cellSize = compact ? compactCell : tallCell;
  const top = compact ? compactTop : tallTop;
  const bottom = compact ? compactBottom : tallBottom;
  const gridWidth = cellSize * columns;
  const gridHeight = cellSize * rows;
  const gridX = (width - gridWidth) / 2;
  const gridY = top + Math.max(0, (bottom - top - gridHeight) / 2);

  const skillsHeight = compact ? compactSkills : tallSkills;
  const skills: Box = {
    x: sideGutter,
    y: height - bottomOffset - skillsHeight - (compact ? 6 : 8),
    width: width - sideGutter * 2,
    height: skillsHeight,
  };

  if (compact) {
    const barX = 68;
    const barWidth = width - barX - 12;
    const cardWidth = (barWidth - 6) / 2;
    return {
      cellSize, gridX, gridY, gridWidth, gridHeight,
      transposed: false, isMobile: true, compact, sidebarWidth: 0,
      panel: { x: 6, y: 4, width: width - 12, height: 56 },
      goblin: { x: 10, y: 8, width: 54, height: 48 },
      hpBar: { x: barX, y: 8, width: barWidth, height: 18 },
      statCards: {
        left: { x: barX, y: 30, width: cardWidth, height: STAT_INLINE_HEIGHT },
        right: { x: barX + cardWidth + 6, y: 30, width: cardWidth, height: STAT_INLINE_HEIGHT },
      },
      timeBar: null, matchesY: 0, comboY: null,
      strip: { x: 6, y: 62, width: width - 12, height: 38 },
      skills,
    };
  }

  const barX = 110;
  const barWidth = width - barX - 16;
  const cardWidth = (barWidth - 6) / 2;
  return {
    cellSize, gridX, gridY, gridWidth, gridHeight,
    transposed: false, isMobile: true, compact, sidebarWidth: 0,
    panel: { x: 8, y: 6, width: width - 16, height: 92 },
    goblin: { x: 14, y: 12, width: 90, height: 80 },
    hpBar: { x: barX, y: 14, width: barWidth, height: 20 },
    statCards: {
      left: { x: barX, y: 42, width: cardWidth, height: 46 },
      right: { x: barX + cardWidth + 6, y: 42, width: cardWidth, height: 46 },
    },
    timeBar: null, matchesY: 0, comboY: null,
    strip: { x: 8, y: 102, width: width - 16, height: 56 },
    skills,
  };
}

function landscapeLayout(width: number, height: number, bottomOffset: number, hasBanner: boolean): RuneMatchLayout {
  const { columns, rows } = RUNE_MATCH_CONFIG.grid;
  const padding = 12;
  const sidebarWidth = Math.min(220, width * 0.27);
  const areaWidth = width - sidebarWidth - padding * 2;
  const areaHeight = height - bottomOffset - padding * 2;
  // On its side: logical rows run across the screen, logical columns run down it.
  const cellSize = Math.min(areaWidth / rows, areaHeight / columns);
  const gridWidth = cellSize * rows;
  const gridHeight = cellSize * columns;
  const gridX = sidebarWidth + padding + (areaWidth - gridWidth) / 2;
  const gridY = padding + (areaHeight - gridHeight) / 2;
  const inner = sidebarWidth - 20;
  const panel: Box = { x: 0, y: 0, width: sidebarWidth, height };
  const base = {
    cellSize, gridX, gridY, gridWidth, gridHeight,
    transposed: true, isMobile: false, sidebarWidth, panel, statCards: null,
  };

  if (height < 480) {
    // The sidebar is narrow, so the tutor's demo banner wraps to four lines.
    const bannerSpace = hasBanner ? 100 : 0;
    const skills: Box = { x: 10, y: height - 50 - bannerSpace, width: inner, height: 44 };
    // The message needs about 70px; the goblin may have what is left.
    const goblinHeight = 44 + Math.max(0, Math.min(32, skills.y - 116 - 6 - 70));
    const goblinWidth = goblinHeight * GOBLIN_ASPECT;
    const barsY = goblinHeight + 6;
    const stripY = barsY + 66;
    return {
      ...base,
      compact: true,
      goblin: { x: (sidebarWidth - goblinWidth) / 2, y: 4, width: goblinWidth, height: goblinHeight },
      hpBar: { x: 10, y: barsY, width: inner, height: 20 },
      timeBar: { x: 10, y: barsY + 23, width: inner, height: 20 },
      matchesY: barsY + 46,
      comboY: null,
      strip: { x: 10, y: stripY, width: inner, height: Math.max(36, skills.y - stripY - 6) },
      skills,
    };
  }

  return {
    ...base,
    compact: false,
    goblin: { x: (sidebarWidth - 90) / 2, y: 20, width: 90, height: 80 },
    hpBar: { x: 10, y: 110, width: inner, height: 20 },
    strip: { x: 10, y: 138, width: inner, height: 64 },
    timeBar: { x: 10, y: 210, width: inner, height: 20 },
    matchesY: 238,
    comboY: 260,
    skills: { x: 10, y: 290, width: inner, height: 52 },
  };
}

export function computeRuneMatchLayout(
  width: number,
  height: number,
  { tutorialMode = false, hasStatusBanner = false }: { tutorialMode?: boolean; hasStatusBanner?: boolean } = {},
): RuneMatchLayout {
  if (width > height) return landscapeLayout(width, height, tutorialMode ? TUTORIAL_CARD_SPACE : 0, hasStatusBanner);
  return portraitLayout(width, height, tutorialMode ? TUTORIAL_CARD_SPACE : hasStatusBanner ? 72 : 0);
}

/** Top-left corner of a cell on screen. */
export function cellPosition(layout: RuneMatchLayout, row: number, col: number) {
  const across = layout.transposed ? row : col;
  const down = layout.transposed ? col : row;
  return { x: layout.gridX + across * layout.cellSize, y: layout.gridY + down * layout.cellSize };
}

/** Keeps a label of `boxWidth` wholly on screen, however near the edge its tile is. */
export function clampLabelCenter(centerX: number, boxWidth: number, stageWidth: number, margin = 4) {
  const half = boxWidth / 2;
  if (stageWidth <= boxWidth + margin * 2) return stageWidth / 2;
  return Math.min(stageWidth - half - margin, Math.max(half + margin, centerX));
}
