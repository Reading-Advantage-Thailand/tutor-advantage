/** A book opened in a class (GET /v1/classes/:id → class.bookCycles). Plain module: used by server and client. */
export type BookCycle = {
  id: string;
  bookId: string;
  sequence: number;
  title: string;
  status: string;
  packagePriceSatang: number;
};

/** The cycle the lesson picker starts on: the open one, else the first. */
export function initialCycleId(bookCycles: BookCycle[]) {
  return bookCycles.find((cycle) => cycle.status === "open")?.id || bookCycles[0]?.id || "";
}
