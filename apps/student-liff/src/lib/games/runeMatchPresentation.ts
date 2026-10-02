import { fitText, type MeasureText } from "./textFit";

export type RuneLabelMetrics = {
  fontSize: number;
  lineHeight: number;
};

export type RuneLabelPresentation = RuneLabelMetrics & { text: string };

/**
 * Fits a rune's word (English or Thai) inside its stone: the font shrinks
 * until the label fits and lines only break between words, never inside one
 * ("forest" stays "forest", not "fores" or "fo/rest"). The label box matches
 * the Text node in RuneMatchGame (rune = cell - 4, box = rune - 8 wide and
 * 80% of the rune tall). Presentation only; matching keys are unaffected.
 */
export function fitRuneLabel(
  text: string,
  cellSize: number,
  textSizeMultiplier = 1,
  measure?: MeasureText,
): RuneLabelPresentation {
  const runeSize = cellSize - 4;
  const maximumSize = Math.min(24, cellSize * 0.34) * Math.max(1, textSizeMultiplier);
  const fit = fitText(text, {
    width: Math.max(8, runeSize - 14),
    height: Math.max(8, runeSize * 0.8 - 8),
    maxFontSize: Math.min(maximumSize, Math.min(24, cellSize * 0.4)),
    minFontSize: 10,
    lineHeight: 1.05,
    measure,
    fontFamily: "Sarabun, Arial",
    fontStyle: "bold",
  });
  return { text: fit.text, fontSize: fit.fontSize, lineHeight: fit.lineHeight };
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
