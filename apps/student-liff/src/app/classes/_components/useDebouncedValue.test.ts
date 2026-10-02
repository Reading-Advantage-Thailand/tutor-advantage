// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { resolveSearchQuery, searchDebounceDelay } from "./classesList";
import { useDebouncedValue } from "./useDebouncedValue";

let container: HTMLDivElement;
let root: Root;
let seen: string[] = [];

function Probe({ value }: { value: string }) {
  seen.push(useDebouncedValue(value, 400));
  return null;
}

/** The Classes tab's search wiring: what query would be fetched for each render. */
function SearchProbe({ typed }: { typed: string }) {
  const debounced = useDebouncedValue(typed, searchDebounceDelay(typed));
  seen.push(resolveSearchQuery(typed, debounced));
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  seen = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("only settles after the value stops changing for the delay", async () => {
    await act(async () => root.render(React.createElement(Probe, { value: "" })));
    await act(async () => root.render(React.createElement(Probe, { value: "r" })));
    await act(async () => vi.advanceTimersByTime(200));
    await act(async () => root.render(React.createElement(Probe, { value: "re" })));
    await act(async () => vi.advanceTimersByTime(399));
    expect(seen.at(-1)).toBe("");
    await act(async () => vi.advanceTimersByTime(1));
    expect(seen.at(-1)).toBe("re");
    expect(seen).not.toContain("r");
  });
});

describe("classes search query", () => {
  it("never brings back the old search after the box is cleared and retyped quickly", async () => {
    const render = (typed: string) => act(async () => root.render(React.createElement(SearchProbe, { typed })));
    await render("");
    await render("abc");
    await act(async () => vi.advanceTimersByTime(400));
    expect(seen.at(-1)).toBe("abc");

    seen = [];
    await render(""); // cleared → all classes at once
    expect(seen.at(-1)).toBe("");
    await act(async () => vi.advanceTimersByTime(50));
    await render("x"); // new letter well within the debounce window
    expect(seen).not.toContain("abc");
    expect(seen.at(-1)).toBe("");
    await act(async () => vi.advanceTimersByTime(400));
    expect(seen.at(-1)).toBe("x");
    expect(seen).not.toContain("abc");
  });
});
