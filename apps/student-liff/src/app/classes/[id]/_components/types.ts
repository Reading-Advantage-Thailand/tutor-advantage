import type { ClassAccessSource, ClassBookCycle } from "../../../../lib/classAccess";

export interface ClassTutor {
  name: string;
  initials: string;
  pictureUrl?: string | null;
  bio?: string;
  rating?: number;
  students?: number;
}

/** First articles of the class's book, sent with GET /classes/:id (visible to visitors). */
export interface ClassArticlePreview {
  id: string;
  no: number;
  title: string;
  type?: string | null;
  genre?: string | null;
}

/** GET /classes/:id → `class`. */
export interface ClassDetail extends ClassAccessSource {
  name: string;
  seriesColor?: string;
  maxStudents: number;
  students: number;
  tutor: ClassTutor;
  cefr: string;
  level: number;
  nextSession: string;
  book: string;
  bookCode?: string | null;
  seriesName?: string | null;
  seriesTagline?: string | null;
  articleCount?: number;
  independentHours?: number;
  totalHours?: number;
  schedule: string;
  highlights?: string[];
  articles?: ClassArticlePreview[];
  articleId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  bookCycles?: ClassBookCycle[];
}

/** GET /classes/:id/articles → `articles[]`. Primary books send `cefrLevel: null`. */
export interface ClassArticleDetail {
  id: string;
  articleNumber: number;
  title: string;
  summary: string;
  passage: string;
  cefrLevel: string | null;
  showCefr?: boolean;
  isCompleted: boolean;
}

export interface TutorReview {
  id: string;
  rating: number;
  comment?: string | null;
}
