import { describe, expect, it } from "vitest";
import { formatRankOf, getRankMeta, getWrapUpCelebration } from "./rankMeta";

describe("getRankMeta", () => {
  it("gives medals and distinct tones to the podium", () => {
    expect(getRankMeta(1)).toMatchObject({ rank: 1, hasRank: true, emoji: "🥇", tone: "amber", label: "อันดับ 1" });
    expect(getRankMeta(2)).toMatchObject({ emoji: "🥈", tone: "blue", label: "อันดับ 2" });
    expect(getRankMeta(3)).toMatchObject({ emoji: "🥉", tone: "pink", label: "อันดับ 3" });
  });

  it("uses the number (no medal) after the podium", () => {
    expect(getRankMeta(7)).toMatchObject({ rank: 7, hasRank: true, emoji: null, tone: "neutral", label: "อันดับ 7" });
  });

  it("treats missing, zero, negative and NaN ranks as no rank", () => {
    for (const value of [undefined, null, 0, -1, Number.NaN]) {
      expect(getRankMeta(value)).toMatchObject({ rank: 0, hasRank: false, emoji: null, label: "" });
    }
  });

  it("keeps the wrap-up celebration titles", () => {
    expect(getRankMeta(1).title).toBe("ชนะเลิศอันดับ 1!");
    expect(getRankMeta(2).title).toBe("รองชนะเลิศอันดับ 1");
    expect(getRankMeta(3).title).toBe("รองชนะเลิศอันดับ 2");
    expect(getRankMeta(4).title).toBe(getRankMeta(0).title);
  });
});

describe("formatRankOf", () => {
  it("shows the class size only when it is known", () => {
    expect(formatRankOf(2, 4)).toBe("2/4");
    expect(formatRankOf(2, 0)).toBe("2");
    expect(formatRankOf(2, undefined)).toBe("2");
  });
});

describe("getWrapUpCelebration", () => {
  it("crowns rank 1 with a score: champion copy and a big burst", () => {
    const c = getWrapUpCelebration({ rank: 1, score: 40, total: 5 });
    expect(c).toMatchObject({ tier: "champion", title: "ชนะเลิศอันดับ 1!", confetti: "big" });
    expect(c.subtitle).toBe("อันดับที่ 1 จากนักเรียนทั้งหมด 5 คน");
  });

  it("says shared first place when tied at the top", () => {
    const c = getWrapUpCelebration({ rank: 1, score: 40, total: 5, tied: true });
    expect(c).toMatchObject({ tier: "champion", title: "ชนะเลิศร่วมกัน!", confetti: "big" });
    expect(c.subtitle).toContain("คะแนนเท่ากับเพื่อน");
  });

  it("gives ranks 2–3 podium medals and a big burst", () => {
    expect(getWrapUpCelebration({ rank: 2, score: 10, total: 5 })).toMatchObject({ tier: "podium", emoji: "🥈", title: "รองชนะเลิศอันดับ 1", confetti: "big" });
    expect(getWrapUpCelebration({ rank: 3, score: 10, total: 5 })).toMatchObject({ tier: "podium", emoji: "🥉", confetti: "big" });
  });

  it("says great job (medium burst) in the upper half after the podium", () => {
    expect(getWrapUpCelebration({ rank: 4, score: 5, total: 8 })).toMatchObject({ tier: "upperHalf", title: "ทำได้ดีมาก!", confetti: "medium" });
    expect(getWrapUpCelebration({ rank: 5, score: 5, total: 9 })).toMatchObject({ tier: "upperHalf" });
  });

  it("encourages (no winner wording) in the lower half, with a small burst", () => {
    const c = getWrapUpCelebration({ rank: 6, score: 5, total: 9 });
    expect(c).toMatchObject({ tier: "keepGoing", title: "เก่งขึ้นทุกครั้ง!", subtitle: "ครั้งหน้าลุยใหม่นะ สู้ ๆ!", confetti: "small" });
  });

  it("never celebrates a win with 0 points, even when last or 'first' by default", () => {
    for (const rank of [1, 2, 3, 4]) {
      const c = getWrapUpCelebration({ rank, score: 0, total: 4 });
      expect(c).toMatchObject({ tier: "noScore", emoji: "🌱", confetti: "small" });
      expect(c.title).not.toBe("ทำได้ดีมาก!");
      expect(c.title).not.toContain("ชนะ");
    }
  });

  it("has a gentle message when nobody scored", () => {
    expect(getWrapUpCelebration({ rank: 1, score: 0, total: 4, allTied: true })).toMatchObject({ tier: "noScoresYet", confetti: "small" });
  });

  it("calls a non-zero all-way tie a draw, not a win", () => {
    expect(getWrapUpCelebration({ rank: 1, score: 20, total: 3, tied: true, allTied: true })).toMatchObject({ tier: "allTied", title: "เสมอกันทั้งห้อง!", confetti: "medium" });
  });

  it("still celebrates finishing when the student is not ranked", () => {
    expect(getWrapUpCelebration({ rank: 0, score: 0, total: 3 })).toMatchObject({ tier: "unranked", confetti: "small" });
  });
});
