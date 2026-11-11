import { describe, expect, it } from "vitest";

import {
  advanceWizardZombieTime,
  buildRoundReview,
  CAUGHT_RESPAWN_MS,
  createWizardZombieState,
  INVULNERABILITY_DURATION,
  MAX_LIVE_ZOMBIES,
  MIN_ORB_DISTANCE,
  ORB_GRACE_MS,
  PICK_DISTANCE,
  RIGHT_ANSWER_CLEAR_RADIUS,
  uniqueWords,
  WRONG_PICK_PAUSE_MS,
  type Orb,
  type WizardZombieState,
  type Zombie,
} from "./wizardZombie";

const words = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `w${i}`, term: `word${i}`, translation: `ความหมาย${i}` }));
const TEN = words(10);
const STILL = { dx: 0, dy: 0, cast: false };

/** Puts the wizard on an orb, ready to pick it on the next step. */
const standOn = (state: WizardZombieState, orb: Orb): WizardZombieState => ({
  ...state,
  orbGraceMs: 0,
  player: { ...state.player, x: orb.x, y: orb.y },
});
const rightOrb = (state: WizardZombieState) => state.orbs.find((orb) => orb.isCorrect)!;
const wrongOrb = (state: WizardZombieState) => state.orbs.find((orb) => !orb.isCorrect)!;

const pickRight = (state: WizardZombieState, vocabulary = TEN) =>
  advanceWizardZombieTime(standOn(state, rightOrb(state)), 1, STILL, vocabulary);
const pickWrong = (state: WizardZombieState, vocabulary = TEN) =>
  advanceWizardZombieTime(standOn(state, wrongOrb(state)), 1, STILL, vocabulary);
const waitOutReveal = (state: WizardZombieState, vocabulary = TEN) =>
  advanceWizardZombieTime(state, WRONG_PICK_PAUSE_MS, STILL, vocabulary);

const zombieAt = (x: number, y: number, extra: Partial<Zombie> = {}): Zombie => ({
  id: `z-${x}-${y}`,
  x,
  y,
  radius: 15,
  speed: 0,
  damage: 10,
  ...extra,
});

describe("Wizard vs Zombie: what counts as correct", () => {
  it("a word found on the first try counts", () => {
    const next = pickRight(createWizardZombieState(TEN));
    expect(next.correctAnswers).toBe(1);
    expect(next.totalAttempts).toBe(1);
    expect(next.lastPick).toMatchObject({ isCorrect: true, isFirstTry: true });
  });

  it("a word found after a wrong pick does not count, and is still asked again", () => {
    const start = createWizardZombieState(words(2));
    const missedTerm = start.targetWord;
    const afterMiss = waitOutReveal(pickWrong(start, words(2)), words(2));
    expect(afterMiss.correctAnswers).toBe(0);

    // Answer the other word, then the missed one comes back.
    const afterOther = pickRight(afterMiss, words(2));
    expect(afterOther.correctAnswers).toBe(1);
    expect(afterOther.targetWord).toBe(missedTerm);

    const finished = pickRight(afterOther, words(2));
    expect(finished.correctAnswers).toBe(1);
    expect(finished.answeredWords).toHaveLength(2);
    expect(finished.lastPick).toMatchObject({ term: missedTerm, isCorrect: true, isFirstTry: false });
    expect(finished.status).toBe("gameover");
  });

  it("a perfect round reaches every word, even when the list repeats one", () => {
    const list = [...TEN, { id: "again", term: " WORD3 ", translation: "ความหมาย3" }];
    let state = createWizardZombieState(list);
    for (let i = 0; i < 10; i++) {
      expect(state.status).toBe("playing");
      state = pickRight(state, list);
    }
    expect(state.status).toBe("gameover");
    expect(state.correctAnswers).toBe(10);
  });

  it("uniqueWords keeps the first of a repeated word", () => {
    expect(uniqueWords([{ term: "a" }, { term: " A " }, { term: "b" }]).map((w) => w.term)).toEqual(["a", "b"]);
  });
});

describe("Wizard vs Zombie: a wrong pick teaches", () => {
  it("shows the right meaning, stops time for the wizard and the zombies, then moves on", () => {
    const start = { ...createWizardZombieState(TEN), zombies: [zombieAt(300, 300, { speed: 2 })] };
    const meaning = rightOrb(start).translation;
    const missed = pickWrong(start);

    expect(missed.reveal).toMatchObject({ term: start.targetWord, meaning });
    expect(missed.missedWords).toEqual([start.targetWord]);
    expect(missed.orbs).toHaveLength(0);

    const during = advanceWizardZombieTime(missed, 200, { dx: 1, dy: 0, cast: true }, TEN);
    expect(during.player.x).toBe(missed.player.x);
    expect(during.zombies[0].x).toBe(missed.zombies[0].x);
    expect(during.player.shockwaveCharges).toBe(missed.player.shockwaveCharges);

    const after = waitOutReveal(missed);
    expect(after.reveal).toBeNull();
    expect(after.orbs.length).toBeGreaterThan(1);
    expect(after.targetWord).not.toBe(start.targetWord);
    expect(after.wordQueue).toContain(start.targetWord);
  });

  it("asks the same word again when it is the last one left", () => {
    const list = words(2);
    let state = createWizardZombieState(list);
    state = pickRight(state, list);
    const last = state.targetWord;
    state = waitOutReveal(pickWrong(state, list), list);
    expect(state.targetWord).toBe(last);
    expect(state.status).toBe("playing");
  });
});

describe("Wizard vs Zombie: orbs are fair", () => {
  const spawnedOrbs = (count: number, seed = 1) => {
    let n = seed;
    const rng = () => {
      n = (n * 16807) % 2147483647;
      return n / 2147483647;
    };
    return createWizardZombieState(words(count), { rng, arena: { width: 420, height: 620 } });
  };

  it("never shows the same meaning twice", () => {
    const list = [
      { id: "1", term: "idiom", translation: "สำนวน" },
      { id: "2", term: "expression", translation: "สำนวน" },
      { id: "3", term: "sun", translation: "พระอาทิตย์" },
      { id: "4", term: "moon", translation: "พระจันทร์" },
      { id: "5", term: "star", translation: "ดาว" },
    ];
    for (let i = 0; i < 40; i++) {
      const state = createWizardZombieState(list);
      const labels = state.orbs.map((orb) => orb.translation);
      expect(new Set(labels).size).toBe(labels.length);
      expect(state.orbs.filter((orb) => orb.isCorrect)).toHaveLength(1);
    }
  });

  it("a small list gets fewer orbs, not copies of the right answer", () => {
    expect(createWizardZombieState(words(2)).orbs).toHaveLength(2);
    expect(createWizardZombieState(words(3)).orbs).toHaveLength(3);
    expect(createWizardZombieState(words(1)).orbs).toHaveLength(1);
    expect(createWizardZombieState(TEN).orbs).toHaveLength(4);
  });

  it("no orb appears on the wizard, and new orbs cannot be picked straight away", () => {
    for (let seed = 1; seed < 120; seed++) {
      const state = spawnedOrbs(10, seed);
      for (const orb of state.orbs) {
        expect(Math.hypot(orb.x - state.player.x, orb.y - state.player.y)).toBeGreaterThanOrEqual(MIN_ORB_DISTANCE);
      }
    }
    const fresh = createWizardZombieState(TEN);
    const onOrb = { ...fresh, player: { ...fresh.player, x: fresh.orbs[0].x, y: fresh.orbs[0].y } };
    expect(fresh.orbGraceMs).toBe(ORB_GRACE_MS);
    expect(advanceWizardZombieTime(onOrb, 16, STILL, TEN).totalAttempts).toBe(0);
    expect(advanceWizardZombieTime(onOrb, ORB_GRACE_MS + 1, STILL, TEN).totalAttempts).toBe(1);
  });

  it("a straight walk to an orb does not run through another", () => {
    const blockedWalks = (state: WizardZombieState) => {
      let blocked = 0;
      for (const orb of state.orbs) {
        for (const other of state.orbs) {
          if (other === orb) continue;
          const dx = orb.x - state.player.x;
          const dy = orb.y - state.player.y;
          const t = Math.max(0, Math.min(1, ((other.x - state.player.x) * dx + (other.y - state.player.y) * dy) / (dx * dx + dy * dy)));
          if (Math.hypot(state.player.x + t * dx - other.x, state.player.y + t * dy - other.y) < PICK_DISTANCE) blocked += 1;
        }
      }
      return blocked;
    };
    for (let seed = 1; seed < 120; seed++) expect(blockedWalks(spawnedOrbs(10, seed))).toBe(0);
  });

  it("orbs stay inside the arena, in different parts of it", () => {
    for (let seed = 1; seed < 60; seed++) {
      const state = spawnedOrbs(10, seed);
      const parts = new Set(state.orbs.map((orb) => `${orb.x < 210}-${orb.y < 310}`));
      expect(parts.size).toBe(state.orbs.length);
      for (const orb of state.orbs) {
        expect(orb.x).toBeGreaterThan(orb.radius);
        expect(orb.x).toBeLessThan(420 - orb.radius);
        expect(orb.y).toBeGreaterThan(orb.radius);
        expect(orb.y).toBeLessThan(620 - orb.radius);
      }
    }
  });
});

describe("Wizard vs Zombie: zombies cost time, never the round", () => {
  it("being caught does not end the round: the wizard waits, then comes back", () => {
    const start = createWizardZombieState(TEN);
    const dying: WizardZombieState = {
      ...start,
      orbs: [],
      player: { ...start.player, hp: 10 },
      zombies: [zombieAt(start.player.x, start.player.y)],
    };
    const caught = advanceWizardZombieTime(dying, 16, STILL, TEN);
    expect(caught.player.hp).toBe(0);
    expect(caught.status).toBe("playing");
    expect(caught.player.caughtMs).toBe(CAUGHT_RESPAWN_MS);

    const waiting = advanceWizardZombieTime(caught, 500, { dx: 1, dy: 0 }, TEN);
    expect(waiting.player.x).toBe(caught.player.x);
    expect(waiting.player.hp).toBe(0);

    const back = advanceWizardZombieTime(waiting, CAUGHT_RESPAWN_MS, STILL, TEN);
    expect(back.player.caughtMs).toBe(0);
    expect(back.player.hp).toBe(back.player.maxHp);
    expect(back.player.invulnerabilityTime).toBeGreaterThan(0);
    expect(back.zombies[0].pushMs).toBeGreaterThan(0);
    expect(back.targetWord).toBe(start.targetWord);
  });

  it("many zombies hurt no faster than one", () => {
    const start = createWizardZombieState(TEN);
    const crowd = Array.from({ length: 5 }, (_, i) => zombieAt(start.player.x + i, start.player.y));
    let state: WizardZombieState = { ...start, orbs: [], zombies: crowd };
    let hits = 0;
    for (let i = 0; i < 300; i++) {
      const next = advanceWizardZombieTime(state, 10, STILL, TEN);
      if (next.player.hp < state.player.hp) hits += 1;
      state = next;
    }
    expect(hits).toBeLessThanOrEqual(Math.ceil(3000 / INVULNERABILITY_DURATION));
  });

  it("the live count stays capped", () => {
    let state: WizardZombieState = { ...createWizardZombieState(TEN), orbs: [] };
    for (let i = 0; i < 2000; i++) {
      state = advanceWizardZombieTime(state, 33, STILL, TEN);
      expect(state.zombies.length).toBeLessThanOrEqual(MAX_LIVE_ZOMBIES);
    }
  });

  it("the first zombie comes from the edge and not next to the wizard", () => {
    let state: WizardZombieState = { ...createWizardZombieState(TEN, { arena: { width: 420, height: 620 } }), orbs: [] };
    while (state.zombies.length === 0) state = advanceWizardZombieTime(state, 33, STILL, TEN);
    expect(state.gameTime).toBeGreaterThan(2000);
    expect(Math.hypot(state.zombies[0].x - state.player.x, state.zombies[0].y - state.player.y)).toBeGreaterThan(200);
  });

  it("a right answer heals, charges and clears the zombies nearby", () => {
    const start = createWizardZombieState(TEN);
    const orb = rightOrb(start);
    const near = zombieAt(orb.x + 100, orb.y, { id: "near" });
    const far = zombieAt(orb.x + RIGHT_ANSWER_CLEAR_RADIUS + 40, orb.y, { id: "far" });
    const next = pickRight({ ...start, player: { ...start.player, hp: 50 }, zombies: [near, far] });
    expect(next.player.hp).toBe(60);
    expect(next.player.shockwaveCharges).toBe(1);
    expect(next.zombies.map((zombie) => zombie.id)).toEqual(["far"]);
  });

  it("a wrong pick costs no HP", () => {
    const start = createWizardZombieState(TEN);
    expect(pickWrong(start).player.hp).toBe(start.player.hp);
  });
});

describe("Wizard vs Zombie: shockwave", () => {
  it("spends one charge and slides zombies back over several steps", () => {
    const base = createWizardZombieState(TEN);
    const start: WizardZombieState = {
      ...base,
      orbs: [],
      player: { ...base.player, shockwaveCharges: 2 },
      zombies: [zombieAt(base.player.x + 60, base.player.y)],
    };
    const cast = advanceWizardZombieTime(start, 16, { ...STILL, cast: true }, TEN);
    expect(cast.player.shockwaveCharges).toBe(1);
    const firstSlide = cast.zombies[0].x - start.zombies[0].x;
    expect(firstSlide).toBeGreaterThan(0);
    expect(firstSlide).toBeLessThan(40);

    let state = cast;
    for (let i = 0; i < 30; i++) state = advanceWizardZombieTime(state, 16, STILL, TEN);
    expect(state.player.shockwaveCharges).toBe(1);
    expect(state.zombies[0].x - start.zombies[0].x).toBeGreaterThan(100);
  });

  it("does nothing with no charge", () => {
    const base = createWizardZombieState(TEN);
    const start: WizardZombieState = { ...base, orbs: [], zombies: [zombieAt(base.player.x + 60, base.player.y)] };
    const next = advanceWizardZombieTime(start, 16, { ...STILL, cast: true }, TEN);
    expect(next.player.shockwaveCharges).toBe(0);
    expect(next.zombies[0].pushMs).toBeUndefined();
  });
});

describe("buildRoundReview", () => {
  const list = words(3);

  it("praises a perfect round and lists nothing", () => {
    const review = buildRoundReview({ correctAnswers: 3, missedWords: [], answeredWords: ["word0", "word1", "word2"] }, list, "all-words");
    expect(review.heading).toContain("ถูกครบ");
    expect(review.missed).toEqual([]);
  });

  it("lists missed and unreached words with their meanings when time runs out", () => {
    const review = buildRoundReview({ correctAnswers: 1, missedWords: ["word1"], answeredWords: ["word0", "word1"] }, list, "time");
    expect(review.heading).toBe("หมดเวลา");
    expect(review.missed).toEqual([
      { term: "word1", meaning: "ความหมาย1" },
      { term: "word2", meaning: "ความหมาย2" },
    ]);
  });
});
