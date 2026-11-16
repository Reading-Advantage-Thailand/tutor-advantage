/** A book opened in a class (GET /v1/classes/:id → class.bookCycles). Plain module: used by server and client. */
export type BookCycle = {
  id: string;
  bookId: string;
  sequence: number;
  title: string;
  status: string;
  packagePriceSatang: number;
  /** Lessons taught in this book (the API sends it with each cycle). */
  progress?: { completedArticles: number; totalArticles: number; percent: number } | null;
};

/** The cycle the lesson picker starts on: the open one, else the first. */
export function initialCycleId(bookCycles: BookCycle[]) {
  return bookCycles.find((cycle) => cycle.status === "open")?.id || bookCycles[0]?.id || "";
}

/**
 * Progress of the cycle the lesson picker starts on: the one source for the
 * lessons tab count and the overview's progress card, so the two never
 * disagree. Null when the API sent no progress, or when its total would
 * contradict the lesson list: a demo class lists one lesson (class
 * articleCount 1) while its only cycle still counts the whole book.
 */
export function openingCycleProgress(bookCycles: BookCycle[], articleCount?: number | null) {
  const cycle = bookCycles.find((item) => item.id === initialCycleId(bookCycles));
  const progress = cycle?.progress;
  if (!cycle || !progress || !progress.totalArticles) return null;
  if (bookCycles.length === 1 && articleCount && articleCount < progress.totalArticles) return null;
  return { cycle, progress };
}
