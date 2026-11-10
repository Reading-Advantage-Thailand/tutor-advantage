import { describe, expect, it } from "vitest";

import {
  buildLessonSentences,
  buildLessonVocabulary,
  hasThaiText,
  hasUsableSentences,
  hasUsableVocabulary,
  repeatThinSentences,
} from "./lessonContent";

describe("buildLessonVocabulary", () => {
  it("prefers Thai and keeps the lesson's own words", () => {
    const words = buildLessonVocabulary({
      words: [{ vocabulary: "sun", definition: { th: "พระอาทิตย์", en: "the star" } }],
    });
    expect(words).toEqual([{ id: "word-0", term: "sun", translation: "พระอาทิตย์" }]);
  });

  it("drops a word with no meaning of its own, so no tile matches itself", () => {
    const words = buildLessonVocabulary({
      words: [
        { vocabulary: "alpha", translation: "alpha" },
        { vocabulary: "beta" },
        { vocabulary: "Gamma", translation: " gamma " },
        { vocabulary: "delta", translation: "delta", definition: { en: "fourth letter" } },
      ],
    });
    expect(words).toEqual([{ id: "word-3", term: "delta", translation: "fourth letter" }]);
  });

  it("lists a repeated word once", () => {
    const words = buildLessonVocabulary({
      words: [
        { vocabulary: "constituent", translation: "ส่วนประกอบ" },
        { vocabulary: " Constituent ", translation: "ส่วนประกอบ" },
      ],
    });
    expect(words).toHaveLength(1);
  });

  it("never invents words for an empty lesson", () => {
    expect(buildLessonVocabulary({ words: [] })).toEqual([]);
    expect(buildLessonVocabulary(null)).toEqual([]);
  });
});

describe("hasUsableVocabulary", () => {
  const word = (term: string, translation: string) => ({ term, translation });

  it("needs two meanings that read differently", () => {
    expect(hasUsableVocabulary([])).toBe(false);
    expect(hasUsableVocabulary([word("sun", "พระอาทิตย์")])).toBe(false);
    expect(hasUsableVocabulary([word("idiom", "สำนวน"), word("expression", " สำนวน")])).toBe(false);
    expect(hasUsableVocabulary([word("sun", "พระอาทิตย์"), word("moon", "พระจันทร์")])).toBe(true);
  });
});

describe("buildLessonSentences", () => {
  const sentences = [
    { sentences: "A comedian is funny.", audioUrl: "https://example.test/0.mp3" },
    { sentences: "Comedians tell jokes." },
  ];

  it("takes real Thai by position when it lines up", () => {
    const items = buildLessonSentences({
      sentences,
      translated_passage: { th: ["1. นักแสดงตลกเป็นคนตลก", "นักแสดงตลกเล่าเรื่องตลก"] },
    });
    expect(items[0]).toMatchObject({
      term: "A comedian is funny.",
      translation: "นักแสดงตลกเป็นคนตลก",
      thaiTranslation: "นักแสดงตลกเป็นคนตลก",
      audioUrl: "https://example.test/0.mp3",
    });
    expect(items[1].thaiTranslation).toBe("นักแสดงตลกเล่าเรื่องตลก");
  });

  it("ignores stored Thai of a different length, which could be on the wrong sentence", () => {
    const items = buildLessonSentences({ sentences, translated_passage: { th: ["ประโยคเดียว"] } });
    expect(items.every((item) => item.thaiTranslation === undefined)).toBe(true);
  });

  it("leaves thaiTranslation empty rather than showing non-Thai as Thai", () => {
    const [item] = buildLessonSentences({ sentences: ["We read together"], translated_passage: { th: ["We read"] } });
    expect(item.thaiTranslation).toBeUndefined();
    expect(item.translation).toBe("We read together");
  });

  it("uses a sentence's own Thai first", () => {
    const [item] = buildLessonSentences({
      sentences: [{ sentence: "I see the sun", translation: "ฉันเห็นพระอาทิตย์" }],
      translated_passage: { th: ["ข้อความอื่น"] },
    });
    expect(item.thaiTranslation).toBe("ฉันเห็นพระอาทิตย์");
  });

  it("keeps Thai on the right sentence when a one-word sentence is dropped", () => {
    const items = buildLessonSentences({
      sentences: ["Wow!", "We read together"],
      translated_passage: { th: ["ว้าว", "เราอ่านด้วยกัน"] },
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ term: "We read together", thaiTranslation: "เราอ่านด้วยกัน" });
  });

  it("never invents sentences for an empty lesson", () => {
    expect(hasUsableSentences(buildLessonSentences({ sentences: [] }))).toBe(false);
    expect(hasUsableSentences(buildLessonSentences({ sentences: ["Go"] }))).toBe(false);
  });
});

describe("repeatThinSentences", () => {
  const item = (term: string, id: string) => ({ id, term, translation: term });

  it("repeats the lesson's own sentences until a round has words to spend", () => {
    const repeated = repeatThinSentences([item("I see the sun", "s1")]);
    expect(repeated).toHaveLength(6);
    expect(new Set(repeated.map((sentence) => sentence.term))).toEqual(new Set(["I see the sun"]));
    expect(new Set(repeated.map((sentence) => sentence.id)).size).toBe(6);
  });

  it("leaves a normal lesson alone", () => {
    const long = Array.from({ length: 5 }, (_, i) => item("one two three four five", `s${i}`));
    expect(repeatThinSentences(long)).toBe(long);
    expect(repeatThinSentences([])).toEqual([]);
  });
});

describe("hasThaiText", () => {
  it("spots Thai letters", () => {
    expect(hasThaiText("แมว")).toBe(true);
    expect(hasThaiText("cat 123")).toBe(false);
    expect(hasThaiText(undefined)).toBe(false);
  });
});
