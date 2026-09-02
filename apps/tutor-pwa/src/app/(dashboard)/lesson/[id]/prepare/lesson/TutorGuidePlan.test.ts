import { describe, expect, it } from "vitest";
import type { ArticleData } from "../../../../../../lib/lesson-types";
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
  it("covers all 18 lesson phases in screen order", () => {
    const steps = buildTutorGuideSteps(article());
    const phases = new Set(steps.map((step) => step.phase));

    expect([...phases]).toEqual(Array.from({ length: 18 }, (_, index) => index));
    expect(steps.findIndex((step) => step.target === "phase-next-button" && step.phase === 0)).toBeLessThan(
      steps.findIndex((step) => step.target === "phase-next-button" && step.phase === 1),
    );
    expect(steps.at(-1)?.target).toBe("preparation-exit-button");
  });

  it("teaches the tutor-level navigation and toolbar controls", () => {
    const steps = buildTutorGuideSteps(article());
    const targets = steps.map((step) => step.target);

    expect(targets.indexOf("lesson-control-panel")).toBeLessThan(targets.indexOf("hide-toolbar-button"));
    expect(targets.indexOf("hide-toolbar-button")).toBeLessThan(targets.indexOf("show-toolbar-button"));
    expect(targets.indexOf("show-toolbar-button")).toBeLessThan(targets.indexOf("fullscreen-button"));

    const phaseTwoSteps = phaseSteps(steps, 2);
    expect(phaseTwoSteps.some((step) => step.target === "previous-phase-button" && step.action === "click")).toBe(true);
  });

  it("does not duplicate the Phase 9 question focus", () => {
    const steps = phaseSteps(buildTutorGuideSteps(article()), 9);
    expect(steps.filter((step) => step.target === "phase-9-question")).toHaveLength(1);
  });

  it.each([10, 14])("teaches every game state in Phase %s", (phase) => {
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
    for (const phase of [7, 8, 9, 11, 12, 13]) {
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
      "phase-2-flashcard-card",
      "phase-2-flashcard-audio",
      "phase-2-flashcard-reveal",
      "phase-2-flashcard-next",
      "phase-3-play-button",
      "phase-3-speed",
      "phase-3-next-sentence",
      "phase-4-first-audio",
      "phase-5-first-question-audio",
      "phase-6-first-audio",
      "phase-7-question-audio",
      "phase-8-question-audio",
      "phase-9-question",
      "phase-9-options",
      "phase-11-question-audio",
      "phase-11-options",
      "phase-12-question-audio",
      "phase-12-options",
      "phase-13-question-audio",
    ]);

    expect(steps.filter((step) => step.action === "click" && missingDataClickTargets.has(step.target))).toHaveLength(0);
  });

  it("does not wait for a disabled Next button when Phase 2 has one card", () => {
    const steps = phaseSteps(buildTutorGuideSteps(article({
      words: [{ vocabulary: "explore", definition: { th: "สำรวจ" } }],
    })), 2);
    const nextStep = steps.find((step) => step.title === "กรณีมี Flashcard ใบเดียว");
    expect(nextStep?.target).toBe("phase-2-flashcards");
    expect(nextStep?.action).toBe("none");
    expect(steps.some((step) => step.target === "phase-2-flashcard-next" && step.action === "click")).toBe(false);
  });

  it("explains sparse lesson data and removes unavailable click steps", () => {
    const steps = buildTutorGuideSteps(article({
      words: [],
      sentences: [],
      multipleChoiceQuestions: [],
      shortAnswerQuestions: [],
    }));

    expect(steps.some((step) => step.target === "phase-2-empty-state" && step.title === "กรณีไม่มีคำศัพท์")).toBe(true);
    expect(steps.some((step) => step.target === "phase-4-passage" && step.title === "ไม่มีคำศัพท์ให้ไฮไลต์")).toBe(true);
    expect(steps.some((step) => step.target === "phase-3-reading-passage" && step.title === "กรณีข้อมูลบทอ่านไม่เต็มชุด")).toBe(true);
    expect(steps.some((step) => step.target === "phase-6-sentences" && step.title === "ยังไม่มี Key Sentence")).toBe(true);
    expect(steps.some((step) => step.target === "phase-9-empty-state" && step.title === "คำศัพท์ยังไม่ครบสำหรับแบบฝึก")).toBe(true);
    expect(steps.some((step) => step.target === "phase-11-empty-state" && step.title === "ยังไม่มีประโยคสำหรับเติมคำ")).toBe(true);
    expect(steps.some((step) => step.target === "phase-12-empty-state" && step.title === "ยังไม่มีประโยคสำหรับเรียงคำ")).toBe(true);
    expect(steps.some((step) => step.target === "phase-13-writing" && step.title === "ยังไม่มี Writing Prompt")).toBe(true);

    const unavailableClickTargets = [
      "phase-2-flashcard-card",
      "phase-2-flashcard-audio",
      "phase-2-flashcard-reveal",
      "phase-2-flashcard-next",
      "phase-3-play-button",
      "phase-3-speed",
      "phase-3-next-sentence",
      "phase-4-first-audio",
      "phase-5-first-question-audio",
      "phase-6-first-audio",
      "phase-7-question-audio",
      "phase-8-question-audio",
      "phase-9-question",
      "phase-9-options",
      "phase-11-question-audio",
      "phase-11-options",
      "phase-12-question-audio",
      "phase-12-options",
      "phase-13-question-audio",
    ];
    expect(steps.filter((step) => step.action === "click" && unavailableClickTargets.includes(step.target))).toHaveLength(0);
  });

  it("keeps sentence selection available when only reading audio is missing", () => {
    const steps = phaseSteps(buildTutorGuideSteps(article()), 3);
    expect(steps.some((step) => step.target === "phase-3-first-sentence" && step.action === "click")).toBe(true);
    expect(steps.some((step) => step.target === "phase-3-play-button" && step.action === "click")).toBe(false);
  });
});
