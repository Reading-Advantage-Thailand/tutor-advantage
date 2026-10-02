import { describe, expect, it } from "vitest"
import { estimateTextWidth, fitText, splitWords } from "./textFit"

const box = { width: 60, height: 40, maxFontSize: 18, minFontSize: 9, measure: estimateTextWidth }

describe("splitWords", () => {
  it("keeps Latin words whole and glues trailing spaces/punctuation", () => {
    expect(splitWords("don't  stop, now!").map((t) => t.trim())).toEqual(["don't", "stop,", "now!"])
  })

  it("splits Thai at word boundaries without losing characters", () => {
    const tokens = splitWords("มังกรบินข้ามป่า")
    expect(tokens.join("")).toBe("มังกรบินข้ามป่า")
  })
})

describe("fitText", () => {
  it("keeps a single long word whole and shrinks it to fit", () => {
    const result = fitText("crystal", box)
    expect(result.lines).toEqual(["crystal"])
    expect(estimateTextWidth("crystal", result.fontSize)).toBeLessThanOrEqual(box.width)
  })

  it("wraps several words at spaces only", () => {
    const result = fitText("over the forest", { ...box, width: 80, height: 60 })
    expect(result.lines.join(" ")).toBe("over the forest")
    for (const line of result.lines) expect(estimateTextWidth(line, result.fontSize)).toBeLessThanOrEqual(80)
    expect(result.lines.length * result.fontSize * result.lineHeight).toBeLessThanOrEqual(60)
  })

  it("prefers the largest font that fits", () => {
    expect(fitText("hi", box).fontSize).toBe(18)
  })

  it("shrinks below the minimum rather than breaking a word", () => {
    const result = fitText("extraordinarily", { ...box, width: 40, minFontSize: 10 })
    expect(result.lines).toEqual(["extraordinarily"])
    expect(result.fontSize).toBeLessThan(10)
  })

  it("handles empty text", () => {
    expect(fitText("  ", box).lines).toEqual([])
  })
})
