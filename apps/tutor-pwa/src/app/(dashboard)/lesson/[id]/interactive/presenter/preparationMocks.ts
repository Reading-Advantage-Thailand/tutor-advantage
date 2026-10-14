/**
 * Mock classroom used by PhaseManager in preparation (rehearsal) mode: four
 * sample students who answer, vote and finish games on a timer so the tutor
 * sees the same waiting → results flow as a live lesson.
 */
import type { AnswerData, GamePhaseState, Participant } from "@/lib/lesson-types";
import { LESSON_PHASE } from "@/lib/lessonPhases";

export const PREPARATION_MOCK_STUDENTS: Participant[] = [
  { studentId: "preparation-student-1", name: "น้องมิน", score: 0 },
  { studentId: "preparation-student-2", name: "น้องต้น", score: 0 },
  { studentId: "preparation-student-3", name: "น้องฟ้า", score: 0 },
  { studentId: "preparation-student-4", name: "น้องภูมิ", score: 0 },
];

/** Guide mode stops one answer short so the tutor practises "end question". */
export const PREPARATION_GUIDE_READY_ANSWER_COUNT = PREPARATION_MOCK_STUDENTS.length - 1;

/** Score each mock student shows once they have answered the current phase. */
export const PREPARATION_MOCK_SCORES = [12, 10, 8, 6];

export function createPreparationPairs() {
  return [
    {
      pairNumber: 1,
      members: [
        { studentId: "preparation-pair-1", name: "น้องมิน" },
        { studentId: "preparation-pair-2", name: "น้องต้น" },
      ],
    },
    {
      pairNumber: 2,
      members: [
        { studentId: "preparation-pair-3", name: "น้องฟ้า" },
        { studentId: "preparation-pair-4", name: "น้องภูมิ" },
      ],
    },
  ];
}

export function createPreparationGameState(phase: number): GamePhaseState {
  return {
    phase,
    category: phase === LESSON_PHASE.SENTENCE_GAME ? "sentence" : "vocabulary",
    status: "voting",
    votes: {},
    results: {},
  };
}

export function createPreparationAnswer(phase: number, student: Participant, index: number): AnswerData {
  const answer = ([
    LESSON_PHASE.COMPREHENSION,
    LESSON_PHASE.VOCABULARY_PRACTICE,
    LESSON_PHASE.SENTENCE_PRACTICE,
    LESSON_PHASE.SENTENCE_ORDER,
  ] as number[]).includes(phase)
    ? ["A", "B", "A", "C"][index]
    : ([LESSON_PHASE.GUIDED_RESPONSE, LESSON_PHASE.GUIDED_WRITING] as number[]).includes(phase)
      ? {
          text: [
            "The library has many interesting books.",
            "I found a clue near the map.",
            "The students read together.",
            "The story teaches us to explore.",
          ][index],
          aiScore: [4.5, 3.5, 4, 2.5][index],
        }
      : phase === LESSON_PHASE.LANGUAGE_QUESTIONS
        ? {
            text: [
              "Why did the students visit the library?",
              "What was the most interesting clue?",
              "How did the story end?",
              "Which word would you use to describe the story?",
            ][index],
            languageAnswer: "ลองชวนผู้เรียนอธิบายเหตุผลจากเนื้อเรื่องด้วยประโยคเต็ม",
          }
        : phase === LESSON_PHASE.REFLECTION
          ? { text: "วันนี้ฉันได้เรียนรู้คำศัพท์ใหม่และกล้าเล่าเรื่องมากขึ้น" }
          : "completed";

  return { studentId: student.studentId, name: student.name, answer };
}

export function createPreparationGameResult(
  gameId: string,
  category: "vocabulary" | "sentence",
  student: Participant,
  index: number,
): NonNullable<GamePhaseState["results"][string]> {
  return {
    studentId: student.studentId,
    name: student.name,
    gameId,
    score: category === "vocabulary" ? [92, 84, 76, 68][index] : [88, 81, 73, 65][index],
    correct: [9, 8, 7, 6][index],
    total: 10,
    durationMs: 42000 + index * 3500,
    submittedAt: Date.now(),
  };
}

export function createPreparationGameResults(
  gameId: string,
  category: "vocabulary" | "sentence",
): GamePhaseState["results"] {
  return Object.fromEntries(
    PREPARATION_MOCK_STUDENTS.map((student, index) => [
      student.studentId,
      createPreparationGameResult(gameId, category, student, index),
    ]),
  );
}
