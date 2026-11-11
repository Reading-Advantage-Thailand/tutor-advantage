import { describe, expect, it } from "vitest";

import {
  AUTO_BUILD_MS,
  WRONG_GRACE_MS,
  WRONG_HIT_RADIUS,
  advanceCastleDefenseTime,
  MAX_ORBS_IN_PLAY,
  castleCue,
  createCastleDefenseState,
  edgeChipsForWords,
  orbKeepOuts,
  parseSentenceWords,
  shuffleForClass,
  spawnSentenceWords,
  wordsInPlay,
  type CastleDefenseState,
  type Word,
} from "./castleDefense";

const sentences = [
  { term: "one two three four", translation: "a" },
  { term: "five six seven eight", translation: "b" },
  { term: "nine ten eleven twelve", translation: "c" },
];
const IDLE = { dx: 0, dy: 0 };
const BUILD = { dx: 0, dy: 0, drop: true };
const TWELVE = "The quick brown fox jumps over a lazy dog near old river";

const newRound = (wordBudget?: number) =>
  createCastleDefenseState(sentences, { difficulty: "medium", durationMs: 60_000, wordBudget });

const wordAt = (state: CastleDefenseState, sentenceIndex: number): Word => {
  const word = state.words.find((w) => w.sentenceIndex === sentenceIndex);
  if (!word) throw new Error(`no word ${sentenceIndex}`);
  return word;
};

const pos = (word: { x: number; y: number }) => ({ x: word.x, y: word.y });

/** One tick with the wizard placed at this spot, as if it had walked there. */
const tickAt = (
  state: CastleDefenseState,
  at: { x: number; y: number },
  input: { dx: number; dy: number; drop?: boolean } = IDLE,
  list = sentences,
) => advanceCastleDefenseTime({ ...state, player: { ...state.player, ...pos(at) } }, 16, input, list);

const idle = (state: CastleDefenseState, ms: number) => {
  let next = state;
  for (let t = 0; t < ms; t += 50) next = advanceCastleDefenseTime(next, 50, IDLE, sentences);
  return next;
};

const finishSentence = (state: CastleDefenseState) => {
  let next = state;
  next.sentenceWords.forEach((_, index) => {
    next = tickAt(next, wordAt(next, index));
  });
  return next;
};

describe("orb layout", () => {
  it("does not give the sentence order away", () => {
    const firstX: number[] = [];
    const lastX: number[] = [];
    let readingOrder = 0;
    for (let round = 0; round < 400; round++) {
      const words = spawnSentenceWords(TWELVE);
      firstX.push(words[0].x);
      lastX.push(words[11].x);
      const byPosition = [...words].sort((a, b) => a.y - b.y || a.x - b.x).map((w) => w.sentenceIndex);
      if (byPosition.every((index, i) => index === i)) readingOrder += 1;
    }
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(Math.abs(mean(firstX) - mean(lastX))).toBeLessThan(40);
    expect(new Set(firstX.map((x) => Math.round(x / 100))).size).toBeGreaterThan(3);
    expect(readingOrder).toBe(0);
  });

  it("leaves room to walk between the orbs of a 12 word sentence", () => {
    const state = newRound();
    const keepOuts = orbKeepOuts(state.player, state.towerSlots);
    let tooClose = 0;
    let onKeepOut = 0;
    for (let round = 0; round < 200; round++) {
      const words = spawnSentenceWords(TWELVE, Math.random, keepOuts);
      words.forEach((a, i) => {
        words.slice(i + 1).forEach((b) => {
          // The wizard fits between two wrong orbs at 80 apart.
          if (Math.hypot(a.x - b.x, a.y - b.y) < 80) tooClose += 1;
        });
        if (keepOuts.some((k) => Math.hypot(a.x - k.x, a.y - k.y) < k.clearance - 12)) onKeepOut += 1;
      });
    }
    expect(tooClose).toBe(0);
    expect(onKeepOut).toBe(0);
  });

  it("never drops a new sentence on the wizard", () => {
    let state = finishSentence(newRound());
    state = tickAt(state, state.towerSlots[2]);
    expect(state.towers).toHaveLength(1);
    for (const word of state.words) {
      expect(Math.hypot(word.x - state.player.x, word.y - state.player.y)).toBeGreaterThan(90);
    }
  });
});

describe("orbs in play", () => {
  const list = [{ term: TWELVE, translation: "x" }];
  const round = () => createCastleDefenseState(list, { difficulty: "medium", durationMs: 60_000 });
  const inPlay = (state: CastleDefenseState) =>
    wordsInPlay(state.words, state.sentenceWords, state.collectedWordIndices).map((w) => w.sentenceIndex);

  it("puts out the next word and the few after it", () => {
    let state = round();
    expect(inPlay(state)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(MAX_ORBS_IN_PLAY).toBe(6);
    state = tickAt(state, wordAt(state, 0), IDLE, list);
    expect(inPlay(state)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("does nothing for an orb that is not out yet", () => {
    let state = round();
    state = tickAt(state, wordAt(state, 9), IDLE, list);
    expect(state.incorrectWordCollections).toBe(0);
    expect(state.lastWrongHit).toBeNull();
  });

  it("does not count an orb that comes out under the wizard", () => {
    let state = round();
    const later = wordAt(state, 6);
    state = {
      ...state,
      words: state.words.map((w) => (w.id === later.id ? { ...w, x: wordAt(state, 0).x + 10, y: wordAt(state, 0).y } : w)),
    };
    state = tickAt(state, wordAt(state, 0), IDLE, list);
    expect(state.collectedWordIndices).toEqual([0]);
    state = tickAt(state, state.player, IDLE, list);
    expect(state.incorrectWordCollections).toBe(0);
  });

  it("always shows the next word, even when later copies were picked up first", () => {
    const words = spawnSentenceWords("a b c d e f g h a i");
    const state = words.map((w, i) => (i === 8 ? { ...w, isCollected: true } : w));
    // Next is the second "a", held by the first orb.
    expect(wordsInPlay(state, parseSentenceWords("a b c d e f g h a i"), [0, 1, 2, 3, 4, 5, 6, 7]).map((w) => w.term)).toContain("a");

    const crowded = spawnSentenceWords("a b c d e f g h");
    expect(wordsInPlay(crowded, ["h"], []).map((w) => w.term)).toContain("h");
  });
});

describe("touching a word", () => {
  it("counts a wrong word once however long the wizard stays on it", () => {
    let state = newRound();
    const hit = wordAt(state, 2);
    state = tickAt(state, hit);
    expect(state.incorrectWordCollections).toBe(1);

    for (let frame = 0; frame < 120; frame++) state = tickAt(state, hit);
    expect(state.incorrectWordCollections).toBe(1);
  });

  it("counts it again only after stepping off", () => {
    let state = newRound();
    const hit = wordAt(state, 2);
    state = tickAt(state, hit);
    state = idle(state, WRONG_GRACE_MS + 100);
    state = tickAt(state, { x: hit.x + 200, y: hit.y + 200 });
    state = tickAt(state, hit);
    expect(state.incorrectWordCollections).toBe(2);
  });

  it("bounces the wizard off a first bump and costs no word", () => {
    let state = newRound(12);
    state = tickAt(state, wordAt(state, 0));
    state = tickAt(state, wordAt(state, 1));

    const hit = wordAt(state, 3);
    state = tickAt(state, { x: hit.x + 30, y: hit.y });
    expect(state.collectedWordIndices).toEqual([0, 1]);
    expect(state.lastWrongHit).toMatchObject({ wordId: hit.id, lostWord: false });

    const startX = state.player.x;
    state = idle(state, 300);
    expect(state.player.x).toBeGreaterThan(startX + 30);
    expect(state.bounce).toBeNull();
  });

  it("takes back one word on a second bump and keeps the orbs where they were", () => {
    let state = newRound(12);
    state = tickAt(state, wordAt(state, 0));
    state = tickAt(state, wordAt(state, 1));
    const before = state.words.map((w) => ({ id: w.id, x: w.x, y: w.y }));
    const hit = wordAt(state, 3);

    state = tickAt(state, hit);
    state = tickAt({ ...state, wrongGraceUntil: 0, touchingWordIds: [] }, hit);
    expect(state.incorrectWordCollections).toBe(2);
    expect(state.collectedWordIndices).toEqual([0]);
    expect(state.lastWrongHit).toMatchObject({ wordId: hit.id, lostWord: true });
    expect(wordAt(state, 1).isCollected).toBe(false);
    expect(wordAt(state, 0).isCollected).toBe(true);
    expect(state.words.map((w) => ({ id: w.id, x: w.x, y: w.y }))).toEqual(before);
    expect(state.sentenceHighMark).toBe(2);
  });

  it("gives a new free bump after each right word", () => {
    let state = newRound(12);
    state = tickAt(state, wordAt(state, 0));
    state = tickAt(state, wordAt(state, 3));
    expect(state.bumpedSinceLastWord).toBe(true);
    state = tickAt(state, wordAt(state, 1));
    expect(state.bumpedSinceLastWord).toBe(false);
    state = tickAt({ ...state, wrongGraceUntil: 0, touchingWordIds: [] }, wordAt(state, 3));
    expect(state.collectedWordIndices).toEqual([0, 1]);
  });

  it("has nothing to take back at the start of a sentence", () => {
    let state = newRound();
    const hit = wordAt(state, 2);
    state = tickAt(state, hit);
    state = tickAt({ ...state, wrongGraceUntil: 0, touchingWordIds: [] }, hit);
    expect(state.collectedWordIndices).toEqual([]);
    expect(state.lastWrongHit?.lostWord).toBe(false);
  });

  it("gets nowhere by trying every orb in turn", () => {
    let state = newRound(100);
    state = tickAt(state, wordAt(state, 0));
    state = tickAt(state, wordAt(state, 1));
    for (const index of [3, 3, 3]) {
      state = tickAt({ ...state, wrongGraceUntil: 0, touchingWordIds: [] }, wordAt(state, index));
    }
    expect(state.collectedWordIndices).toEqual([]);
    expect(state.sentenceHighMark).toBe(2);
  });

  it("does not charge a second wrong word during the grace period, even when the grace ends", () => {
    let state = newRound();
    state = tickAt(state, wordAt(state, 2));
    const other = wordAt(state, 3);
    state = tickAt(state, other);
    expect(state.incorrectWordCollections).toBe(1);

    state = tickAt({ ...state, wrongGraceUntil: 0, bounce: null }, other);
    expect(state.incorrectWordCollections).toBe(1);
  });

  it("is forgiving on the next word and strict on any other", () => {
    const list = [{ term: "international business", translation: "x" }];
    const round = () => createCastleDefenseState(list, { difficulty: "medium", durationMs: 60_000 });

    let state = round();
    const next = wordAt(state, 0);
    expect(next.radius).toBe(42);
    state = tickAt(state, { x: next.x, y: next.y + next.radius + state.player.radius - 2 }, IDLE, list);
    expect(state.collectedWordIndices).toEqual([0]);

    state = round();
    const reach = state.player.radius + WRONG_HIT_RADIUS;
    const wrong = wordAt(state, 1);
    state = tickAt(state, { x: wrong.x, y: wrong.y + reach + 1 }, IDLE, list);
    expect(state.incorrectWordCollections).toBe(0);
    state = tickAt(state, { x: wrong.x, y: wrong.y + reach - 1 }, IDLE, list);
    expect(state.incorrectWordCollections).toBe(1);
  });

  it.each([
    ["Run run fast", 0, 1],
    ["very, very good", 0, 1],
    ["In the end, the candidate wins", 1, 3],
  ])("accepts the other copy of a repeated word in %s", (sentence, before, laterCopy) => {
    const list = [{ term: sentence, translation: "x" }];
    let state = createCastleDefenseState(list, { difficulty: "medium", durationMs: 60_000 });
    for (let index = 0; index < before; index++) state = tickAt(state, wordAt(state, index), IDLE, list);

    state = tickAt(state, wordAt(state, laterCopy), IDLE, list);
    expect(state.incorrectWordCollections).toBe(0);
    expect(state.collectedWordIndices).toEqual(Array.from({ length: before + 1 }, (_, i) => i));
    expect(wordAt(state, laterCopy).isCollected).toBe(true);

    // The sentence can still be finished, with every place filled once.
    const total = parseSentenceWords(sentence).length;
    for (let guard = 0; guard < total && !state.sentenceCompleted; guard++) {
      const expected = state.sentenceWords[state.collectedWordIndices.length].toLowerCase();
      const orb = state.words.find((w) => !w.isCollected && w.term.toLowerCase() === expected);
      if (!orb) throw new Error("no orb for the next word");
      state = tickAt(state, orb, IDLE, list);
    }
    expect(state.sentenceCompleted).toBe(true);
    expect(state.incorrectWordCollections).toBe(0);
  });
});

describe("building a tower", () => {
  it("BUILD does nothing until the sentence is finished", () => {
    const state = advanceCastleDefenseTime(newRound(), 16, BUILD, sentences);
    expect(state.towers).toHaveLength(0);
  });

  it("BUILD builds at the nearest free ring from anywhere and moves to the next sentence", () => {
    let state = finishSentence(newRound());
    expect(state.sentenceCompleted).toBe(true);
    const near = state.towerSlots[0];
    state = tickAt(state, { x: near.x + 60, y: near.y + 60 }, BUILD);
    expect(state.towers.map((t) => t.id)).toEqual([`tower-${near.id}`]);
    expect(state.sentenceCompleted).toBe(false);
    expect(state.currentSentenceEnglish).toBe(sentences[1].term);
  });

  it("still builds by walking onto a ring", () => {
    let state = finishSentence(newRound());
    state = tickAt(state, state.towerSlots[1]);
    expect(state.towers).toHaveLength(1);
  });

  it("builds by itself a moment after the sentence ends, so the round cannot get stuck", () => {
    let state = finishSentence(newRound());
    state = { ...state, player: { ...state.player, x: 400, y: 20 } };
    state = idle(state, AUTO_BUILD_MS - 200);
    expect(state.towers).toHaveLength(0);
    state = idle(state, 300);
    expect(state.towers).toHaveLength(1);
    expect(state.sentenceCompleted).toBe(false);
  });

  it("moves straight to the next sentence when every ring has a tower", () => {
    let state = finishSentence(newRound(100));
    state = tickAt(state, state.towerSlots[0]);
    state = { ...state, towerSlots: state.towerSlots.slice(0, 1) };
    const banked = state.bankedWords;
    state = finishSentence(state);
    expect(state.sentenceCompleted).toBe(false);
    expect(state.towers).toHaveLength(1);
    expect(state.collectedWordIndices).toEqual([]);
    expect(state.currentSentenceEnglish).toBe(sentences[2].term);
    expect(state.bankedWords).toBe(banked + 4);
    expect(state.completedSentences).toBe(2);
  });
});

describe("a new wave", () => {
  const clearWave = (state: CastleDefenseState) => ({
    ...state,
    enemies: [],
    enemiesSpawnedThisWave: state.totalEnemiesThisWave,
  });

  it("keeps the towers, the map, the castle and the sentence in progress", () => {
    let state = finishSentence(newRound(100));
    state = tickAt(state, state.towerSlots[0]);
    state = tickAt(state, wordAt(state, 0));
    const before = state;
    state = idle(clearWave(state), 2_200);

    expect(state.wave).toBe(2);
    expect(state.towers.map((t) => t.id)).toEqual(before.towers.map((t) => t.id));
    expect(state.path).toBe(before.path);
    expect(state.towerSlots).toBe(before.towerSlots);
    expect(state.base.x).toBe(before.base.x);
    expect(state.base.y).toBe(before.base.y);
    expect(state.currentSentenceEnglish).toBe(before.currentSentenceEnglish);
    expect(state.collectedWordIndices).toEqual([0]);
    expect(state.words.map((w) => w.id)).toEqual(before.words.map((w) => w.id));
    expect(state.totalEnemiesThisWave).toBe(12);
    expect(state.waveResult).toBeNull();
  });

  it("says whether the castle was hit during the wave", () => {
    let state = advanceCastleDefenseTime(clearWave(newRound()), 50, IDLE, sentences);
    expect(state.waveResult).toEqual({ wave: 1, breached: false });

    state = clearWave(newRound());
    state = { ...state, base: { ...state.base, hp: state.base.hp - 10 } };
    state = advanceCastleDefenseTime(state, 50, IDLE, sentences);
    expect(state.waveResult).toEqual({ wave: 1, breached: true });
  });
});

describe("shuffleForClass", () => {
  const list = Array.from({ length: 20 }, (_, i) => ({ term: `sentence number ${i}` }));

  it("gives every student in a class the same order", () => {
    const byTerm = (a: { term: string }, b: { term: string }) => a.term.localeCompare(b.term);
    expect(shuffleForClass(list)).toEqual(shuffleForClass([...list]));
    expect(shuffleForClass(list)).not.toEqual(list);
    expect(shuffleForClass(list).sort(byTerm)).toEqual([...list].sort(byTerm));
  });

  it("plays the round's sentences in order", () => {
    let state = newRound();
    expect(state.currentSentenceEnglish).toBe(sentences[0].term);
    state = finishSentence(state);
    state = tickAt(state, state.towerSlots[0]);
    expect(state.currentSentenceEnglish).toBe(sentences[1].term);
  });
});

describe("castleCue", () => {
  it("names what just happened", () => {
    const start = newRound(100);
    const afterWord = tickAt(start, wordAt(start, 0));
    expect(castleCue(start, afterWord)).toBe("word");
    expect(castleCue(afterWord, tickAt(afterWord, wordAt(afterWord, 2)))).toBe("wrong");

    let almost = tickAt(afterWord, wordAt(afterWord, 1));
    almost = tickAt(almost, wordAt(almost, 2));
    const done = tickAt(almost, wordAt(almost, 3));
    expect(castleCue(almost, done)).toBe("sentence");
    expect(castleCue(done, tickAt(done, done.towerSlots[0]))).toBe("tower");
    expect(castleCue(done, done)).toBeNull();
  });
});

describe("edgeChipsForWords", () => {
  const word = (id: string, x: number, y: number, isCollected = false): Word => ({
    id,
    x,
    y,
    radius: 25,
    term: id,
    translation: id,
    isCorrect: true,
    isCollected,
  });
  const view = { width: 390, height: 844 };
  const camera = { x: -100, y: 200, scale: 0.8 }; // Shows world x 125 to 612.
  const insets = { insetTop: 140, insetBottom: 130 };

  it("shows only words the camera cannot show, on the side they are on", () => {
    const chips = edgeChipsForWords(
      [word("left", 60, 300), word("seen", 300, 300), word("right", 700, 300), word("taken", 700, 400, true)],
      { x: 300, y: 300 },
      camera,
      view,
      insets,
    );
    expect(chips.map((c) => [c.label, c.side]).sort()).toEqual([
      ["left", "left"],
      ["right", "right"],
    ]);
    expect(chips.find((c) => c.side === "left")?.x).toBe(0);
    expect(chips.find((c) => c.side === "right")?.x).toBe(390);
  });

  it("keeps the nearest few per side and never stacks them on each other", () => {
    const words = [350, 360, 370, 380].map((y, i) => word(`w${i}`, 60 + i, y));
    const chips = edgeChipsForWords(words, { x: 60, y: 350 }, camera, view, insets);
    expect(chips.map((c) => c.label).sort()).toEqual(["w0", "w1", "w2"]);
    const rows = chips.map((c) => c.y).sort((a, b) => a - b);
    expect(rows[1] - rows[0]).toBeGreaterThanOrEqual(26);
    expect(rows[2] - rows[1]).toBeGreaterThanOrEqual(26);
  });

  it("treats a word under the HUD as off-screen, because it cannot be read there", () => {
    const chips = edgeChipsForWords([word("hidden", 300, -20)], { x: 300, y: 300 }, camera, view, {
      insetTop: 200,
      insetBottom: 130,
    });
    expect(chips).toEqual([expect.objectContaining({ label: "hidden", side: "top", y: 200 })]);
  });

  it("treats a word behind the controls as off-screen", () => {
    const wide = { width: 768, height: 390 };
    const cam = { x: 0, y: -186, scale: 0.96 };
    const stick = { x: 12, y: 262, width: 128, height: 128 };
    const chips = edgeChipsForWords([word("behind", 100, 480), word("clear", 400, 480)], { x: 400, y: 500 }, cam, wide, {
      insetTop: 80,
      chipBottomLimit: 270,
      covered: [stick],
    });
    expect(chips).toEqual([expect.objectContaining({ label: "behind", side: "left", x: 0 })]);
    expect(chips[0].y).toBeLessThanOrEqual(270);
  });

  it("does not depend on which word is next", () => {
    const words = [word("a", 60, 300), word("b", 60, 400)];
    const chips = edgeChipsForWords(words, { x: 300, y: 300 }, camera, view, insets);
    expect(chips).toHaveLength(2);
    expect(Object.keys(chips[0]).sort()).toEqual(["id", "label", "side", "x", "y"]);
  });
});
