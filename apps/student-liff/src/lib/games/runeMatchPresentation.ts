export type RuneLabelMetrics = {
  fontSize: number;
  lineHeight: number;
};

export function formatRuneLabel(text: string): string {
  const characters = Array.from(text.trim());
  if (characters.length <= 6 || text.includes(" ")) return text;

  const lineCount = characters.length > 14 ? 3 : 2;
  const chunkSize = Math.ceil(characters.length / lineCount);
  const lines: string[] = [];
  for (let index = 0; index < characters.length; index += chunkSize) {
    lines.push(characters.slice(index, index + chunkSize).join(""));
  }
  return lines.join("\n");
}

/**
 * Keeps bilingual rune labels legible without letting long Thai translations
 * spill outside the stone. This is presentation-only and does not affect the
 * matching key or any game rules.
 */
export function getRuneLabelMetrics(
  text: string,
  cellSize: number,
  textSizeMultiplier = 1,
): RuneLabelMetrics {
  const characterCount = Array.from(text.trim()).length;
  const sizeRatio =
    characterCount <= 6
      ? 0.31
      : characterCount <= 10
        ? 0.27
        : characterCount <= 16
          ? 0.23
          : 0.2;
  const naturalSize = cellSize * sizeRatio * textSizeMultiplier;
  const maximumSize = Math.min(24, cellSize * 0.34);

  return {
    fontSize: Math.round(Math.max(12, Math.min(maximumSize, naturalSize))),
    lineHeight: characterCount > 10 ? 1.05 : 1.1,
  };
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
