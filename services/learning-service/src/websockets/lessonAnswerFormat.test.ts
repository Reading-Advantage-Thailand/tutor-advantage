import { describe, expect, it } from "vitest";
import { restoreChoiceAnswerLabel } from "./lessonAnswerFormat";

describe("restoreChoiceAnswerLabel", () => {
  it("restores the bare label from a persisted display answer", () => {
    expect(restoreChoiceAnswerLabel("ตัวเลือก D: Green")).toBe("D");
    expect(restoreChoiceAnswerLabel("  ตัวเลือก b : blue  ")).toBe("B");
  });

  it("keeps already-normalized and non-choice answers intact", () => {
    expect(restoreChoiceAnswerLabel(" c ")).toBe("C");
    expect(restoreChoiceAnswerLabel("A written response")).toBe("A written response");
    expect(restoreChoiceAnswerLabel(null)).toBeUndefined();
  });
});
