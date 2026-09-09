import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FORMS, grade, publicItems, supportsAssessment } from "./origins2Assessment";

describe("Origins 2 pilot forms", () => {
  it("supports the actual Primary Origins 2 catalog and excludes Reading 2 and other levels", () => {
    expect(supportsAssessment({ bookCode: "Primary Origins 2", levelNumber: 20, series: { code: "PRIMARY-ORIGINS" } })).toBe(true);
    expect(supportsAssessment({ bookCode: "Reading 2", levelNumber: 2, series: { code: "Origins" } })).toBe(false);
    expect(supportsAssessment({ bookCode: "Primary Origins 3.1", levelNumber: 31, series: { code: "PRIMARY-ORIGINS" } })).toBe(false);
    expect(supportsAssessment({ bookCode: "Primary 2", levelNumber: 2, series: { code: "Origins" } })).toBe(false);
    expect(supportsAssessment({ bookCode: "Reading 2", levelNumber: 2, series: { code: "Quest" } })).toBe(false);
    expect(supportsAssessment({ bookCode: "Reading 1", levelNumber: 1, series: { code: "Origins" } })).toBe(false);
  });
  for (const stage of ["PRE", "POST"] as const) {
    it(`${stage} has 15 unique items, 5 per skill, and no leaked key or transcript`, () => {
      const items = FORMS[stage];
      expect(items).toHaveLength(15);
      expect(new Set(items.map(i => i.id)).size).toBe(15);
      for (const skill of ["vocabulary", "reading", "listening"]) expect(items.filter(i => i.skill === skill)).toHaveLength(5);
      for (const item of publicItems(stage)) {
        expect(item).not.toHaveProperty("correct"); expect(item).not.toHaveProperty("audioText");
        if (item.skill === "listening") {
          const audio = readFileSync(resolve("apps/student-liff/public", item.audioUrl!.slice(1)));
          expect(audio.toString("ascii", 0, 4)).toBe("RIFF");
          expect(audio.byteLength).toBeGreaterThan(20000);
          expect(item.passage).toBeUndefined();
        }
      }
    });
    it(`${stage} grades all right, all wrong, and mixed skills correctly`, () => {
      const items = FORMS[stage];
      const correct = Object.fromEntries(items.map(i => [i.id, i.correct]));
      expect(grade(stage, correct)).toMatchObject({ total: 15, scores: { vocabulary: 5, reading: 5, listening: 5 } });
      const wrong = Object.fromEntries(items.map(i => [i.id, (i.correct + 1) % 4]));
      expect(grade(stage, wrong).total).toBe(0);
      const mixed = { ...wrong, ...Object.fromEntries(items.filter(i => i.skill === "reading").map(i => [i.id, i.correct])) };
      expect(grade(stage, mixed)).toMatchObject({ total: 5, scores: { vocabulary: 0, reading: 5, listening: 0 } });
    });
    it(`${stage} rejects partial, extra, invalid and cross-form answers`, () => {
      const correct = Object.fromEntries(FORMS[stage].map(i => [i.id, i.correct]));
      for (const invalid of [null, [], {}, { ...correct, extra: 0 }, { ...correct, [FORMS[stage][0].id]: -1 }, { ...correct, [FORMS[stage][0].id]: "1" }, { ...correct, [FORMS[stage][0].id]: 1.5 }, { ...correct, [FORMS[stage][0].id]: 4 }, Object.fromEntries(FORMS[stage === "PRE" ? "POST" : "PRE"].map(i => [i.id, i.correct]))]) {
        expect(() => grade(stage, invalid)).toThrow("INVALID_ANSWERS");
      }
    });
  }
});
