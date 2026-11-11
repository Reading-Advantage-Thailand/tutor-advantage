import { describe, expect, it } from "vitest";
import { DEMO_ORDER_MAX_WORDS, demoOrders, walkthroughOrders } from "./demoContent";

const sentence = (words: number, tag = "") => ({ term: Array.from({ length: words }, (_, i) => `w${i}${tag}`).join(" ") });

describe("demoOrders", () => {
  it("deals only the short sentences when the lesson has enough of them", () => {
    const lesson = [sentence(31), sentence(6), sentence(16), sentence(9), sentence(10), sentence(12)];
    const orders = demoOrders(lesson);
    expect(orders.map((o) => o.term.split(" ").length)).toEqual([6, 9, 10]);
    expect(orders.every((o) => o.term.split(" ").length <= DEMO_ORDER_MAX_WORDS)).toBe(true);
  });

  it("falls back to the shortest few on a lesson of long sentences", () => {
    const lesson = [sentence(39), sentence(16), sentence(22), sentence(18), sentence(8)];
    expect(demoOrders(lesson).map((o) => o.term.split(" ").length)).toEqual([8, 16, 18]);
  });

  it("keeps a lesson's only sentences and skips ones with no words", () => {
    expect(demoOrders([sentence(19, "a"), { term: " - " }, sentence(18, "b")]).map((o) => o.term.split(" ").length)).toEqual([18, 19]);
    expect(demoOrders([])).toEqual([]);
  });
});

describe("walkthroughOrders", () => {
  it("walks through a sentence of 4-7 words rather than a two-word one", () => {
    const lesson = [sentence(2), sentence(9), sentence(5), sentence(3), sentence(7)];
    expect(walkthroughOrders(lesson).map((o) => o.term.split(" ").length)).toEqual([5, 7]);
  });

  it("uses whatever the lesson has when no sentence is 4-7 words", () => {
    const lesson = [sentence(2), sentence(12)];
    expect(walkthroughOrders(lesson)).toEqual(lesson);
  });
});
