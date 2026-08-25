import { describe, expect, it } from "vitest";
import type { ArticleData } from "@/lib/lesson-types";
import { buildTutorGuideSteps } from "./TutorGuidePlan";

function article(overrides: Record<string, unknown> = {}): ArticleData {
  const words: any[] = (overrides.words as any[] | undefined) ?? [
    { vocabulary: "explore", definition: { th: "สำรวจ" } },
    { vocabulary: "clue", definition: { th: "เบาะแส" } },
    { vocabulary: "journey", definition: { th: "การเดินทาง" } },
    { vocabulary: "discover", definition: { th: "ค้นพบ" } },
  ];
  const sentences: any[] = (overrides.sentences as any[] | undefined) ?? [
    { sentences: "The students explore the old library." },
    { sentences: "They discover a clue near the map." },
  ];
  const multipleChoiceQuestions: any[] = (overrides.multipleChoiceQuestions as any[] | undefined) ?? [
    { question: "Where did the students explore?", options: { A: "A library", B: "A park" }, answer: "A" },
  ];
  const shortAnswerQuestions: any[] = (overrides.shortAnswerQuestions as any[] | undefined) ?? [
    { question: "What did the students discover?" },
  ];

  return {
    id: "guide-test-article",
    title: "Guide test article",
    words,
    sentences,
    multipleChoiceQuestions,
    shortAnswerQuestions,
    passage: "The students explore the old library.",
    content: {
      words,
      sentences,
      comprehensionQuestions: multipleChoiceQuestions,
      shortAnswerQuestions,
    },
    ...overrides,
  } as ArticleData;
}

function phaseSteps(steps: ReturnType<typeof buildTutorGuideSteps>, phase: number) {
  return steps.filter((step) => step.phase === phase - 1);
}

describe("Feature Lesson Tutor Guide plan", () => {
  it("covers all 19 lesson phases in screen order", () => {
    const steps = buildTutorGuideSteps(article());
    const phases = new Set(steps.map((step) => step.phase));

    expect([...phases]).toEqual(Array.from({ length: 19 }, (_, index) => index));
    expect(steps.findIndex((step) => step.target === "phase-next-button" && step.phase === 0)).toBeLessThan(
      steps.findIndex((step) => step.target === "phase-next-button" && step.phase === 1),
    );
    expect(steps.at(-1)?.target).toBe("preparation-exit-button");
  });

  it("does not duplicate the Phase 10 question focus", () => {
    const steps = phaseSteps(buildTutorGuideSteps(article()), 10);
    expect(steps.filter((step) => step.target === "phase-10-question")).toHaveLength(1);
  });

  it.each([11, 15])("teaches every game state in Phase %s", (phase) => {
    const targets = phaseSteps(buildTutorGuideSteps(article()), phase).map((step) => step.target);
    const order = [
      "game-vote-options",
      "game-primary-button",
      "game-ready-panel",
      "game-teacher-demo-toggle",
      `phase-${phase}-teacher-demo`,
      `phase-${phase}-tutorial`,
      "game-results-summary",
    ];
    let previous = -1;
    for (const target of order) {
      const current = targets.indexOf(target);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(phaseSteps(buildTutorGuideSteps(article()), phase).some((step) => step.waitForMockVotes)).toBe(true);
    expect(phaseSteps(buildTutorGuideSteps(article()), phase).some((step) => step.waitForGameResults)).toBe(true);
  });

  it("teaches end-question and result review for every question result phase", () => {
    for (const phase of [8, 9, 10, 12, 13, 14]) {
      const steps = phaseSteps(buildTutorGuideSteps(article()), phase);
      expect(steps.some((step) => step.target === "preparation-end-question-button" && step.action === "click")).toBe(true);
      expect(steps.some((step) => step.target === `phase-${phase}-results`)).toBe(true);
      expect(steps.some((step) => step.waitForMockAnswers)).toBe(true);
    }
  });

  it("does not create data-dependent click steps for sparse articles", () => {
    const steps = buildTutorGuideSteps(article({
      words: [],
      sentences: [],
      multipleChoiceQuestions: [],
      shortAnswerQuestions: [],
    }));
    const missingDataClickTargets = new Set([
      "vocabulary-first-audio",
      "phase-3-flashcard-card",
      "phase-3-flashcard-audio",
      "phase-3-flashcard-reveal",
      "phase-3-flashcard-next",
      "phase-4-play-button",
      "phase-4-speed",
      "phase-4-next-sentence",
      "phase-5-first-audio",
      "phase-6-first-question-audio",
      "phase-7-first-audio",
      "phase-8-question-audio",
      "phase-9-question-audio",
      "phase-10-question",
      "phase-10-options",
      "phase-12-question-audio",
      "phase-12-options",
      "phase-13-question-audio",
      "phase-13-options",
      "phase-14-question-audio",
    ]);

    expect(steps.filter((step) => step.action === "click" && missingDataClickTargets.has(step.target))).toHaveLength(0);
  });

  it("does not wait for a disabled Next button when Phase 3 has one card", () => {
    const steps = phaseSteps(buildTutorGuideSteps(article({
      words: [{ vocabulary: "explore", definition: { th: "สำรวจ" } }],
    })), 3);
    const nextStep = steps.find((step) => step.title === "กรณีมี Flashcard ใบเดียว");
    expect(nextStep?.target).toBe("phase-3-flashcard-progress");
    expect(nextStep?.action).toBe("none");
  });
});
