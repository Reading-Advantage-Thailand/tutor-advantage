import { afterEach, describe, expect, it, vi } from "vitest";
import answerKeyData from "./assessment-answer-keys.v1.json";
import { gradeArticleAssessment, hasArticleAssessment, loadArticleAssessment } from "./articleAssessmentBank";

const articleId = "The_New_Student";
const key = answerKeyData.articles[articleId as keyof typeof answerKeyData.articles];

function items(stage: "pre" | "post") {
  return [
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-v${index + 1}`, skill: "vocabulary", prompt: "word", options: ["a", "b", "c", "d"] })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-r${index + 1}`, skill: "reading", prompt: "read", options: ["a", "b", "c", "d"] })),
    ...Array.from({ length: 5 }, (_, index) => ({ id: `${stage}-l${index + 1}`, skill: "listening", prompt: "listen", options: ["a", "b", "c", "d"], audioUrl: "https://storage.googleapis.com/tutor_advantage_bucket/audio.mp3" })),
  ];
}

describe("article assessment bank", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads a versioned public manifest from the bucket and keeps answers private", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      schemaVersion: 1,
      bankVersion: answerKeyData.bankVersion,
      version: key.version,
      articleId,
      title: "The New Student",
      readingPassage: "A new student arrives at school.",
      forms: { PRE: items("pre"), POST: items("post") },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const bank = await loadArticleAssessment(articleId);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/assessments/articles/${articleId}/${key.version}.json`), expect.any(Object));
    expect(bank.forms.PRE).toHaveLength(15);
    expect(bank.forms.PRE.find((item) => item.skill === "reading")?.passage).toBe("A new student arrives at school.");
    expect(JSON.stringify(bank.forms)).not.toMatch(/correct|answerKey|audioText/);
  });

  it("grades with the server-only key and rejects unsupported articles", async () => {
    const manifest = {
      schemaVersion: 1,
      bankVersion: answerKeyData.bankVersion,
      version: key.version,
      articleId,
      title: "The New Student",
      readingPassage: "A new student arrives at school.",
      forms: { PRE: items("pre"), POST: items("post") },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest), { status: 200 })));
    const bank = await loadArticleAssessment(articleId);
    const result = gradeArticleAssessment(bank, "PRE", key.answers.PRE);
    expect(result.total).toBe(15);
    expect(result.scores).toEqual({ vocabulary: 5, reading: 5, listening: 5 });
    expect(hasArticleAssessment("missing-article")).toBe(false);
    await expect(loadArticleAssessment("missing-article")).rejects.toThrow("No assessment bank");
  });
});
