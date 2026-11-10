// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sentencePeekMs, sentencePromptFor, useSentencePrompt, type SentencePrompt, type SentencePromptItem } from "./useSentencePrompt";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("sentencePromptFor", () => {
  it("shows real Thai all round", () => {
    expect(sentencePromptFor({ term: "I see the sun", thaiTranslation: "ฉันเห็นพระอาทิตย์" }).kind).toBe("thai");
  });

  it("only peeks at the English when there is no Thai", () => {
    const prompt = sentencePromptFor({ term: "I see the sun", audioUrl: "a.mp3" });
    expect(prompt).toMatchObject({ kind: "peek", text: "I see the sun", audioUrl: "a.mp3" });
  });

  it("gives a long sentence longer, within limits", () => {
    expect(sentencePeekMs("Go now")).toBe(3_000);
    expect(sentencePeekMs("one two three four five six seven eight")).toBe(5_200);
    expect(sentencePeekMs(Array(40).fill("word").join(" "))).toBe(8_000);
  });
});

describe("useSentencePrompt", () => {
  const plays: string[] = [];
  let container: HTMLDivElement;
  let root: Root;
  let latest: SentencePrompt;

  function Probe({ item, enabled }: { item: SentencePromptItem | null; enabled?: boolean }) {
    latest = useSentencePrompt(item, { enabled });
    return null;
  }

  const render = (item: SentencePromptItem | null, enabled?: boolean) =>
    act(() => {
      root.render(<Probe item={item} enabled={enabled} />);
    });

  beforeEach(() => {
    plays.length = 0;
    vi.useFakeTimers();
    vi.stubGlobal(
      "Audio",
      class {
        src = "";
        pause() {}
        play() {
          plays.push(this.src);
          return Promise.reject(new Error("blocked"));
        }
      },
    );
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays the recording, shows the English, then hides it until replay", () => {
    const item = { term: "I see the sun", audioUrl: "a.mp3" };
    render(item);
    expect(latest).toMatchObject({ kind: "peek", text: "I see the sun", hidden: false });
    expect(plays).toEqual(["a.mp3"]);

    act(() => void vi.advanceTimersByTime(sentencePeekMs(item.term) + 1));
    expect(latest).toMatchObject({ kind: "peek", text: "", hidden: true });

    act(() => latest.replay());
    expect(latest).toMatchObject({ text: "I see the sun", hidden: false });
    expect(plays).toEqual(["a.mp3", "a.mp3"]);
  });

  it("starts over on the next sentence", () => {
    render({ term: "I see the sun" });
    act(() => void vi.advanceTimersByTime(10_000));
    expect(latest.hidden).toBe(true);
    render({ term: "We read together" });
    expect(latest).toMatchObject({ text: "We read together", hidden: false });
  });

  it("keeps Thai on screen", () => {
    render({ term: "I see the sun", thaiTranslation: "ฉันเห็นพระอาทิตย์" });
    act(() => void vi.advanceTimersByTime(60_000));
    expect(latest).toMatchObject({ kind: "thai", text: "ฉันเห็นพระอาทิตย์", hidden: false });
  });

  it("stays up with no sound in a demo", () => {
    render({ term: "I see the sun", audioUrl: "a.mp3" }, false);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(latest).toMatchObject({ text: "I see the sun", hidden: false });
    expect(plays).toEqual([]);
  });

  it("is empty with no sentence", () => {
    render(null);
    expect(latest).toMatchObject({ kind: "none", text: "", hidden: false });
  });
});
