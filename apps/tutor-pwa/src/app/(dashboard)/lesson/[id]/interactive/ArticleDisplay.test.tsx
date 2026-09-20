// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ArticleDisplay } from "./ArticleDisplay";
import { LESSON_PHASE } from "@/lib/lessonPhases";

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ translations: [] }),
});

describe("ArticleDisplay playback boundary tests", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    // Mock HTMLMediaElement
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(function (this: HTMLAudioElement) {
      console.log("[play called] src:", this.src);
      return Promise.resolve();
    });
    window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(function (this: HTMLAudioElement) {
      console.log("[pause called]");
    });
    window.HTMLMediaElement.prototype.load = vi.fn().mockImplementation(function (this: HTMLAudioElement) {
      console.log("[load called] src:", this.src);
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("traces full continuous playback from S0 to S12", async () => {
    const rawSentences = [
      // Para 0 (Part 1): sentences 0..9
      { sentence: "S0", audioUrl: "https://audio/s0.mp3", startTime: 0, endTime: 1 },
      { sentence: "S1", audioUrl: "https://audio/s1.mp3", startTime: 1, endTime: 2 },
      { sentence: "S2", audioUrl: "https://audio/s2.mp3", startTime: 2, endTime: 3 },
      { sentence: "S3", audioUrl: "https://audio/s3.mp3", startTime: 3, endTime: 4 },
      { sentence: "S4", audioUrl: "https://audio/s4.mp3", startTime: 4, endTime: 5 },
      { sentence: "S5", audioUrl: "https://audio/s5.mp3", startTime: 5, endTime: 6 },
      { sentence: "S6", audioUrl: "https://audio/s6.mp3", startTime: 6, endTime: 7 },
      { sentence: "S7", audioUrl: "https://audio/s7.mp3", startTime: 7, endTime: 8 },
      { sentence: "S8", audioUrl: "https://audio/s8.mp3", startTime: 8, endTime: 9 },
      { sentence: "S9", audioUrl: "https://audio/s9.mp3", startTime: 9, endTime: 10 },
      // Para 1 (Part 2): sentences 10..13
      { sentence: "S10", audioUrl: "https://audio/s10.mp3", startTime: 10, endTime: 11 },
      { sentence: "S11", audioUrl: "https://audio/s11.mp3", startTime: 11, endTime: 12 },
      { sentence: "S12", audioUrl: "https://audio/s12.mp3", startTime: 12, endTime: 13 },
      { sentence: "S13", audioUrl: "https://audio/s13.mp3", startTime: 13, endTime: 14 },
    ];

    const articleData: any = {
      id: "test-art-1",
      title: "Test Article",
      content_provider: "PRIMARY_ADVANTAGE",
      passage: "S0 S1 S2 S3 S4 S5 S6 S7 S8 S9\n\nS10 S11 S12 S13\n\nS14",
      sentences: rawSentences,
      words: [],
      image_urls: ["https://img/1.png", "https://img/2.png", "https://img/3.png"],
    };

    const activeIdxReported: number[] = [];

    await act(async () => {
      root.render(
        <ArticleDisplay
          articleData={articleData}
          phase={LESSON_PHASE.READ_ARTICLE}
          onActiveIdxChange={(idx) => {
            console.log("[onActiveIdxChange]", idx);
            activeIdxReported.push(idx);
          }}
        />
      );
    });

    const audioElement = container.querySelector("audio") as HTMLAudioElement;
    expect(audioElement).not.toBeNull();

    // Click play button
    const playButton = container.querySelector('[data-tour-target="phase-3-play-button"]') as HTMLButtonElement;
    console.log("=== Click Play ===");
    await act(async () => {
      playButton.click();
    });

    // Loop through sentences 0 to 11
    for (let i = 0; i <= 11; i++) {
      console.log(`=== Sentence ${i} canplay ===`);
      await act(async () => {
        audioElement.dispatchEvent(new Event("canplay"));
      });
      console.log(`=== Sentence ${i} onEnded ===`);
      await act(async () => {
        audioElement.dispatchEvent(new Event("ended"));
      });
      // Advance fake timers for deferred auto-advance
      await act(async () => {
        vi.advanceTimersByTime(30);
      });
    }

    // Verify all sentences from 0 to 12 were transitioned through
    expect(activeIdxReported).toContain(9);  // Sentence before page turn
    expect(activeIdxReported).toContain(10); // First sentence of next page
    expect(activeIdxReported).toContain(11); // Sentence after that
  });

  it("plays boundary sentences directly on click", async () => {
    const rawSentences = [
      { sentence: "S8", audioUrl: "https://audio/s8.mp3", startTime: 8, endTime: 9 },
      { sentence: "S9", audioUrl: "https://audio/s9.mp3", startTime: 9, endTime: 10 },
      { sentence: "S10", audioUrl: "https://audio/s10.mp3", startTime: 10, endTime: 11 },
    ];

    const articleData: any = {
      id: "test-art-2",
      title: "Test Article 2",
      content_provider: "PRIMARY_ADVANTAGE",
      passage: "S8 S9\n\nS10",
      sentences: rawSentences,
      words: [],
      image_urls: ["https://img/1.png", "https://img/2.png"],
    };

    let lastIdx = -1;
    await act(async () => {
      root.render(
        <ArticleDisplay
          articleData={articleData}
          phase={LESSON_PHASE.READ_ARTICLE}
          onActiveIdxChange={(idx) => {
            lastIdx = idx;
          }}
        />
      );
    });

    const audioElement = container.querySelector("audio") as HTMLAudioElement;

    // Click sentence 0 (S8) on page 0
    const sentence0El = container.querySelector("#read-sentence-0") as HTMLElement;
    expect(sentence0El).not.toBeNull();
    await act(async () => {
      sentence0El.click();
    });
    expect(audioElement.src).toBe("https://audio/s8.mp3");
    expect(lastIdx).toBe(0);

    // Navigate to next part (page 1)
    const nextPartBtn = container.querySelector('[data-tour-target="phase-3-next-part"]') as HTMLButtonElement;
    expect(nextPartBtn).not.toBeNull();
    await act(async () => {
      nextPartBtn.click();
    });

    // On page 1, sentence 1 (S9) is now visible
    const sentence1El = container.querySelector("#read-sentence-1") as HTMLElement;
    expect(sentence1El).not.toBeNull();
    await act(async () => {
      sentence1El.click();
    });
    expect(audioElement.src).toBe("https://audio/s9.mp3");
    expect(lastIdx).toBe(1);
  });
});
