// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isTeachingGameId, isTeachingGameLoaded, preloadTeachingGame, TEACHING_GAME_IDS } from "./teachingGameRegistry";

describe("teachingGameRegistry", () => {
  it("knows the six live-lesson teaching games", () => {
    expect(TEACHING_GAME_IDS).toEqual(["dragon-flight", "wizard-vs-zombie", "enchanted-library", "rune-match", "castle-defense", "potion-rush"]);
    expect(isTeachingGameId("rune-match")).toBe(true);
    expect(isTeachingGameId("haunted-library")).toBe(false);
    expect(isTeachingGameId(undefined)).toBe(false);
  });

  it("preloads once and reports the game as loaded", async () => {
    expect(isTeachingGameLoaded("flashcard")).toBe(false);
    const first = preloadTeachingGame("flashcard");
    expect(preloadTeachingGame("flashcard")).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(isTeachingGameLoaded("flashcard")).toBe(true);
  });

  it("ignores unknown ids without throwing", async () => {
    await expect(preloadTeachingGame("not-a-game")).resolves.toBe(false);
    await expect(preloadTeachingGame(null)).resolves.toBe(false);
  });
});
