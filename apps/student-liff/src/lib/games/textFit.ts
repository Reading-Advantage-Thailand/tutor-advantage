// Fit a label inside a box (rune tile, word orb, card) by shrinking the font
// and wrapping only at word boundaries, never in the middle of a word.
// Shared by apps/student-liff and apps/tutor-pwa (keep identical).
//
// Thai has no spaces between words, so break opportunities come from
// Intl.Segmenter (word granularity) when available; a single token that cannot
// fit even at the minimum size is kept whole and the font shrinks further
// rather than splitting it.

export type MeasureText = (text: string, fontSize: number) => number

export type FitTextOptions = {
  /** Box size in px. */
  width: number
  height: number
  maxFontSize: number
  minFontSize: number
  lineHeight?: number
  /** Width of `text` at `fontSize`; defaults to a canvas measurement (browser) or an estimate. */
  measure?: MeasureText
  fontFamily?: string
  fontStyle?: string
}

export type FitTextResult = {
  /** Lines joined with "\n", ready for Konva's Text with wrap="none". */
  text: string
  lines: string[]
  fontSize: number
  lineHeight: number
}

type Segmenter = { segment: (input: string) => Iterable<{ segment: string }> }
let wordSegmenter: Segmenter | null | undefined

/** Split into wrap units: words (Thai via Intl.Segmenter) with their trailing spaces. */
export function splitWords(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return []
  if (wordSegmenter === undefined) {
    const Ctor = (Intl as unknown as { Segmenter?: new (locale: string, options: { granularity: string }) => Segmenter }).Segmenter
    wordSegmenter = Ctor ? new Ctor("th", { granularity: "word" }) : null
  }
  const pieces = wordSegmenter ? Array.from(wordSegmenter.segment(clean), (s) => s.segment) : clean.split(/(?<= )/)
  // Glue spaces and punctuation onto the previous token, and keep Latin words
  // (incl. apostrophes / hyphens such as "don't") whole.
  const tokens: string[] = []
  for (const piece of pieces) {
    const last = tokens.length - 1
    if (last >= 0 && (/^[\s.,!?;:)\]}'’"-]+$/.test(piece) || (/[A-Za-z0-9'’-]$/.test(tokens[last]) && /^[A-Za-z0-9'’-]/.test(piece) && !/\s$/.test(tokens[last])))) {
      tokens[last] += piece
    } else {
      tokens.push(piece)
    }
  }
  return tokens
}

let measureContext: CanvasRenderingContext2D | null | undefined
function defaultMeasure(fontFamily: string, fontStyle: string): MeasureText {
  if (measureContext === undefined) {
    measureContext = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null
  }
  const ctx = measureContext
  if (!ctx) return estimateTextWidth
  return (text, fontSize) => {
    ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`
    return ctx.measureText(text).width
  }
}

/** Rough width when no canvas is available (tests / SSR): ~0.6em per character. */
export const estimateTextWidth: MeasureText = (text, fontSize) =>
  Array.from(text.replace(/[ัิ-ฺ็-๎]/g, "")).length * fontSize * 0.6

function wrapTokens(tokens: string[], width: number, fontSize: number, measure: MeasureText): string[] | null {
  const lines: string[] = []
  let current = ""
  for (const token of tokens) {
    const candidate = current + token
    if (!current || measure(candidate.trimEnd(), fontSize) <= width) {
      current = candidate
      if (measure(current.trimEnd(), fontSize) > width) return null // one word wider than the box
    } else {
      lines.push(current.trimEnd())
      current = token
      if (measure(current.trimEnd(), fontSize) > width) return null
    }
  }
  if (current.trim()) lines.push(current.trimEnd())
  return lines
}

export function fitText(text: string, options: FitTextOptions): FitTextResult {
  const lineHeight = options.lineHeight ?? 1.1
  const measure = options.measure ?? defaultMeasure(options.fontFamily ?? "Arial", options.fontStyle ?? "bold")
  const tokens = splitWords(text)
  const maxFont = Math.max(1, Math.floor(options.maxFontSize))
  const minFont = Math.max(1, Math.min(maxFont, Math.floor(options.minFontSize)))
  if (!tokens.length) return { text: "", lines: [], fontSize: maxFont, lineHeight }

  const fits = (fontSize: number) => {
    const lines = wrapTokens(tokens, options.width, fontSize, measure)
    return lines && lines.length * fontSize * lineHeight <= options.height ? lines : null
  }
  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 1) {
    const lines = fits(fontSize)
    if (lines) return { text: lines.join("\n"), lines, fontSize, lineHeight }
  }
  // Below the comfortable minimum: keep shrinking (down to 6px) rather than
  // cutting a word; words stay whole on their own lines.
  for (let fontSize = minFont - 1; fontSize >= 6; fontSize -= 1) {
    const lines = fits(fontSize)
    if (lines) return { text: lines.join("\n"), lines, fontSize, lineHeight }
  }
  const lines = tokens.map((token) => token.trim()).filter(Boolean)
  return { text: lines.join("\n"), lines, fontSize: Math.min(minFont, 6), lineHeight }
}
