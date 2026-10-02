import { describe, expect, it } from "vitest";
import {
  fill,
  filterArticles,
  getLessonProgress,
  getNextArticle,
  lessonStartHref,
  normaliseClassArticles,
  parsePreparationMode,
  safeImageUrl,
  type LessonArticle,
} from "./articles";

const payload = {
  cycle: { id: "c1" },
  articles: [
    {
      id: "ra-1",
      articleNumber: 1,
      title: "The Little Library",
      summary: "เด็กหญิงเปิดตู้หนังสือ",
      passage: "Mina lives on Maple Street...",
      cefrLevel: "A2",
      showCefr: true,
      imageUrl: "https://storage.googleapis.com/x/ra-1.png",
      imageUrls: [],
      isCompleted: true,
    },
    {
      id: "ra-2",
      articleNumber: 2,
      title: "Why Do Cats Purr?",
      summary: "แมวทำเสียงครืดคราด",
      passage: "",
      cefrLevel: "CEFR B1",
      showCefr: true,
      imageUrl: null,
      imageUrls: ["https://cdn.example.com/p1.jpg"],
      isCompleted: false,
    },
    { id: "pa-3", title: "", cefrLevel: "A1", showCefr: false, imageUrl: "javascript:alert(1)" },
    null,
    { title: "no id" },
  ],
};

describe("normaliseClassArticles", () => {
  const articles = normaliseClassArticles(payload);

  it("keeps valid rows in order and drops rows without an id", () => {
    expect(articles.map((a) => a.id)).toEqual(["ra-1", "ra-2", "pa-3"]);
  });

  it("prefers imageUrls[0] over imageUrl and drops unsafe URLs", () => {
    expect(articles[0].imageUrl).toBe("https://storage.googleapis.com/x/ra-1.png");
    expect(articles[1].imageUrl).toBe("https://cdn.example.com/p1.jpg");
    expect(articles[2].imageUrl).toBeNull();
  });

  it("strips a CEFR prefix and hides CEFR when showCefr is false", () => {
    expect(articles[1].cefrLevel).toBe("B1");
    expect(articles[2].cefrLevel).toBeNull();
  });

  it("falls back to the position for a missing article number and a dash for a missing title", () => {
    expect(articles[2].articleNumber).toBe(3);
    expect(articles[2].title).toBe("—");
    expect(articles[2].isCompleted).toBe(false);
  });

  it("returns [] for unexpected payloads", () => {
    expect(normaliseClassArticles(null)).toEqual([]);
    expect(normaliseClassArticles({ articles: "nope" })).toEqual([]);
  });
});

describe("safeImageUrl", () => {
  it("accepts http(s) and root-relative paths only", () => {
    expect(safeImageUrl("https://a.b/c.png")).toBe("https://a.b/c.png");
    expect(safeImageUrl("/images/x.svg")).toBe("/images/x.svg");
    expect(safeImageUrl("//evil.com/x.png")).toBeNull();
    expect(safeImageUrl("data:image/png;base64,AAA")).toBeNull();
    expect(safeImageUrl("  ")).toBeNull();
    expect(safeImageUrl(42)).toBeNull();
  });
});

const make = (n: number, isCompleted: boolean, title = `Article ${n}`, summary = ""): LessonArticle => ({
  id: `a${n}`,
  articleNumber: n,
  title,
  summary,
  passage: "",
  cefrLevel: null,
  imageUrl: null,
  isCompleted,
});

describe("progress and next article", () => {
  const list = [make(1, true), make(2, true), make(3, false), make(4, false)];

  it("counts completed articles", () => {
    expect(getLessonProgress(list)).toEqual({ done: 2, total: 4, percent: 50 });
    expect(getLessonProgress([])).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it("picks the first incomplete article in book order", () => {
    expect(getNextArticle(list)?.id).toBe("a3");
    expect(getNextArticle([make(1, true)])).toBeNull();
  });
});

describe("filterArticles", () => {
  const list = [
    make(1, true, "The Little Library", "ตู้หนังสือหน้าบ้าน"),
    make(2, false, "Why Do Cats Purr?", "แมวทำเสียงครืดคราด"),
    make(12, false, "Ocean Plastic", "ขยะในทะเล"),
  ];

  it("filters by status", () => {
    expect(filterArticles(list, "", "done").map((a) => a.id)).toEqual(["a1"]);
    expect(filterArticles(list, "", "todo").map((a) => a.id)).toEqual(["a2", "a12"]);
    expect(filterArticles(list, "").length).toBe(3);
  });

  it("matches title and Thai summary case-insensitively", () => {
    expect(filterArticles(list, "cats").map((a) => a.id)).toEqual(["a2"]);
    expect(filterArticles(list, "  LIBRARY ").map((a) => a.id)).toEqual(["a1"]);
    expect(filterArticles(list, "ทะเล").map((a) => a.id)).toEqual(["a12"]);
  });

  it("matches chapter numbers in several spellings", () => {
    expect(filterArticles(list, "12").map((a) => a.id)).toEqual(["a12"]);
    expect(filterArticles(list, "บทที่ 2").map((a) => a.id)).toEqual(["a2"]);
    expect(filterArticles(list, "บท 1").map((a) => a.id)).toEqual(["a1"]);
    expect(filterArticles(list, "#12").map((a) => a.id)).toEqual(["a12"]);
  });

  it("combines status and query", () => {
    expect(filterArticles(list, "library", "todo")).toEqual([]);
  });
});

describe("routing helpers", () => {
  it("builds live and rehearsal hrefs", () => {
    expect(lessonStartHref("c1", "ra 1", null)).toBe("/lesson/c1/interactive?articleId=ra%201");
    expect(lessonStartHref("c1", "ra-1", "guided")).toBe("/lesson/c1/prepare/lesson?articleId=ra-1&mode=guided");
  });

  it("parses the preparation mode with explore as default", () => {
    expect(parsePreparationMode("guided")).toBe("guided");
    expect(parsePreparationMode("explore")).toBe("explore");
    expect(parsePreparationMode(undefined)).toBe("explore");
  });

  it("fills placeholders", () => {
    expect(fill("สอนแล้ว {done} จาก {total} บท", { done: 5, total: 20 })).toBe("สอนแล้ว 5 จาก 20 บท");
    expect(fill("{missing}", {})).toBe("{missing}");
  });
});
