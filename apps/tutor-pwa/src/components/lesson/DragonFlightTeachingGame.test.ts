import { describe, expect, it } from "vitest";
import { buildDragonRound } from "./DragonFlightTeachingGame";

// As in a real A1 lesson: idiom and expression share one Thai meaning.
const WORDS = [
  { term: "idiom", translation: "สำนวน" },
  { term: "expression", translation: "สำนวน" },
  { term: "slang", translation: "คำแสลง" },
  { term: "informal", translation: "ไม่เป็นทางการ" },
  { term: "context", translation: "บริบท" },
  { term: "constituent", translation: "ส่วนประกอบ" },
];

describe("buildDragonRound", () => {
  it("never shows the answer's meaning on the wrong gate", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let roundIndex = 0; roundIndex < WORDS.length * 2; roundIndex++) {
        const round = buildDragonRound(WORDS, roundIndex, seed);
        const wrongSide = round.correctSide === "left" ? "right" : "left";
        expect(round.labels[round.correctSide]).toBe(round.word.translation);
        expect(round.labels[wrongSide]).not.toBe(round.word.translation);
      }
    }
  });

  it("does not let the class read the answer from a left-right pattern", () => {
    const sides = Array.from({ length: 40 }, (_, roundIndex) => buildDragonRound(WORDS, roundIndex, 7).correctSide);
    const alternating = sides.every((side, index) => index === 0 || side !== sides[index - 1]);
    expect(new Set(sides).size).toBe(2);
    expect(alternating).toBe(false);
  });

  it("does not always use the next word as the wrong gate", () => {
    const nextWordEveryTime = Array.from({ length: 30 }, (_, roundIndex) => {
      const round = buildDragonRound(WORDS, roundIndex, 3);
      const wrong = round.labels[round.correctSide === "left" ? "right" : "left"];
      return wrong === WORDS[(roundIndex + 1) % WORDS.length].translation;
    }).every(Boolean);
    expect(nextWordEveryTime).toBe(false);
  });

  it("reads the same on every re-render of one round", () => {
    expect(buildDragonRound(WORDS, 4, 11)).toEqual(buildDragonRound(WORDS, 4, 11));
  });
});
