import { describe, expect, it } from "vitest";
import { isPublicInformationPath, publicCatalogStats, type PublicCourse } from "./publicCourses";

describe("public course information", () => {
  it("counts each book's articles once across multiple classes", () => {
    const classes = [{ bookId: "r", articleCount: 14 }, { bookId: "r", articleCount: 14 }, { bookId: "p", articleCount: 12 }] as PublicCourse[];
    expect(publicCatalogStats(classes)).toEqual({ classes: 3, books: 2, articles: 26 });
    expect(publicCatalogStats([])).toEqual({ classes: 0, books: 0, articles: 0 });
  });
  it("identifies public information without marking enrollment/payment public", () => {
    for (const path of ["/courses", "/courses/class-id", "/privacy", "/terms"]) expect(isPublicInformationPath(path)).toBe(true);
    for (const path of ["/classes", "/payment", "/enroll", "/courses-private", "/dashboard"]) expect(isPublicInformationPath(path)).toBe(false);
  });
});
