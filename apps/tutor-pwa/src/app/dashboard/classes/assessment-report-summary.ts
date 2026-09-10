export type AssessmentAttempt = {
  attemptId: string;
  articleId?: string;
  stage: "PRE" | "POST";
  submittedAt: string | null;
  total: number | null;
  scores: Record<string, number> | null;
  teacherComment: string | null;
};

export type AssessmentStudent = {
  userId: string;
  displayName: string | null;
  attempts: AssessmentAttempt[];
};

export type AssessmentReportData = {
  title?: string;
  articles?: { articleId: string; title: string }[];
  windows?: { articleId: string; postOpenedAt: string | null }[];
  students: AssessmentStudent[];
};

export const ASSESSMENT_SKILLS = [
  { key: "vocabulary", label: "คำศัพท์" },
  { key: "reading", label: "การอ่าน" },
  { key: "listening", label: "การฟัง" },
] as const;

export function completedAssessmentAttempt(student: AssessmentStudent, stage: AssessmentAttempt["stage"], articleId?: string) {
  return student.attempts.find((attempt) => attempt.stage === stage && attempt.submittedAt && (!articleId || !attempt.articleId || attempt.articleId === articleId));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeAssessment(report: AssessmentReportData) {
  const preAttempts = report.students.map((student) => completedAssessmentAttempt(student, "PRE")).filter(Boolean) as AssessmentAttempt[];
  const postAttempts = report.students.map((student) => completedAssessmentAttempt(student, "POST")).filter(Boolean) as AssessmentAttempt[];
  const paired = report.students.filter((student) => completedAssessmentAttempt(student, "PRE") && completedAssessmentAttempt(student, "POST"));
  const averageTotal = (attempts: AssessmentAttempt[]) => average(attempts.flatMap((attempt) => typeof attempt.total === "number" ? [attempt.total] : []));
  const skillAverages = ASSESSMENT_SKILLS.map((skill) => ({
    ...skill,
    pre: average(preAttempts.flatMap((attempt) => typeof attempt.scores?.[skill.key] === "number" ? [attempt.scores[skill.key]] : [])),
    post: average(postAttempts.flatMap((attempt) => typeof attempt.scores?.[skill.key] === "number" ? [attempt.scores[skill.key]] : [])),
  }));

  return {
    totalStudents: report.students.length,
    preCompleted: preAttempts.length,
    postCompleted: postAttempts.length,
    paired: paired.length,
    preAverage: averageTotal(preAttempts),
    postAverage: averageTotal(postAttempts),
    skillAverages,
  };
}
