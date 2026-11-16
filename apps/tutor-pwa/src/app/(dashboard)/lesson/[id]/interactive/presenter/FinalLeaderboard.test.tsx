// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Participant } from "@/lib/lesson-types";
import { FinalLeaderboardStage } from "./WrapUpStages";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

function render(scores: number[]) {
  const participants: Participant[] = scores.map((score, index) => ({
    studentId: `s${index}`,
    name: `นักเรียน ${index + 1}`,
    score,
  }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<FinalLeaderboardStage participants={participants} />));
  return host;
}

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** The podium in visual order (left, centre, right): name, place numeral and block classes. */
function podium(container: HTMLElement) {
  const list = container.querySelector("ol")!;
  return Array.from(list.children)
    .filter((li) => li.getAttribute("aria-hidden") !== "true")
    .map((li) => {
      const block = li.querySelector("div.font-heading")!;
      return {
        order: Array.from(li.classList).find((c) => c.startsWith("order-")),
        name: li.querySelector("p[title]")?.getAttribute("title"),
        place: block.querySelector("span[aria-hidden='true']")?.textContent,
        label: block.querySelector(".sr-only")?.textContent,
        block: block.className,
      };
    })
    .sort((a, b) => String(a.order).localeCompare(String(b.order)));
}

describe("FinalLeaderboardStage podium", () => {
  it("puts a tie for 2nd on two equal silver 2 blocks (14 / 7 / 7 → 1, 2, 2)", () => {
    const [left, centre, right] = podium(render([14, 7, 7]));
    expect([left.name, centre.name, right.name]).toEqual(["นักเรียน 2", "นักเรียน 1", "นักเรียน 3"]);
    expect([left.place, centre.place, right.place]).toEqual(["2", "1", "2"]);
    expect([left.label, centre.label, right.label]).toEqual(["#2", "#1", "#2"]);
    expect(left.block).toBe(right.block);
    expect(left.block).toContain("bg-medal-silver");
    expect(centre.block).toContain("bg-medal-gold");
  });

  it("puts a tie for 1st on two gold 1 blocks and the next on 3 (7 / 7 / 5 → 1, 1, 3)", () => {
    const [left, centre, right] = podium(render([7, 7, 5]));
    expect([left.place, centre.place, right.place]).toEqual(["1", "1", "3"]);
    expect(left.block).toBe(centre.block);
    expect(right.block).toContain("bg-medal-bronze");
  });

  it("numbers ranks 4+ with shared places too", () => {
    const container = render([9, 8, 6, 6, 6, 2]);
    const rest = container.querySelectorAll("ol")[1];
    const numbers = Array.from(rest.querySelectorAll("li")).map((li) => li.querySelector("span")?.textContent);
    expect(numbers).toEqual(["3", "3", "6"]);
    expect(podium(container).map((p) => p.place)).toEqual(["2", "1", "3"]);
  });

  it("keeps the centre slot for the first player with fewer than three", () => {
    const entries = podium(render([3, 5]));
    expect(entries.map((p) => [p.name, p.place])).toEqual([
      ["นักเรียน 1", "2"],
      ["นักเรียน 2", "1"],
    ]);
  });
});
