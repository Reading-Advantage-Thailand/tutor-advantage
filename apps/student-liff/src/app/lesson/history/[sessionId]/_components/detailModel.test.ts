import { describe, expect, it } from "vitest";
import { isNotFoundError, parseAnswerChoice } from "./detailModel";

describe("parseAnswerChoice", () => {
  it("reads the Thai option prefix", () => {
    expect(parseAnswerChoice("ตัวเลือก B: By the window")).toEqual({ label: "B", text: "By the window" });
    expect(parseAnswerChoice("ตัวเลือก a: door")).toEqual({ label: "A", text: "door" });
  });

  it("reads a bare letter prefix", () => {
    expect(parseAnswerChoice("C : At the back")).toEqual({ label: "C", text: "At the back" });
  });

  it("keeps free-text answers as they are", () => {
    expect(parseAnswerChoice("She likes planes")).toEqual({ label: null, text: "She likes planes" });
    expect(parseAnswerChoice("E: not an option")).toEqual({ label: null, text: "E: not an option" });
  });

  it("labels empty answers", () => {
    expect(parseAnswerChoice("")).toEqual({ label: null, text: "ไม่ได้ระบุ" });
    expect(parseAnswerChoice(undefined).text).toBe("ไม่ได้ระบุ");
  });
});

describe("isNotFoundError", () => {
  it("treats 404 and 403 as not found", () => {
    expect(isNotFoundError({ status: 404 })).toBe(true);
    expect(isNotFoundError({ status: 403 })).toBe(true);
  });

  it("treats everything else as a retryable error", () => {
    expect(isNotFoundError({ status: 500 })).toBe(false);
    expect(isNotFoundError(new Error("Failed to fetch"))).toBe(false);
    expect(isNotFoundError(null)).toBe(false);
  });
});
