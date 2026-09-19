import { describe, expect, it } from "vitest";
import { passageSegments } from "./GuidedReading";
import GuidedReading from "./GuidedReading";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("guided reading keeps the full source article", () => {
  it("shows coach-selected content without student navigation or practice buttons", () => {
    const html = renderToStaticMarkup(createElement(GuidedReading, {
      title: "Reading", passage: "Books build knowledge.", quote: "knowledge",
      words: [{ text: "knowledge", meaning: "ความรู้" }], speaking: false, connected: true,
    }));
    expect(html).not.toContain("<button");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("Books build knowledge.");
    expect(html).toContain("ความรู้");
    expect(html).toContain("อ่านอีกครั้ง");
  });
  it.each([
    "Reading matters.\n\nBooks open doors! Why? Try one today",
    "Mr. Fox reads 2.5 pages. Then... he smiles!",
    "ภาษาไทยไม่มีจุดจบประโยค\nEnglish follows here",
    "  Leading spaces.\n\nTrailing spaces  ",
    "Hello!?! Next.",
    "",
  ])("preserves source text exactly: %s", (passage) => {
    expect(passageSegments(passage).join("")).toBe(passage);
  });
});
