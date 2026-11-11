// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// Every game stands in for a stub that records what it was handed and how often it mounted.
const seen = vi.hoisted(() => ({ lists: [] as unknown[], mounts: 0 }));
vi.mock("next/dynamic", async () => {
  const { useEffect } = await import("react");
  return {
    default: () =>
      function GameStub(props: { vocabulary: unknown }) {
        useEffect(() => {
          seen.mounts += 1;
        }, []);
        seen.lists.push(props.vocabulary);
        return null;
      },
  };
});

import { TeachingGameStage } from "./teachingGameRegistry";

const lessonWords = () => [
  { term: "idiom", translation: "สำนวน" },
  { term: "expression", translation: "สำนวน" },
  { term: "slang", translation: "คำแสลง" },
  { term: "context", translation: "บริบท" },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(vocabulary: { term: string; translation: string }[]) {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  act(() => {
    root!.render(<TeachingGameStage gameId="wizard-vs-zombie" mode="teacher" vocabulary={vocabulary} sentences={[]} />);
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  seen.lists = [];
  seen.mounts = 0;
});

describe("TeachingGameStage", () => {
  // A student joining or a tutor reconnecting hands over the same article in a new object.
  it("keeps handing the game the same list when equal words arrive again", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    render(lessonWords());
    render(lessonWords());
    render(lessonWords());
    expect(seen.lists.length).toBeGreaterThanOrEqual(3);
    expect(new Set(seen.lists).size).toBe(1);
    expect(seen.mounts).toBe(1);
  });

  it("hands over a new list when the lesson's words really change", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    render(lessonWords());
    const changed = [...lessonWords(), { term: "predictable", translation: "ทำนายได้" }];
    render(changed);
    expect(seen.lists.at(-1)).not.toBe(seen.lists[0]);
    expect(seen.lists.at(-1)).toEqual(changed);
  });
});
