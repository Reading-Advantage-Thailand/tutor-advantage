export interface PublicCourse {
  id: string;
  name: string;
  bookId: string;
  bookCode: string;
  book: string;
  program: string;
  cefr: string;
  articleCount: number;
  lessonTitles: string[];
  tutor: string | null;
  packagePriceSatang: number;
  currency: "THB";
  schedule: string | null;
  startsAt: string | null;
  endsAt: string | null;
  full: boolean;
}

export function publicCatalogStats(courses: PublicCourse[]) {
  const books = new Map(courses.map((course) => [course.bookId, course.articleCount]));
  return { classes: courses.length, books: books.size, articles: [...books.values()].reduce((sum, count) => sum + count, 0) };
}

export function isPublicInformationPath(path: string) {
  return path === "/courses" || path.startsWith("/courses/") || path === "/terms" || path === "/privacy";
}
