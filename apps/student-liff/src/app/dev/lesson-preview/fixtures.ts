/**
 * /dev/lesson-preview fixtures: the real lesson ("English · Primary Origins 2
 * (A0)", lesson 6 "The Friendly Dolphin"), local seed names and the reveal
 * mock's leaderboard, plus stress strings. Dev-only.
 */
import type { LiffContextType } from "@/components/providers/LiffProvider";
import type { GamePhaseState, LessonParticipant, LessonSessionData } from "@/hooks/useLessonSocket";
import type { LessonSocketState } from "@/app/interactive/play/_components/lessonPreview";
import { LESSON_PHASE } from "@/lib/lessonPhases";
import { REAL_CLASS, SEED, STRESS } from "../ui-kit/fixtures";

export const ME = "preview-me";
export const PREVIEW_CLASS_ID = "preview-class";

const noop = () => {};

export const PREVIEW_LIFF: LiffContextType = {
  liff: null,
  isReady: true,
  error: null,
  errorCode: null,
  profile: { userId: ME, displayName: SEED.student },
  logout: noop,
  retry: noop,
};

export const ARTICLE: NonNullable<LessonSocketState["articleData"]> & {
  passage: string;
  translated_summary: { th: string[] };
} = {
  id: "preview-article",
  title: REAL_CLASS.lessonTitle,
  passage:
    "Dolphins live in the ocean in groups called pods. They talk to each other with clicks and whistles.\n\nEvery dolphin has its own whistle, like a name. When a baby dolphin is lost, it whistles until its mother finds it. Dolphins are friendly and often swim next to boats.",
  translated_summary: {
    th: ["วันนี้เราจะอ่านเรื่องโลมาที่อยู่รวมกันเป็นฝูง และใช้เสียงคลิกกับเสียงผิวปากคุยกัน"],
  },
  words: [
    { vocabulary: "dolphin", definition: { th: "โลมา" } },
    { vocabulary: "ocean", definition: { th: "มหาสมุทร" } },
    { vocabulary: "whistle", definition: { th: "ผิวปาก, เสียงหวีด" } },
    { vocabulary: "pod", definition: { th: "ฝูง (ของโลมาหรือวาฬ)" } },
    { vocabulary: "friendly", definition: { th: "เป็นมิตร" } },
  ],
  sentences: [
    { sentences: "Dolphins live in the ocean in groups called pods." },
    { sentences: "They talk to each other with clicks and whistles." },
    { sentences: "Every dolphin has its own whistle, like a name." },
    { sentences: "When a baby dolphin is lost, it whistles until its mother finds it." },
    { sentences: "Dolphins are friendly and often swim next to boats." },
  ],
  multipleChoiceQuestions: [
    { question: STRESS.question, answer: "B" },
    { question: "Where do dolphins live?", answer: "A" },
    { question: "What does a lost baby dolphin do?", answer: "C" },
  ],
  shortAnswerQuestions: [
    { question: "Why does every dolphin have its own whistle?", answer: "So others know who it is." },
    { question: "Write two sentences about a dolphin you would like to meet.", answer: "" },
  ],
};

/** The reveal mock's class: you start 7th with 120 and climb to 5th (↑ 2) after answering. */
export function participants(myScore = 120): LessonParticipant[] {
  return [
    { studentId: "s1", name: "มะปราง", score: 480, isReady: true },
    { studentId: "s2", name: "ต้นกล้า", score: 360, isReady: true },
    { studentId: "s3", name: "ใบเตย", score: 300, isReady: true },
    { studentId: "s4", name: SEED.localStudent, score: 260, isReady: true },
    { studentId: "s5", name: SEED.student, score: 200, isReady: true },
    { studentId: "s6", name: STRESS.thaiName, score: 150, isReady: true },
    { studentId: ME, name: SEED.student, score: myScore, isReady: true },
  ];
}

export function session(phase: number, extra: Partial<LessonSessionData> = {}): LessonSessionData {
  return {
    sessionId: "preview-session",
    classBookCycleId: "preview-cycle",
    currentPhase: phase,
    phaseSelectedIndices: { [LESSON_PHASE.COMPREHENSION]: 0, [LESSON_PHASE.GUIDED_RESPONSE]: 0, [LESSON_PHASE.GUIDED_WRITING]: 1 },
    activeSentenceIndex: -1,
    ...extra,
  };
}

export function game(status: GamePhaseState["status"], extra: Partial<GamePhaseState> = {}): GamePhaseState {
  return {
    phase: LESSON_PHASE.VOCABULARY_GAME,
    category: "vocabulary",
    status,
    votes: {},
    selectedGameId: "dragon-flight",
    results: {},
    ...extra,
  };
}

export function baseSocket(): LessonSocketState {
  return {
    socket: null,
    sessionData: null,
    articleData: ARTICLE,
    participants: participants(),
    error: null,
    paymentRequired: null,
    hasAnswered: false,
    questionEnded: false,
    missedQuestion: false,
    isEveryoneReady: false,
    aiFeedback: null,
    nudgeMessage: null,
    kicked: null,
    removedByTutor: false,
    roomInterrupted: false,
    tutorAway: false,
    connectionLost: false,
    clockOffsetMs: 0,
    rejoin: noop,
    flagCounts: {},
    languageAnswer: null,
    submissionError: null,
    submitAnswer: noop,
    toggleReady: noop,
    flagSentence: noop,
    submitGameVote: noop,
    submitGameResult: noop,
    phaseReadOnly: false,
  };
}

export interface PreviewState {
  id: string;
  group: string;
  label: string;
  /** Socket fields for this state (merged over baseSocket()). */
  socket?: Partial<LessonSocketState>;
  /** LIFF override (defaults to the signed-in preview student). */
  liff?: Partial<LiffContextType>;
  /** Omit ?classId (the "no class" screen). */
  noClass?: boolean;
  /** The phone answers like a real one: submitAnswer → hasAnswered after 500ms and +120 points. */
  interactive?: boolean;
}

const p = LESSON_PHASE;

export const PREVIEW_STATES: PreviewState[] = [
  // S6: look at the screen / reading
  { id: "p1-launch", group: "S6 · ดูจอและอ่าน", label: "1 แนะนำบทเรียน (ดูจอ + สรุป)", socket: { sessionData: session(p.LAUNCH) } },
  { id: "p2-flashcards", group: "S6 · ดูจอและอ่าน", label: "2 บัตรคำศัพท์", socket: { sessionData: session(p.FLASHCARDS) } },
  { id: "p2-flashcards-done", group: "S6 · ดูจอและอ่าน", label: "2 บัตรคำ: ทำครบแล้ว", socket: { sessionData: session(p.FLASHCARDS), hasAnswered: true } },
  { id: "p3-read-wait", group: "S6 · ดูจอและอ่าน", label: "3 อ่านบทความ: รอเสียง", socket: { sessionData: session(p.READ_ARTICLE) } },
  { id: "p3-read-sentence", group: "S6 · ดูจอและอ่าน", label: "3 อ่านบทความ: ประโยคปัจจุบัน", socket: { sessionData: session(p.READ_ARTICLE, { activeSentenceIndex: 3 }), flagCounts: { 3: 4 } } },
  { id: "p4-vocab-context", group: "S6 · ดูจอและอ่าน", label: "4 โฟกัสคำศัพท์ (ไฮไลต์)", socket: { sessionData: session(p.VOCABULARY_CONTEXT) } },
  { id: "p5-deep-reading", group: "S6 · ดูจอและอ่าน", label: "5 อ่านเชิงลึก", socket: { sessionData: session(p.DEEP_READING) } },
  { id: "p6-key-sentences", group: "S6 · ดูจอและอ่าน", label: "6 ประโยคสำคัญ", socket: { sessionData: session(p.KEY_SENTENCES) } },

  // S6/S7: multiple choice
  { id: "p7-mcq", group: "S6–S7 · ตอบ A–D", label: "7 คำถาม A–D (แตะเพื่อส่ง)", socket: { sessionData: session(p.COMPREHENSION) }, interactive: true },
  { id: "p7-mcq-everyone", group: "S6–S7 · ตอบ A–D", label: "7 แตะแล้ว + ตอบครบทุกคน", socket: { sessionData: session(p.COMPREHENSION) }, interactive: true },
  { id: "p7-mcq-sending", group: "S6–S7 · ตอบ A–D", label: "7 กำลังส่ง (ไม่มีตอบกลับ)", socket: { sessionData: session(p.COMPREHENSION) } },
  { id: "p7-mcq-readonly", group: "S6–S7 · ตอบ A–D", label: "7 ย้อนดูขั้นเดิม (อ่านอย่างเดียว)", socket: { sessionData: session(p.COMPREHENSION), phaseReadOnly: true } },
  { id: "p7-missed", group: "S6–S7 · ตอบ A–D", label: "7 ตอบไม่ทัน", socket: { sessionData: session(p.COMPREHENSION), missedQuestion: true } },
  { id: "p7-reconnecting", group: "S6–S7 · ตอบ A–D", label: "7 กำลังเชื่อมต่อใหม่ + ครูหลุด", socket: { sessionData: session(p.COMPREHENSION), error: "xhr poll error", connectionLost: true, tutorAway: true } },
  { id: "p9-vocab", group: "S6–S7 · ตอบ A–D", label: "9 ฝึกคำศัพท์", socket: { sessionData: session(p.VOCABULARY_PRACTICE, { phaseSelectedIndices: { [p.VOCABULARY_PRACTICE]: 2 } }) }, interactive: true },
  { id: "p11-fill", group: "S6–S7 · ตอบ A–D", label: "11 เติมคำ", socket: { sessionData: session(p.SENTENCE_PRACTICE, { phaseSelectedIndices: { [p.SENTENCE_PRACTICE]: 1 } }) }, interactive: true },
  { id: "p12-order", group: "S6–S7 · ตอบ A–D", label: "12 เรียงประโยค", socket: { sessionData: session(p.SENTENCE_ORDER, { phaseSelectedIndices: { [p.SENTENCE_ORDER]: 2 } }) }, interactive: true },

  // Written / spoken answers
  { id: "p8-short", group: "S6 · พิมพ์คำตอบ", label: "8 ตอบคำถามสั้น", socket: { sessionData: session(p.GUIDED_RESPONSE) }, interactive: true },
  { id: "p8-pending", group: "S6 · พิมพ์คำตอบ", label: "8 รอ AI", socket: { sessionData: session(p.GUIDED_RESPONSE), hasAnswered: true } },
  { id: "p8-ai", group: "S6 · พิมพ์คำตอบ", label: "8 ผล AI 4/5", socket: { sessionData: session(p.GUIDED_RESPONSE), hasAnswered: true, aiFeedback: { score: 4, feedback: "Great job! You said every dolphin has its own whistle. Try adding one more detail from the story." } } },
  { id: "p8-ai-low", group: "S6 · พิมพ์คำตอบ", label: "8 ผล AI 1/5", socket: { sessionData: session(p.GUIDED_RESPONSE), hasAnswered: true, aiFeedback: { score: 1, feedback: "ลองอ่านย่อหน้าที่สองอีกครั้งนะ แล้วเขียนว่าโลมาใช้เสียงผิวปากทำอะไร" } } },
  { id: "p13-writing", group: "S6 · พิมพ์คำตอบ", label: "13 เขียนแบบมีโครง", socket: { sessionData: session(p.GUIDED_WRITING) }, interactive: true },
  { id: "p13-ai", group: "S6 · พิมพ์คำตอบ", label: "13 ผล AI 3/5", socket: { sessionData: session(p.GUIDED_WRITING), hasAnswered: true, aiFeedback: { score: 3, feedback: "Nice ideas! Use a full stop at the end of each sentence." } } },
  { id: "p15-language", group: "S6 · พิมพ์คำตอบ", label: "15 ถามคำถามภาษา", socket: { sessionData: session(p.LANGUAGE_QUESTIONS) }, interactive: true },
  { id: "p15-answer", group: "S6 · พิมพ์คำตอบ", label: "15 คำตอบจาก AI", socket: { sessionData: session(p.LANGUAGE_QUESTIONS), hasAnswered: true, languageAnswer: { question: "ใช้ a กับ an ต่างกันยังไง?", answer: "'a' กับ 'an' ใช้กับคำนามเอกพจน์ที่นับได้เหมือนกันค่ะ\n\nความแตกต่างคือ:\n*   เราใช้ **'a'** เมื่อคำข้างหลังขึ้นต้นด้วย **เสียงพยัญชนะ**\n    *   ตัวอย่าง: \"**a** dolphin\", \"**a** red book\"\n*   เราใช้ **'an'** เมื่อคำข้างหลังขึ้นต้นด้วย **เสียงสระ**\n    *   ตัวอย่าง: \"**an** ocean\"\n\nสรุปง่ายๆ คือ ดูที่ *เสียง* ไม่ใช่ตัวอักษรนะคะ" } } },

  // Games (the game itself is not shown here)
  { id: "p10-preparing", group: "S6 · เกม", label: "10 กำลังเตรียมเกม", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: null }) } },
  { id: "p10-vote", group: "S6 · เกม", label: "10 โหวตเกม", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("voting", { votes: { [ME]: "dragon-flight" } }) }) } },
  { id: "p10-ready", group: "S6 · เกม", label: "10 ผลโหวต / รอครู", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("ready") }) } },
  { id: "p10-demo", group: "S6 · เกม", label: "10 ครูสาธิต", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("teacher_demo") }) } },
  { id: "p10-tutorial", group: "S6 · เกม", label: "10 วิธีเล่น", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("tutorial") }) } },
  { id: "p10-countdown", group: "S6 · เกม", label: "10 นับถอยหลัง", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("countdown", { countdownEndsAt: Date.now() + 60_000 }) }) } },
  { id: "p10-result", group: "S6 · เกม", label: "10 ผลเกมของฉัน", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("results", { results: { [ME]: { studentId: ME, name: SEED.student, gameId: "dragon-flight", score: 8, correct: 8, total: 10, submittedAt: 0 } } }) }) } },
  { id: "p10-round-over", group: "S6 · เกม", label: "10 รอบจบแล้ว (เข้ามาช้า)", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("results") }) } },
  { id: "p10-review", group: "S6 · เกม", label: "10 ย้อนดูเกม (อ่านอย่างเดียว)", socket: { sessionData: session(p.VOCABULARY_GAME, { gameState: game("playing") }), phaseReadOnly: true } },

  // Reflection, pairs, wrap-up
  { id: "p16-reflection", group: "S6–S8 · ท้ายบท", label: "16 สรุปการเรียนรู้", socket: { sessionData: session(p.REFLECTION) } },
  { id: "p16-done", group: "S6–S8 · ท้ายบท", label: "16 ส่งแล้ว", socket: { sessionData: session(p.REFLECTION), hasAnswered: true } },
  { id: "p17-pair", group: "S6–S8 · ท้ายบท", label: "17 สนทนาจับคู่ (กลุ่ม 3)", socket: { sessionData: session(p.PAIR_CONVERSATION, { pairs: [{ pairNumber: 3, members: [{ studentId: ME, name: SEED.student }, { studentId: "s6", name: STRESS.thaiName }, { studentId: "s4", name: SEED.localStudent }] }] }) } },
  { id: "p17-no-pair", group: "S6–S8 · ท้ายบท", label: "17 ยังไม่จัดคู่", socket: { sessionData: session(p.PAIR_CONVERSATION, { pairs: [] }) } },
  { id: "p18-wrapup", group: "S6–S8 · ท้ายบท", label: "18 สรุปผล: อันดับ 5", socket: { sessionData: session(p.WRAP_UP), participants: participants(240) } },
  { id: "p18-wrapup-first", group: "S6–S8 · ท้ายบท", label: "18 สรุปผล: อันดับ 1", socket: { sessionData: session(p.WRAP_UP), participants: participants(520) } },
  { id: "p18-wrapup-zero", group: "S6–S8 · ท้ายบท", label: "18 สรุปผล: ไม่มีใครได้คะแนน", socket: { sessionData: session(p.WRAP_UP), participants: participants(0).map((row) => ({ ...row, score: 0 })) } },

  // Blocking states
  { id: "connecting", group: "สถานะ", label: "กำลังเชื่อมต่อ", socket: { sessionData: null } },
  { id: "kicked-ended", group: "สถานะ", label: "บทเรียนจบแล้ว", socket: { sessionData: session(p.COMPREHENSION), kicked: "บทเรียนสิ้นสุดลงแล้ว" } },
  { id: "kicked-removed", group: "สถานะ", label: "ครูนำออกชั่วคราว", socket: { sessionData: session(p.COMPREHENSION), kicked: "removed", removedByTutor: true } },
  { id: "payment", group: "สถานะ", label: "ต้องชำระเงินก่อน", socket: { paymentRequired: { classId: PREVIEW_CLASS_ID, bookTitle: REAL_CLASS.book, packagePriceSatang: 300_000, paymentUrl: "/payment" } } },
  { id: "fatal-not-started", group: "สถานะ", label: "ยังไม่เปิดห้อง", socket: { error: "ยังไม่มีคลาสที่เปิดสอนในขณะนี้ หรือคุณครูยังไม่ได้เริ่มเซสชัน" } },
  { id: "fatal-network", group: "สถานะ", label: "เชื่อมต่อไม่ได้", socket: { error: "websocket error" } },
  { id: "no-class", group: "สถานะ", label: "ไม่มีรหัสคลาส", noClass: true },
  { id: "liff-error", group: "สถานะ", label: "LINE เริ่มไม่สำเร็จ", liff: { error: "network", errorCode: "network", profile: null } },
];

/** /student/read fixtures (the reader's real response shape) for both modes. */
export const READER_ARTICLE = {
  id: "preview-article",
  title: REAL_CLASS.lessonTitle,
  passage: ARTICLE.passage,
  cefr_level: "A0",
  ra_level: "RA 2",
  words: ARTICLE.words,
  multipleChoiceQuestions: [
    { id: "m1", question: STRESS.question, option1: "With clicks and whistles", option2: "With their tails only", option3: "They never talk", option4: "By writing letters", answer: "With clicks and whistles" },
    { id: "m2", question: "Where do dolphins live?", option1: "In the ocean", option2: "In a forest", option3: "On a mountain", option4: "In the desert", answer: "In the ocean" },
  ],
  shortAnswerQuestions: [{ id: "s1", question: "Why does every dolphin have its own whistle?", answer: "So others know who it is." }],
};

export const READER_SESSION = {
  sessionId: "preview-session",
  score: 240,
  finishedAt: "2026-11-06T10:30:00.000Z",
  answers: [
    { phase: LESSON_PHASE.COMPREHENSION, questionText: STRESS.question, answerText: "B", correctAnswer: "B", isCorrect: true, score: 120 },
    { phase: LESSON_PHASE.VOCABULARY_PRACTICE, questionText: 'ความหมายของคำว่า "whistle" คืออะไร?', answerText: "C", correctAnswer: "A", isCorrect: false, score: 0 },
    { phase: LESSON_PHASE.GUIDED_RESPONSE, questionText: "Why does every dolphin have its own whistle?", answerText: "Because it is like a name.", isCorrect: null, score: 80, aiFeedback: "Great job! Try adding one more detail from the story." },
    { phase: LESSON_PHASE.VOCABULARY_GAME, kind: "game", questionText: "dragon-flight", answerText: "", isCorrect: null, score: 8 },
  ],
};
