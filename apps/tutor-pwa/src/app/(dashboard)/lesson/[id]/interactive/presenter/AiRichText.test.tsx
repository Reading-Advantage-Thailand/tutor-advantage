// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AiRichText, parseAiInline, parseAiRichText, type AiBlock, type AiInline } from "./AiRichText";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const b = (text: string): AiInline => ({ text, bold: true });
const p = (text: string): AiInline => ({ text, bold: false });

/** The answer as the AI sent it in the photographed lesson (step 15). */
const SAMPLE = [
  "ความแตกต่างคือ:",
  "*   เราใช้ **'a'** เมื่อคำนามข้างหลังเริ่มต้นด้วย **เสียงพยัญชนะ**",
  '    *   ตัวอย่าง: "**a** student" (สติวเด้นท์)',
  "*   เราใช้ **'an'** เมื่อคำนามข้างหลังเริ่มต้นด้วย **เสียงสระ**",
  '    *   ตัวอย่าง: "**an** apple"',
  "",
  "ลองสังเกต *เสียง* ไม่ใช่ตัวอักษรนะ",
].join("\n");

describe("parseAiInline", () => {
  it("turns **bold** and __bold__ into bold runs", () => {
    expect(parseAiInline("ใช้ **a** กับ __an__")).toEqual([p("ใช้ "), b("a"), p(" กับ "), b("an")]);
  });

  it("shows paired *text* and _text_ as just the text", () => {
    expect(parseAiInline("ฟัง *เสียง* และ _คำ_ นี้")).toEqual([p("ฟัง เสียง และ คำ นี้")]);
  });

  it("treats ***text*** as bold", () => {
    expect(parseAiInline("***สำคัญ*** มาก")).toEqual([b("สำคัญ"), p(" มาก")]);
  });

  it("keeps a lone or unbalanced marker as typed", () => {
    expect(parseAiInline("5 * 3 = 15")).toEqual([p("5 * 3 = 15")]);
    expect(parseAiInline("**ยังไม่ปิด")).toEqual([p("**ยังไม่ปิด")]);
    expect(parseAiInline("ปิดแล้ว**")).toEqual([p("ปิดแล้ว**")]);
    expect(parseAiInline("** เว้นวรรค **")).toEqual([p("** เว้นวรรค **")]);
  });

  it("keeps runs of markers (fill-in blanks, star ratings) as typed", () => {
    for (const text of [
      "She _____ to school.",
      "She ______ to school.",
      "I have ___ apple and ___ orange.",
      "เติมคำ: He ____ (be) happy. They ____ (be) sad.",
      "คะแนน ***** ดาว",
      "a *** b *** c",
      "a ** b ** c",
      "(___) and (___)",
      '"___" and "___"',
      "He ___/___ (is/are) here",
      "___air และ ch___",
      "_at, c_t, ca_",
      "c_t and d_g",
      "I am ___. You are ___.",
      "___apple, ___orange",
      "h_ll_ w_rld",
    ]) {
      expect(parseAiInline(text)).toEqual([p(text)]);
    }
  });

  it("does not split an unclosed ** to pair one of its stars", () => {
    expect(parseAiInline("**ยังไม่ปิด และ *เอียง* ต่อ")).toEqual([p("**ยังไม่ปิด และ เอียง ต่อ")]);
  });

  it("keeps * between digits as multiplication", () => {
    expect(parseAiInline("ราคา 5*2 บาท และ 3*4 บาท")).toEqual([p("ราคา 5*2 บาท และ 3*4 บาท")]);
    expect(parseAiInline("2*3*4 = 24")).toEqual([p("2*3*4 = 24")]);
    expect(parseAiInline("an *h*our")).toEqual([p("an hour")]);
    expect(parseAiInline("คำว่า*เสียง*นี้")).toEqual([p("คำว่าเสียงนี้")]);
  });

  it("leaves snake_case words alone", () => {
    expect(parseAiInline("file_name_here")).toEqual([p("file_name_here")]);
  });

  it("keeps underscore blanks inside words as typed (missing-letter spelling)", () => {
    for (const text of [
      "ลองเติม: c__t (แมว), d__g (หมา)",
      "b__k and l__k",
      "un___able and re___able",
      "file__name__here",
    ]) {
      expect(parseAiInline(text)).toEqual([p(text)]);
    }
    expect(parseAiInline("c__t และ __สำคัญ__")).toEqual([p("c__t และ "), { text: "สำคัญ", bold: true }]);
  });

  it("keeps links, code and HTML as plain text", () => {
    expect(parseAiInline("ดู [ที่นี่](https://example.com) `code` <b>x</b>")).toEqual([
      p("ดู [ที่นี่](https://example.com) `code` <b>x</b>"),
    ]);
  });

  it("unescapes \\* to a literal star", () => {
    expect(parseAiInline("\\*ไม่ใช่ตัวเอียง\\*")).toEqual([p("*ไม่ใช่ตัวเอียง*")]);
  });
});

describe("parseAiRichText", () => {
  it("parses the step-15 sample into a paragraph, a nested list and a paragraph", () => {
    const blocks = parseAiRichText(SAMPLE);
    expect(blocks).toEqual<AiBlock[]>([
      { kind: "paragraph", lines: [[p("ความแตกต่างคือ:")]] },
      {
        kind: "list",
        ordered: false,
        start: 1,
        items: [
          {
            content: [[p("เราใช้ "), b("'a'"), p(" เมื่อคำนามข้างหลังเริ่มต้นด้วย "), b("เสียงพยัญชนะ")]],
            children: { ordered: false, start: 1, items: [{ content: [[p('ตัวอย่าง: "'), b("a"), p(' student" (สติวเด้นท์)')]] }] },
          },
          {
            content: [[p("เราใช้ "), b("'an'"), p(" เมื่อคำนามข้างหลังเริ่มต้นด้วย "), b("เสียงสระ")]],
            children: { ordered: false, start: 1, items: [{ content: [[p('ตัวอย่าง: "'), b("an"), p(' apple"')]] }] },
          },
        ],
      },
      { kind: "paragraph", lines: [[p("ลองสังเกต เสียง ไม่ใช่ตัวอักษรนะ")]] },
    ]);
  });

  it("reads -, • and numbered items, and a new list when the kind changes", () => {
    const blocks = parseAiRichText("- หนึ่ง\n• สอง\n1. แรก\n2) สอง");
    expect(blocks.map((block) => block.kind === "list" && [block.ordered, block.items.length])).toEqual([
      [false, 2],
      [true, 2],
    ]);
  });

  it("keeps the first number of a numbered list", () => {
    const [block] = parseAiRichText("3. สาม\n4. สี่");
    expect(block).toMatchObject({ kind: "list", ordered: true, start: 3 });
  });

  it("splits paragraphs on a blank line and keeps single newlines as line breaks", () => {
    expect(parseAiRichText("บรรทัด 1\nบรรทัด 2\n\nย่อหน้าใหม่\r\n")).toEqual([
      { kind: "paragraph", lines: [[p("บรรทัด 1")], [p("บรรทัด 2")]] },
      { kind: "paragraph", lines: [[p("ย่อหน้าใหม่")]] },
    ]);
  });

  it("turns # headings into a bold line, and #tag stays text", () => {
    expect(parseAiRichText("## สรุป\n#tag")).toEqual([
      { kind: "heading", content: [p("สรุป")] },
      { kind: "paragraph", lines: [[p("#tag")]] },
    ]);
  });

  it("drops only a spaced closing # sequence from a heading", () => {
    expect(parseAiRichText("## Key F#")).toEqual([{ kind: "heading", content: [p("Key F#")] }]);
    expect(parseAiRichText("# Title ##")).toEqual([{ kind: "heading", content: [p("Title")] }]);
  });

  it("adds an indented plain line to the list item above it", () => {
    const [block] = parseAiRichText("- ข้อแรก\n  ต่อบรรทัด");
    expect(block).toMatchObject({ kind: "list", items: [{ content: [[p("ข้อแรก")], [p("ต่อบรรทัด")]] }] });
  });

  it("returns nothing for empty text", () => {
    expect(parseAiRichText("")).toEqual([]);
    expect(parseAiRichText(null)).toEqual([]);
  });

  it("never drops characters from text with no markdown", () => {
    const text = "a < b && c > d | x | y | https://example.com";
    expect(parseAiRichText(text)).toEqual([{ kind: "paragraph", lines: [[p(text)]] }]);
  });
});

describe("AiRichText", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  function render(text: string) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<AiRichText text={text} className="text-base" />));
    return host;
  }

  it("renders the sample with no raw markers, bold as <strong> and a nested list", () => {
    const container = render(SAMPLE);
    expect(container.textContent).not.toContain("*");
    expect(Array.from(container.querySelectorAll("strong")).map((el) => el.textContent)).toEqual([
      "'a'",
      "เสียงพยัญชนะ",
      "a",
      "'an'",
      "เสียงสระ",
      "an",
    ]);
    expect(container.querySelectorAll("ul > li")).toHaveLength(4);
    expect(container.querySelectorAll("ul ul > li")).toHaveLength(2);
  });

  it("shows HTML and links as text, never as elements", () => {
    const container = render('<img src=x onerror="alert(1)"> [link](https://example.com)');
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe('<img src=x onerror="alert(1)"> [link](https://example.com)');
  });
});
