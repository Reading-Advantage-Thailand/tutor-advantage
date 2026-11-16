import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhaseProgress } from "./PhaseProgress";

describe("free-explore hint in the phase bar", () => {
  it("is a chip from 640px up and part of the caption line below that", () => {
    const html = renderToStaticMarkup(<PhaseProgress currentPhase={18} interactive />);
    // Phone: text in the "ขั้นที่ 18/18" caption.
    expect(html).toContain('<span class="sm:hidden"> · เลือกเฟสได้อิสระ</span>');
    // 640px and up: the chip beside the phase name.
    expect(html).toMatch(/<span class="[^"]*max-sm:hidden[^"]*">(?:<svg[^>]*>.*?<\/svg>)?<span class="truncate">เลือกเฟสได้อิสระ<\/span><\/span>/);
    expect(html.match(/เลือกเฟสได้อิสระ/g)).toHaveLength(2);
  });

  it("is not shown in a live lesson", () => {
    expect(renderToStaticMarkup(<PhaseProgress currentPhase={18} />)).not.toContain("เลือกเฟสได้อิสระ");
  });
});
