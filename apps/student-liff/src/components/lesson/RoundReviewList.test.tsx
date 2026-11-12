// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { toLessonGameResult } from "../../lib/games/lessonGameResult";
import { RoundReviewList } from "./RoundReviewList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("RoundReviewList", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  const show = (review?: Parameters<typeof RoundReviewList>[0]["review"]) => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<RoundReviewList review={review} />));
    return host;
  };

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it("lists each word with its meaning", () => {
    const shown = show({ heading: "หมดเวลา", missed: [{ term: "idiom", meaning: "สำนวน" }, { term: "moon", meaning: "พระจันทร์" }] });
    expect(shown.querySelectorAll("li")).toHaveLength(2);
    expect(shown.textContent).toContain("idiom = สำนวน");
    expect(shown.textContent).toContain("moon = พระจันทร์");
  });

  it("shows nothing for a perfect round or a game with no review", () => {
    expect(show({ heading: "เก่งมาก", missed: [] }).textContent).toBe("");
    expect(show(undefined).textContent).toBe("");
  });
});

describe("toLessonGameResult with a review", () => {
  it("carries the review along and leaves the points to the one rule", () => {
    const review = { heading: "หมดเวลา", missed: [{ term: "idiom", meaning: "สำนวน" }] };
    const result = toLessonGameResult({ correctAnswers: 3, totalAttempts: 10, review }, 1000);
    expect(result).toMatchObject({ score: 3, correct: 3, total: 10, review });
  });

  it("adds no review field for a game that sends none", () => {
    expect("review" in toLessonGameResult({ correctAnswers: 3, totalAttempts: 10 }, 1000)).toBe(false);
  });
});
