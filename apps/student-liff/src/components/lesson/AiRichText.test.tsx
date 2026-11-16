// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AiRichText, findAiBoldSpans, parseAiInline, parseAiRichText } from "./AiRichText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const plain = (text: string) => [{ text, strong: false }];

describe("parseAiInline", () => {
  it("turns **x** and __x__ into bold runs", () => {
    expect(parseAiInline('เราใช้ **\'a\'** กับ __an__')).toEqual([
      { text: "เราใช้ ", strong: false },
      { text: "'a'", strong: true },
      { text: " กับ ", strong: false },
      { text: "an", strong: true },
    ]);
  });

  it("treats ***x*** as bold", () => {
    expect(parseAiInline("***word***")).toEqual([{ text: "word", strong: true }]);
  });

  it("drops the markers of a clear *x* or _x_ pair", () => {
    expect(parseAiInline("say *hello* and _bye_ now")).toEqual(plain("say hello and bye now"));
  });

  it("keeps lone or unbalanced markers as typed", () => {
    expect(parseAiInline("2 * 3 = 6")).toEqual(plain("2 * 3 = 6"));
    expect(parseAiInline("**open bold")).toEqual(plain("**open bold"));
    expect(parseAiInline("a ** b")).toEqual(plain("a ** b"));
    expect(parseAiInline("snake_case_name")).toEqual(plain("snake_case_name"));
    expect(parseAiInline("5*3*2")).toEqual(plain("5*3*2"));
  });

  it("keeps runs of markers (blanks, stars) as typed", () => {
    for (const text of [
      "I _____ a student.",
      "She ___ (be) happy and he ___ (be) sad.",
      "__________",
      "rating: ***** (5 stars)",
      "password: ********",
      "a__b__c",
    ]) {
      expect(parseAiInline(text)).toEqual(plain(text));
    }
  });

  it("keeps underscore blanks inside words as typed (missing-letter spelling)", () => {
    for (const text of ["ลองเติม: c__t (แมว), d__g (หมา)", "b__k and l__k", "un___able and re___able", "file__name__here"]) {
      expect(parseAiInline(text)).toEqual(plain(text));
    }
    expect(parseAiInline("c__t และ __สำคัญ__")).toEqual([
      { text: "c__t และ ", strong: false },
      { text: "สำคัญ", strong: true },
    ]);
  });

  it("uses no regex lookbehind (Safari and LINE below iOS 16.4 cannot compile it)", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "AiRichText.tsx"), "utf8");
    expect(source).not.toMatch(/\(\?<[!=]/);
  });

  it("finds the same bold spans as the lookbehind form of the rule", () => {
    // Reference rule, written with lookbehind (fine in Node, where this test runs).
    const reference = new RegExp(
      "(?<!\\*)\\*\\*\\*(?![\\s*])([^\\n]*?[^\\s*])\\*\\*\\*(?!\\*)|(?<!\\*)\\*\\*(?![\\s*])([^\\n]*?[^\\s*])\\*\\*(?!\\*)|(?<![\\p{L}\\p{N}_])__(?![\\s_])([^\\n]*?[^\\s_])__(?![\\p{L}\\p{N}_])",
      "gu",
    );
    const expected = (line: string) =>
      [...line.matchAll(reference)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: m[1] ?? m[2] ?? m[3] }));
    const alphabet = ["*", "*", "*", "_", "_", " ", "a", "b", "1", "ก", "า", "่", ".", "😀", "𝒜"];
    let seed = 20261111;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    const fixed = ["**a**", "x**a**", "***a***", "****a**", "a__b__c", "__a__ b", "ก__a__", "😀__a__", "𝒜__a__", "**a** **b**", "*** a ***", "**a***b**",
      // A blocked opener must restart the search one character later.
      "***a**a**", "a__b __c__", "x***a **b**", "ก__a __b__", "___a__"];
    for (let i = 0; i < 20000; i++) {
      const line = i < fixed.length ? fixed[i] : Array.from({ length: 1 + (next() % 14) }, () => alphabet[next() % alphabet.length]).join("");
      expect(findAiBoldSpans(line), JSON.stringify(line)).toEqual(expected(line));
    }
  });

  it("still finds bold next to Thai text and around italics", () => {
    expect(parseAiInline("คำ**เสียง**คำ")).toEqual([
      { text: "คำ", strong: false },
      { text: "เสียง", strong: true },
      { text: "คำ", strong: false },
    ]);
    expect(parseAiInline("**a *b* c**")).toEqual([{ text: "a b c", strong: true }]);
  });

  it("leaves links, code and HTML as plain text", () => {
    const text = "[site](https://example.com) `code` <b>x</b>";
    expect(parseAiInline(text)).toEqual(plain(text));
  });
});

describe("parseAiRichText", () => {
  it("returns nothing for empty input", () => {
    expect(parseAiRichText("")).toEqual([]);
    expect(parseAiRichText(null)).toEqual([]);
  });

  it("splits paragraphs on blank lines and keeps single newlines as lines", () => {
    expect(parseAiRichText("one\ntwo\n\nthree")).toEqual([
      { type: "paragraph", lines: [plain("one"), plain("two")] },
      { type: "paragraph", lines: [plain("three")] },
    ]);
  });

  it("handles CRLF line endings", () => {
    expect(parseAiRichText("one\r\n\r\ntwo")).toEqual([
      { type: "paragraph", lines: [plain("one")] },
      { type: "paragraph", lines: [plain("two")] },
    ]);
  });

  it("parses the a/an answer seen in a live lesson", () => {
    const blocks = parseAiRichText(
      "'a' กับ 'an' เป็นคำนำหน้าคำนาม\n\nความแตกต่างคือ:\n*   เราใช้ **'a'** เมื่อเสียงพยัญชนะ\n    *   ตัวอย่าง: \"**a** student\"\n*   เราใช้ **'an'** เมื่อเสียงสระ\n\nสรุปง่ายๆ คือ…",
    );
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph", "list", "paragraph"]);
    const list = blocks[2];
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(list.items[0].lines[0]).toEqual([
      { text: "เราใช้ ", strong: false },
      { text: "'a'", strong: true },
      { text: " เมื่อเสียงพยัญชนะ", strong: false },
    ]);
    expect(list.items[0].children).toHaveLength(1);
    expect(list.items[0].children[0].items[0].lines[0]).toEqual([
      { text: 'ตัวอย่าง: "', strong: false },
      { text: "a", strong: true },
      { text: ' student"', strong: false },
    ]);
    expect(list.items[1].children).toEqual([]);
  });

  it("accepts -, • and * bullets", () => {
    const [list] = parseAiRichText("- one\n• two\n* three");
    expect(list).toMatchObject({ type: "list", ordered: false });
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.items.map((i) => i.lines[0][0].text)).toEqual(["one", "two", "three"]);
  });

  it("parses numbered lists with . or ) and keeps the numbers", () => {
    const [list] = parseAiRichText("1. first\n2) second\n4. fourth");
    expect(list).toMatchObject({ type: "list", ordered: true });
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.items.map((i) => i.number)).toEqual([1, 2, 4]);
  });

  it("starts a new list when bullets switch to numbers at the same level", () => {
    const blocks = parseAiRichText("* a\n1. b");
    expect(blocks.map((b) => (b.type === "list" ? b.ordered : b.type))).toEqual([false, true]);
  });

  it("adds an indented plain line to the last item", () => {
    const [list] = parseAiRichText("* item\n  more text\nafter");
    if (list.type !== "list") throw new Error("expected a list");
    expect(list.items[0].lines).toEqual([plain("item"), plain("more text")]);
    expect(parseAiRichText("* item\n  more text\nafter")[1]).toEqual({ type: "paragraph", lines: [plain("after")] });
  });

  it("turns # headings into heading blocks but not #hashtags", () => {
    expect(parseAiRichText("## สรุป\n#tag")).toEqual([
      { type: "heading", line: plain("สรุป") },
      { type: "paragraph", lines: [plain("#tag")] },
    ]);
  });

  it("never drops characters of text that is not markdown", () => {
    const text = "*\n-\n1.\n``` code ```\n| a | b |";
    const blocks = parseAiRichText(text);
    expect(blocks).toEqual([
      { type: "paragraph", lines: [plain("*"), plain("-"), plain("1."), plain("``` code ```"), plain("| a | b |")] },
    ]);
  });
});

describe("AiRichText", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  const show = (text: string) => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<AiRichText text={text} className="text-base" />));
    return host;
  };

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it("renders bold, lists and paragraphs without markdown markers", () => {
    const el = show("ความแตกต่างคือ:\n*   ใช้ **a** กับเสียงพยัญชนะ\n    *   **a** student\n\n1. one\n2. two");
    expect(el.textContent).not.toContain("**");
    expect(el.querySelectorAll("strong")).toHaveLength(2);
    expect(el.querySelectorAll("ul")).toHaveLength(2);
    expect(el.querySelectorAll("ul ul li")).toHaveLength(1);
    expect(el.querySelectorAll("ol li")).toHaveLength(2);
    expect(el.querySelector("ol li")?.getAttribute("value")).toBe("1");
  });

  it("puts line breaks between lines of one paragraph", () => {
    const el = show("one\ntwo");
    expect(el.querySelectorAll("p")).toHaveLength(1);
    expect(el.querySelectorAll("br")).toHaveLength(1);
  });

  it("never turns HTML or URLs into elements", () => {
    const el = show("<img src=x onerror=alert(1)> https://example.com [x](https://example.com)");
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("a")).toBeNull();
    expect(el.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
