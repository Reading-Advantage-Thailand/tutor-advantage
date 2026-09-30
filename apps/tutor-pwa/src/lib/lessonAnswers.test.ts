import { describe, expect, it } from "vitest";
import { getChoiceAnswerLabel } from "./lessonAnswers";

describe("getChoiceAnswerLabel", () => {
  it("normalizes live and restored multiple-choice answers", () => {
    expect(getChoiceAnswerLabel("D")).toBe("D");
    expect(getChoiceAnswerLabel(" d ")).toBe("D");
    expect(getChoiceAnswerLabel("ตัวเลือก D: Green")).toBe("D");
  });

  it("does not turn free-form answers into option labels", () => {
    expect(getChoiceAnswerLabel("Green")).toBeNull();
    expect(getChoiceAnswerLabel({ text: "D" })).toBeNull();
  });
});
