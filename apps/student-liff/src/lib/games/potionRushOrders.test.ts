import { describe, expect, it } from "vitest";

import {
  beltLabel,
  countWordsNeeded,
  freeBeltX,
  nextWordDelay,
  orderWords,
  patienceForOrder,
  pickBeltWord,
  pickFocusSlot,
  pickOrderSentence,
  resolveDropZone,
  wordKey,
  wordsMissingFromBelt,
} from "./potionRushOrders";

const waiting = (term: string, patience = 30) => ({ state: "WAITING", patience, request: { term } });
const idle = { state: "IDLE", currentWords: [] as string[] };
const brewing = (...currentWords: string[]) => ({ state: "BREWING", currentWords });
const LAYOUT = { trashX: 195, trashY: 620 };
const at = (x: number, y: number) => ({ x, y });

describe("order words", () => {
  it("treats capitals and end punctuation as the same word", () => {
    expect(wordKey("Friends.")).toBe("friends");
    expect(wordKey("friends")).toBe("friends");
    expect(wordKey('"Hello,')).toBe("hello");
    expect(wordKey("don't")).toBe("don't");
  });

  it("drops tokens with no letter or digit and copes with double spaces", () => {
    expect(orderWords("  We  learn - words. ")).toEqual(["We", "learn", "words."]);
  });
});

describe("belt labels", () => {
  it("hides what would give away the first and last word", () => {
    expect(beltLabel("The", true)).toBe("the");
    expect(beltLabel("friends.", false)).toBe("friends");
    expect(beltLabel("Now,", true)).toBe("now");
  });

  it("keeps capitals that belong to the word", () => {
    expect(beltLabel("I", true)).toBe("I");
    expect(beltLabel("I'm", true)).toBe("I'm");
    expect(beltLabel("NASA", true)).toBe("NASA");
    expect(beltLabel("Kaelen", false)).toBe("Kaelen");
  });
});

describe("patience", () => {
  it("gives a longer sentence longer, and a short one enough to read it", () => {
    expect(patienceForOrder("Go home")).toBe(25);
    expect(patienceForOrder("one two three four five six seven eight")).toBe(56);
  });
});

describe("words missing from the belt", () => {
  it("offers a word again as soon as it is no longer on the belt", () => {
    const customers = [waiting("We learn words"), null, null];
    const cauldrons = [idle, idle, idle];
    expect(wordsMissingFromBelt(customers, cauldrons, ["we", "learn", "words"])).toEqual({ nextWords: [], laterWords: [] });
    expect(wordsMissingFromBelt(customers, cauldrons, ["learn", "words"]).nextWords).toEqual([
      { word: "We", isFirstWord: true },
    ]);
  });

  it("skips words already in the pot", () => {
    const supply = wordsMissingFromBelt([waiting("We learn words"), null, null], [brewing("We"), idle, idle], []);
    expect(supply.nextWords).toEqual([{ word: "learn", isFirstWord: false }]);
    expect(supply.laterWords).toEqual([{ word: "words", isFirstWord: false }]);
  });

  it("counts a shared word once per customer who needs it", () => {
    const supply = wordsMissingFromBelt(
      [waiting("the cat"), waiting("the dog"), null],
      [idle, idle, idle],
      ["the", "cat", "dog"],
    );
    expect(supply.nextWords).toEqual([{ word: "the", isFirstWord: true }]);
  });

  it("gives the belt's copy to the word needed now before a later one", () => {
    const supply = wordsMissingFromBelt(
      [waiting("big cat"), waiting("cat food"), null],
      [idle, idle, idle],
      ["cat", "big", "food"],
    );
    expect(supply.nextWords).toEqual([]);
    expect(supply.laterWords).toEqual([{ word: "cat", isFirstWord: false }]);
  });

  it("ignores customers who are leaving", () => {
    const leaving = { ...waiting("We learn"), state: "LEAVING_ANGRY" };
    expect(wordsMissingFromBelt([leaving, null, null], [idle, idle, idle], [])).toEqual({ nextWords: [], laterWords: [] });
    expect(countWordsNeeded([leaving, waiting("a b c"), null], [idle, brewing("a"), idle])).toBe(2);
  });
});

describe("picking the belt word", () => {
  const supply = {
    nextWords: [{ word: "now", isFirstWord: false }],
    laterWords: [{ word: "later", isFirstWord: false }],
  };

  it("takes the needed word when asked to", () => {
    expect(pickBeltWord(supply, true, () => 0.99)?.word).toBe("now");
  });

  it("draws from everything otherwise, and has nothing to give when all is out", () => {
    expect(pickBeltWord(supply, false, () => 0.99)?.word).toBe("later");
    expect(pickBeltWord({ nextWords: [], laterWords: [] }, true)).toBeNull();
  });
});

describe("picking the next sentence", () => {
  const sentences = [{ term: "a b" }, { term: "c d" }, { term: "e f" }];

  it("never seats two customers with the same sentence while another is free", () => {
    expect(pickOrderSentence(sentences, ["a b", "c d"], ["a b", "c d"], () => 0)?.term).toBe("e f");
  });

  it("prefers a sentence this round has not used", () => {
    expect(pickOrderSentence(sentences, ["e f"], ["a b", "e f"], () => 0)?.term).toBe("c d");
  });

  it("repeats a used sentence rather than leaving the slot empty", () => {
    expect(pickOrderSentence(sentences, ["a b"], ["a b", "c d", "e f"], () => 0)?.term).toBe("c d");
    expect(pickOrderSentence([{ term: "only one" }], ["only one"], ["only one"])?.term).toBe("only one");
    expect(pickOrderSentence([], [], [])).toBeNull();
  });
});

describe("banner focus", () => {
  it("stays on a waiting customer even if another has less patience", () => {
    expect(pickFocusSlot(1, [waiting("a b", 5), waiting("c d", 20), null])).toBe(1);
  });

  it("stays while the customer is being served, so the finished sentence can be read", () => {
    const served = { ...waiting("a b"), state: "LEAVING_HAPPY" };
    expect(pickFocusSlot(0, [served, waiting("c d"), null])).toBe(0);
  });

  it("moves to the least patient customer when its own is gone", () => {
    expect(pickFocusSlot(2, [waiting("a b", 20), waiting("c d", 5), null])).toBe(1);
    expect(pickFocusSlot(0, [null, null, null])).toBe(0);
  });
});

describe("putting a word back on the belt", () => {
  it("stays put when there is room", () => {
    expect(freeBeltX(200, [50, 400])).toBe(200);
  });

  it("moves up past any word it would land on", () => {
    expect(freeBeltX(200, [180])).toBe(280);
    expect(freeBeltX(200, [280, 180, 380])).toBe(480);
  });
});

describe("word spacing", () => {
  it("adds room after a long label only", () => {
    expect(nextWordDelay(1, "the", 100)).toBe(1);
    expect(nextWordDelay(1, "immediately", 100)).toBeCloseTo(1.27);
  });
});

describe("drop zones", () => {
  const zone = (item: { x: number; y: number }, finger = item) => resolveDropZone(item, finger, 390, LAYOUT);

  it("accepts the whole pot, including its opening and rim", () => {
    expect(zone(at(65, 325))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(65, 345))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(65, 380))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(325, 455))).toEqual({ kind: "pot", slot: 2 });
  });

  it("takes a word held over a customer as meant for their pot", () => {
    expect(zone(at(195, 200))).toEqual({ kind: "pot", slot: 1 });
  });

  it("does not put a word low on the screen into a pot", () => {
    expect(zone(at(85, 580))).toEqual({ kind: "none" });
    expect(zone(at(85, 510))).toEqual({ kind: "hold", slot: 0 });
    expect(zone(at(305, 560))).toEqual({ kind: "hold", slot: 2 });
  });

  it("finds the trash and the belt", () => {
    expect(zone(at(195, 620))).toEqual({ kind: "trash" });
    expect(zone(at(60, 720))).toEqual({ kind: "belt" });
  });

  it("goes by the word as drawn, and by the finger when the word is over nothing", () => {
    expect(zone(at(65, 440), at(65, 480))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(65, 40), at(65, 130))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(30, 600), at(30, 640))).toEqual({ kind: "none" });
  });

  it("uses the nearest pot for a drop past the edge of the scene", () => {
    expect(zone(at(-20, 380))).toEqual({ kind: "pot", slot: 0 });
    expect(zone(at(420, 380))).toEqual({ kind: "pot", slot: 2 });
  });
});
