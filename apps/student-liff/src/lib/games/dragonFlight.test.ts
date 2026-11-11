import { describe, expect, it } from "vitest";
import type { VocabularyItem } from "@/store/useGameStore";
import { toLessonGameResult } from "./lessonGameResult";
import {
  answerGate,
  applyGateAnswer,
  bossHealthAt,
  createDragonFlightState,
  createGateQueue,
  createGateRound,
  endDragonFlightRound,
  GATE_CLOSES_AT,
  gateLabelTopAt,
  gateOpensAt,
  gateYAt,
  getDragonFlightResults,
  isGateGone,
  MS_PER_WORD,
  setDragonFlightTimeLeft,
  startGate,
  stepGate,
} from "./dragonFlight";
import type { DragonGate } from "./dragonFlight";

const word = (term: string, translation: string): VocabularyItem => ({ id: term, term, translation });
const WORDS = Array.from({ length: 10 }, (_, i) => word(`word${i}`, `meaning${i}`));

/** Same words every run. */
const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const gateFor = (item = WORDS[0], correctSide: "left" | "right" = "left"): DragonGate =>
  startGate(
    { item, bonus: false, wordNumber: 1, round: { term: item.term, correctTranslation: item.translation, decoyTranslation: "x", correctSide } },
    "gate-1",
  );

describe("createGateRound", () => {
  it("never offers the same meaning twice, even when two words share one", () => {
    const idiom = word("idiom", "สำนวน");
    const expression = word("expression", "สำนวน ");
    const pool = [idiom, expression, word("slang", "คำแสลง")];
    for (let seed = 1; seed < 200; seed++) {
      const round = createGateRound(idiom, pool, seeded(seed));
      expect(round.correctTranslation).toBe("สำนวน");
      expect(round.decoyTranslation).toBe("คำแสลง");
    }
  });

  it("leaves the wrong side empty rather than inventing a meaning", () => {
    const round = createGateRound(word("a", "ก"), [word("a", "ก"), word("b", "ก")], seeded());
    expect(round.decoyTranslation).toBe("");
  });

  it("puts the right answer on either side", () => {
    const sides = new Set(Array.from({ length: 40 }, (_, seed) => createGateRound(WORDS[0], WORDS, seeded(seed + 1)).correctSide));
    expect(sides).toEqual(new Set(["left", "right"]));
  });
});

describe("createGateQueue", () => {
  it("asks every word exactly once before anything repeats", () => {
    for (let seed = 1; seed < 50; seed++) {
      const queue = createGateQueue(WORDS, WORDS, seeded(seed));
      const entries = WORDS.map(() => queue.next()!);
      expect(new Set(entries.map((entry) => entry.item.term)).size).toBe(WORDS.length);
      expect(entries.every((entry) => !entry.bonus)).toBe(true);
      expect(entries.map((entry) => entry.wordNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("repeats missed words first once every word has had its turn", () => {
    const queue = createGateQueue(WORDS, WORDS, seeded());
    const asked = WORDS.map(() => queue.next()!);
    queue.review(asked[3].item);
    queue.review(asked[7].item);
    queue.review(asked[3].item);
    const first = queue.next()!;
    const second = queue.next()!;
    expect([first.item, second.item]).toEqual([asked[3].item, asked[7].item]);
    expect(first.bonus && second.bonus).toBe(true);
    expect(first.wordNumber).toBe(0);
  });

  it("keeps supplying gates after that, without the same word twice in a row", () => {
    const queue = createGateQueue(WORDS.slice(0, 2), WORDS.slice(0, 2), seeded());
    const terms = Array.from({ length: 30 }, () => queue.next()!.item.term);
    terms.forEach((term, index) => {
      if (index > 0) expect(term).not.toBe(terms[index - 1]);
    });
  });

  it("gives nothing for an empty list", () => {
    expect(createGateQueue([]).next()).toBeNull();
  });

  it("fits every word into the round even if the student never taps", () => {
    const queue = createGateQueue(WORDS, WORDS, seeded());
    const roundMs = WORDS.length * MS_PER_WORD;
    let elapsed = 0;
    let gate = startGate(queue.next()!, "g");
    const asked = new Set([gate.item.term]);
    while (elapsed < roundMs - 16) {
      gate = stepGate(gate, 16);
      elapsed += 16;
      if (isGateGone(gate)) {
        gate = startGate(queue.next()!, "g");
        asked.add(gate.item.term);
      }
    }
    expect(asked.size).toBe(WORDS.length);
  });
});

describe("gate flow", () => {
  it("cannot be answered until its labels are on screen", () => {
    const gate = gateFor();
    const opensAt = gateOpensAt(78, 844);
    expect(gateYAt(opensAt, 78, 844)).toBeCloseTo(0);
    expect(answerGate({ ...gate, progress: opensAt - 0.01 }, "left", opensAt)).toBeNull();
    expect(answerGate({ ...gate, progress: opensAt + 0.01 }, "left", opensAt)?.outcome).toBe("correct");
  });

  it("takes one answer only", () => {
    const answered = answerGate({ ...gateFor(), progress: 0.4 }, "right")!;
    expect(answered.outcome).toBe("incorrect");
    expect(answerGate(answered, "left")).toBeNull();
  });

  it("closes an unanswered gate as missed, with time left to show the answer", () => {
    let gate = gateFor();
    while (!gate.outcome) gate = stepGate(gate, 16);
    expect(gate.outcome).toBe("missed");
    expect(gate.settledAt).toBe(GATE_CLOSES_AT);
    expect(isGateGone(gate)).toBe(false);
    expect(answerGate(gate, "left")).toBeNull();
  });

  it("frees the student's time after a quick answer, and a wrong answer stays longer", () => {
    const timeToLeave = (side: "left" | "right") => {
      let gate = answerGate({ ...gateFor(), progress: 0.2 }, side)!;
      let ms = 0;
      while (!isGateGone(gate)) {
        gate = stepGate(gate, 16);
        ms += 16;
      }
      return ms;
    };
    expect(timeToLeave("left")).toBeLessThan(1000);
    expect(timeToLeave("right")).toBeGreaterThan(1500);
    expect(timeToLeave("right")).toBeLessThan(1700);
  });

  it("never leaves slower than its normal trip after a late answer", () => {
    const answered = answerGate({ ...gateFor(), progress: 0.84 }, "right")!;
    expect(answered.speed).toBeCloseTo(1 / MS_PER_WORD);
  });

  it("keeps progress across a rotation: the same gate is at the same place on the new stage", () => {
    const portrait = gateYAt(0.5, 78, 844);
    const landscape = gateYAt(0.5, 117, 390);
    expect(portrait).toBeGreaterThan(0);
    expect(portrait).toBeLessThan(844);
    expect(landscape).toBeGreaterThan(0);
    expect(landscape).toBeLessThan(390);
  });
});

describe("gateLabelTopAt", () => {
  const base = { gateHeight: 78, hudBottom: 120, arrowsTop: 740, labelHeight: 50 };

  it("follows the gate in mid flight", () => {
    expect(gateLabelTopAt({ ...base, gateY: 300 })).toBe(386);
  });

  it("stops above the arrows instead of leaving the screen", () => {
    expect(gateLabelTopAt({ ...base, gateY: 800 })).toBe(682);
  });

  it("stays below the top bar", () => {
    expect(gateLabelTopAt({ ...base, gateY: 0 })).toBe(124);
  });

  it("prefers the top bar when a tall label cannot fit", () => {
    expect(gateLabelTopAt({ ...base, arrowsTop: 200, labelHeight: 120, gateY: 300 })).toBe(124);
  });
});

describe("applyGateAnswer", () => {
  const state = createDragonFlightState(WORDS, { durationMs: 50_000, rng: seeded() });

  it("counts a correct answer once and adds a dragon", () => {
    const next = applyGateAnswer(state, { correct: true });
    expect(next.correctAnswers).toBe(1);
    expect(next.dragonCount).toBe(2);
  });

  it("gives a bonus gate dragons but no points", () => {
    const next = applyGateAnswer(state, { correct: true, bonus: true });
    expect(next.correctAnswers).toBe(0);
    expect(next.dragonCount).toBe(2);
  });

  it("cannot take the flock below one dragon", () => {
    expect(applyGateAnswer(state, { correct: false }).dragonCount).toBe(1);
    expect(applyGateAnswer({ ...state, dragonCount: 3 }, { correct: false }).dragonCount).toBe(2);
  });

  it("ignores a tap after the round has ended", () => {
    const over = endDragonFlightRound(state);
    expect(applyGateAnswer(over, { correct: true })).toBe(over);
  });
});

describe("round clock", () => {
  const state = createDragonFlightState(WORDS, { durationMs: 50_000, rng: seeded() });

  it("takes time left from the real clock", () => {
    expect(setDragonFlightTimeLeft(state, 20_000).elapsedMs).toBe(30_000);
    expect(setDragonFlightTimeLeft(state, 60_000).elapsedMs).toBe(0);
  });

  it("ends the round once", () => {
    const over = endDragonFlightRound({ ...state, elapsedMs: 49_500 });
    expect(over.status).toBe("boss");
    expect(over.elapsedMs).toBe(50_000);
    expect(endDragonFlightRound(over)).toBe(over);
    expect(setDragonFlightTimeLeft(over, 5_000)).toBe(over);
  });
});

describe("boss finish", () => {
  it("always ends with the boss down, and more dragons do it sooner", () => {
    const whenDown = (dragons: number) => {
      let ms = 0;
      while (bossHealthAt(ms, dragons) > 0) ms += 10;
      return ms;
    };
    expect(bossHealthAt(0, 5)).toBe(1);
    expect(whenDown(1)).toBeLessThanOrEqual(2600);
    expect(whenDown(11)).toBeLessThan(whenDown(1));
    expect(whenDown(40)).toBeGreaterThanOrEqual(1500);
  });
});

describe("the lesson result", () => {
  const lessonResult = (correct: number, totalWords = 10) =>
    toLessonGameResult(
      getDragonFlightResults({ correctAnswers: correct, totalAttempts: totalWords, dragonCount: correct + 1, difficulty: "normal" }, 50_000),
      99_000,
    );

  it("counts every word of the round, so skipping costs the same as missing", () => {
    expect(lessonResult(0)).toEqual({ score: 0, correct: 0, total: 10, durationMs: 50_000 });
    expect(lessonResult(5)).toEqual({ score: 5, correct: 5, total: 10, durationMs: 50_000 });
    expect(lessonResult(7).score).toBeGreaterThan(lessonResult(5).score);
  });

  it("reports play time, not the time spent loading", () => {
    expect(lessonResult(3).durationMs).toBe(50_000);
  });
});
