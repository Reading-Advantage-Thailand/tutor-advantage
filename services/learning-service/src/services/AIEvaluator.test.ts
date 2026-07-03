import { beforeAll, describe, expect, it, vi } from "vitest";

const generateObject = vi.fn();

vi.mock("ai", () => ({ generateObject }));
vi.mock("@ai-sdk/google", () => ({ google: vi.fn((model: string) => model) }));

describe("evaluateShortAnswer", () => {
  let evaluateShortAnswer: typeof import("./AIEvaluator").evaluateShortAnswer;

  beforeAll(async () => {
    ({ evaluateShortAnswer } = await import("./AIEvaluator"));
  }, 15_000);

  it("returns the AI evaluation object when generation succeeds", async () => {
    generateObject.mockResolvedValueOnce({
      object: { score: 4, feedback: "Good answer" },
    });
    await expect(evaluateShortAnswer("Question?", "Expected", "Student")).resolves.toEqual({
      score: 4,
      feedback: "Good answer",
    });
  });

  it("falls back to a full score when generation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    generateObject.mockRejectedValueOnce(new Error("model unavailable"));
    const result = await evaluateShortAnswer("Question?", "Expected", "Student");

    expect(result.score).toBe(5);
    expect(result.feedback).toContain("ระบบ");
  });
});
