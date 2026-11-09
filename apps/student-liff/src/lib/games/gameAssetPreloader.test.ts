// @vitest-environment jsdom
import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGameAssetPaths, loadGameImage } from "./gameAssetPreloader";

const PUBLIC_DIRS = [
  path.resolve(process.cwd(), "apps/student-liff/public"),
  path.resolve(process.cwd(), "apps/tutor-pwa/public"),
];

describe("game asset paths", () => {
  it.each(["dragon-flight", "wizard-vs-zombie", "enchanted-library", "rune-match", "castle-defense", "potion-rush"])(
    "%s lists images that exist in both apps",
    (gameId) => {
      const paths = getGameAssetPaths(gameId);
      expect(paths.length).toBeGreaterThan(0);
      for (const file of paths) {
        for (const dir of PUBLIC_DIRS) expect(existsSync(path.join(dir, file)), `${dir}${file}`).toBe(true);
      }
    },
  );
});

describe("loadGameImage", () => {
  let outcomes: ("ok" | "error" | "hang")[];
  let created = 0;

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      const outcome = outcomes[created++] ?? "ok";
      if (outcome === "ok") setTimeout(() => this.onload?.(), 0);
      if (outcome === "error") setTimeout(() => this.onerror?.(), 0);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    created = 0;
    vi.stubGlobal("Image", FakeImage);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries a failed request and resolves", async () => {
    outcomes = ["error", "ok"];
    const promise = loadGameImage("/games/test/retry.webp");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeInstanceOf(FakeImage);
    expect(created).toBe(2);
  });

  it("gives up after three tries, then a later call starts again", async () => {
    outcomes = ["error", "error", "error", "ok"];
    const failed = loadGameImage("/games/test/fail.webp");
    const assertion = expect(failed).rejects.toThrow("Failed to load");
    await vi.runAllTimersAsync();
    await assertion;
    expect(created).toBe(3);

    const retried = loadGameImage("/games/test/fail.webp");
    await vi.runAllTimersAsync();
    await expect(retried).resolves.toBeInstanceOf(FakeImage);
    expect(created).toBe(4);
  });

  it("treats a stalled request as a failure", async () => {
    outcomes = ["hang", "ok"];
    const promise = loadGameImage("/games/test/stall.webp");
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBeInstanceOf(FakeImage);
    expect(created).toBe(2);
  });
});
