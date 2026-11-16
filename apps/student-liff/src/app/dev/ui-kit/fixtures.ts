/**
 * /dev/ui-kit fixtures (README §5 item 13): real local seed names and real
 * class / lesson data, plus stress strings for line breaks and truncation.
 * No made-up "John Doe" data: every component is checked against what the app
 * really shows.
 */

/** Local seed users (identity-service dev login and the passport / e2e seeds). */
export const SEED = {
  student: "Dev Student",
  studentEmail: "dev-student@localhost",
  tutor: "Dev Tutor",
  passportTutor: "Passport Sim Tutor",
  localStudent: "Local Student 008",
} as const;

/** The real class every mock uses (prod "English" class, tutor T.นกเอี้ยง). */
export const REAL_CLASS = {
  title: "English",
  book: "Primary Origins 2 (A0)",
  fullName: "English · Primary Origins 2 (A0)",
  cefr: "A0",
  tutor: "T.นกเอี้ยง",
  lessonNumber: 6,
  lessonTitle: "The Friendly Dolphin",
  lessonsDone: 5,
  lessonsTotal: 14,
  price: "฿3,000",
} as const;

/** Other real book names from the catalog. */
export const REAL_BOOKS = ["Primary Origins 3.1 (A0)", "Primary Origins 2 (A1)", "Reading Advantage 1"] as const;

export const STRESS = {
  /** Long Thai name with stacked tone marks (clips under line-height 1.3 in Kodchasan). */
  thaiName: "ปุณณ์ชนิดา",
  thaiFullName: "ด.ญ. ปุณณ์ชนิดา ศรีสุวรรณวงศ์",
  /** Exactly 60 characters. */
  email: "punnchanida.srisuwanwong.guardian@student-mail.example.co.th",
  /** Longest class title we show: real book name + the longest course label. */
  longClass: "คลาสภาษาอังกฤษเสริมทักษะการอ่านออกเสียง · Primary Origins 3.1 (A0)",
  /** English question at the length the lesson card must balance. */
  question: "How do dolphins talk to each other?",
} as const;

/** Leaderboard rows from the reveal mock (the viewer is 5th, up 2). */
export const LEADERBOARD = [
  { studentId: "s1", name: "มะปราง", score: 480 },
  { studentId: "s2", name: "ต้นกล้า", score: 360 },
  { studentId: "s3", name: "ใบเตย", score: 300 },
  { studentId: "s4", name: SEED.localStudent, score: 260 },
  { studentId: "me", name: STRESS.thaiName, score: 240, rankMove: 2 },
  { studentId: "s6", name: SEED.student, score: 120 },
] as const;
