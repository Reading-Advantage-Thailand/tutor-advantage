export type AssessmentMode = "LESSON" | "PRE" | "POST";
export type AssessmentControl = { action: "select"; mode: AssessmentMode; revision: number } | { action: "start" | "finish" | "reset"; revision: number };
export type AssessmentQuestion = { id: string; skill: "vocabulary" | "reading" | "listening"; prompt: string; options: string[]; passage?: string; audioUrl?: string };
export type LiveAssessmentState = {
  sessionId: string;
  supported: boolean;
  articleId?: string;
  articleTitle?: string;
  mode: AssessmentMode;
  status: "LOBBY" | "RUNNING" | "FINISHED";
  revision: number;
  postOpened: boolean;
  paused: boolean;
  items: AssessmentQuestion[];
  answers: Record<string, number>;
  completed: boolean;
  progress: { studentId: string; name: string; answered: number; completed: boolean; previouslyCompleted: boolean; connected?: boolean }[];
};
