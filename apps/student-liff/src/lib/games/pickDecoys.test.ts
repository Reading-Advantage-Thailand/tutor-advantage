import { describe, expect, it } from "vitest";

import { countDistinctMeanings, normalizeMeaning, pickDecoys } from "./pickDecoys";

const word = (term: string, translation: string) => ({ term, translation });

describe("pickDecoys", () => {
  it("never shows the right answer's meaning, in any of many tries", () => {
    const pool = [
      word("idiom", "สำนวน"),
      word("expression", " สำนวน "),
      word("constituent", "ส่วนประกอบ"),
      word("component", "ส่วนประกอบ"),
      word("sun", "พระอาทิตย์"),
      word("moon", "พระจันทร์"),
    ];
    for (let i = 0; i < 200; i++) {
      const decoys = pickDecoys(pool[0], pool, 3);
      const meanings = decoys.map((d) => normalizeMeaning(d.translation));
      expect(meanings).not.toContain("สำนวน");
      expect(new Set(meanings).size).toBe(meanings.length);
      expect(decoys).toHaveLength(3);
    }
  });

  it("returns fewer than asked for when the lesson is small", () => {
    const sun = word("sun", "พระอาทิตย์");
    const moon = word("moon", "พระจันทร์");
    expect(pickDecoys(sun, [sun, moon], 3)).toEqual([moon]);
    expect(pickDecoys(sun, [sun], 3)).toEqual([]);
    expect(pickDecoys(sun, [], 3)).toEqual([]);
  });

  it("returns nothing when every word means the same", () => {
    const idiom = word("idiom", "สำนวน");
    expect(pickDecoys(idiom, [idiom, word("expression", "สำนวน")], 3)).toEqual([]);
  });

  it("leaves out the same word listed with another meaning, and empty meanings", () => {
    const sun = word("sun", "พระอาทิตย์");
    const decoys = pickDecoys(sun, [word("SUN", "ดวงตะวัน"), word("blank", "  "), word("moon", "พระจันทร์")], 3);
    expect(decoys.map((d) => d.term)).toEqual(["moon"]);
  });

  it("follows the rng, so games can test their rounds", () => {
    const pool = [word("a", "1"), word("b", "2"), word("c", "3"), word("d", "4")];
    const first = pickDecoys(pool[0], pool, 2, () => 0);
    const second = pickDecoys(pool[0], pool, 2, () => 0);
    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
  });
});

describe("normalizeMeaning", () => {
  it("treats labels that read the same as the same", () => {
    expect(normalizeMeaning(" การ เดินทาง ")).toBe("การเดินทาง");
    expect(normalizeMeaning("Hello!")).toBe("hello");
    expect(normalizeMeaning(undefined)).toBe("");
  });
});

describe("countDistinctMeanings", () => {
  it("counts meanings, not words", () => {
    expect(countDistinctMeanings([word("a", "สำนวน"), word("b", "สำนวน "), word("c", "แมว"), word("d", "")])).toBe(2);
  });
});
