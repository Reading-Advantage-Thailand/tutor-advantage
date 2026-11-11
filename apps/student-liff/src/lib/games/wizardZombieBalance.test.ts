import { describe, expect, it } from "vitest";

import { chooseArena } from "./wizardZombieLayout";
import {
  advanceWizardZombieTime,
  createWizardZombieState,
  type Arena,
  type Orb,
  type WizardZombieState,
} from "./wizardZombie";

/**
 * Plays whole rounds on the real game logic with simple players, to check that
 * knowing the words decides the round. Run with WZ_SIM_ROUNDS=400 for tuning;
 * WZ_SIM_PRINT=1 prints the table.
 */

const ROUND_MS = 60_000;
const STEP_MS = 33; // a phone at 30 frames a second
const ROUNDS = Number(process.env.WZ_SIM_ROUNDS || 40);

const VOCABULARY = Array.from({ length: 10 }, (_, i) => ({
  id: `w${i}`,
  term: `word${i}`,
  translation: `ความหมาย${i}`,
}));
const PHONE_ARENA = chooseArena({ width: 390, height: 844 }, { stick: 136 });
const SMALL_PHONE_ARENA = chooseArena({ width: 360, height: 640 }, { stick: 136 });

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Player = {
  /** Share of the words this child knows. */
  knows: number;
  /** Time to read the word and the answers before walking. */
  readMs: number;
  /** A clumsy thumb walks slower than the stick allows. */
  walk?: number;
  /** What a child who does not know the word walks to. */
  guess?: "nearest" | "random";
  idle?: boolean;
  dodges?: boolean;
  casts?: boolean;
  /** A real thumb: looks up only this often, and points a bit off each time (radians either way). */
  aimMs?: number;
  wobble?: number;
};

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function steer(state: WizardZombieState, goal: Orb, player: Player) {
  const { x, y } = state.player;
  const length = dist(goal, state.player) || 1;
  let dx = (goal.x - x) / length;
  let dy = (goal.y - y) / length;
  // Walk around a wrong orb in the way, and away from a zombie about to bite.
  for (const orb of player.aimMs ? [] : state.orbs) {
    if (orb.id === goal.id) continue;
    const d = dist(orb, state.player);
    if (d < 75 && d > 0) {
      dx += ((x - orb.x) / d) * ((75 - d) / 40);
      dy += ((y - orb.y) / d) * ((75 - d) / 40);
    }
  }
  if (player.dodges !== false) {
    for (const zombie of state.zombies) {
      const d = dist(zombie, state.player);
      if (d < 70 && d > 0) {
        dx += ((x - zombie.x) / d) * ((70 - d) / 70);
        dy += ((y - zombie.y) / d) * ((70 - d) / 70);
      }
    }
  }
  const norm = Math.hypot(dx, dy) || 1;
  const walk = player.walk ?? 1;
  return { dx: (dx / norm) * walk, dy: (dy / norm) * walk };
}

function playRound(player: Player, seed: number, arena: Arena) {
  const rng = seeded(seed);
  const known = new Set(VOCABULARY.filter(() => rng() < player.knows).map((word) => word.term));
  let state = createWizardZombieState(VOCABULARY, { rng, arena });
  let readUntil = player.readMs;
  let orbKey = "";
  let choice: Orb | null = null;
  let caught = 0;
  let hits = 0;
  const seen = new Set<string>();
  let aimedAt = -Infinity;
  let aim = { dx: 0, dy: 0 };

  while (state.status === "playing" && state.gameTime < ROUND_MS) {
    const key = state.orbs.map((orb) => orb.id).join();
    if (key !== orbKey) {
      orbKey = key;
      choice = null;
      if (state.orbs.length) readUntil = state.gameTime + player.readMs;
    }
    if (!choice && state.orbs.length && state.gameTime >= readUntil && !player.idle) {
      const right = state.orbs.find((orb) => orb.isCorrect) ?? null;
      // A word met in the reveal has been seen once: half the time it sticks.
      const remembers = seen.has(state.targetWord) && rng() < 0.5;
      if (known.has(state.targetWord) || remembers) choice = right;
      else if (player.guess === "random") choice = state.orbs[Math.floor(rng() * state.orbs.length)];
      else choice = [...state.orbs].sort((a, b) => dist(a, state.player) - dist(b, state.player))[0];
    }
    const crowded = state.zombies.filter((zombie) => dist(zombie, state.player) < 90).length;
    const cast = player.casts !== false && crowded >= 2 && state.player.shockwaveCharges > 0;
    let walkTo = choice ? steer(state, choice, player) : { dx: 0, dy: 0 };
    if (player.aimMs && choice) {
      if (state.gameTime - aimedAt >= player.aimMs) {
        aimedAt = state.gameTime;
        const off = (rng() - 0.5) * 2 * (player.wobble ?? 0);
        const angle = Math.atan2(walkTo.dy, walkTo.dx) + off;
        const close = dist(choice, state.player) < 60;
        // Near the orb a child looks properly.
        aim = close ? walkTo : { dx: Math.cos(angle), dy: Math.sin(angle) };
      }
      walkTo = aim;
    }
    const input = { ...walkTo, cast };
    const before = state;
    state = advanceWizardZombieTime(state, STEP_MS, input, VOCABULARY, rng);
    if (state.player.caughtMs > 0 && before.player.caughtMs <= 0) caught += 1;
    if (state.player.hp < before.player.hp) hits += 1;
    if (state.reveal && !before.reveal) seen.add(state.reveal.term);
  }

  return {
    correct: state.correctAnswers,
    found: state.answeredWords.length,
    timeS: Math.min(state.gameTime, ROUND_MS) / 1000,
    caught,
    hits,
    ranOut: state.gameTime >= ROUND_MS,
  };
}

function summarize(player: Player, arena: Arena = PHONE_ARENA) {
  const rounds = Array.from({ length: ROUNDS }, (_, i) => playRound(player, 1000 + i * 37, arena));
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    correct: mean(rounds.map((round) => round.correct)),
    found: mean(rounds.map((round) => round.found)),
    timeS: mean(rounds.map((round) => round.timeS)),
    caught: mean(rounds.map((round) => round.caught)),
    hits: mean(rounds.map((round) => round.hits)),
    ranOut: mean(rounds.map((round) => (round.ranOut ? 1 : 0))),
  };
}

const KNOWS_ALL: Player = { knows: 1, readMs: 2500 };
const KNOWS_HALF: Player = { knows: 0.5, readMs: 2500 };
const BLIND_INSTANT: Player = { knows: 0, readMs: 0 };

describe("Wizard vs Zombie balance", () => {
  if (process.env.WZ_SIM_PRINT) {
    it("prints the table", () => {
      const rows: Record<string, ReturnType<typeof summarize>> = {};
      const players: Record<string, Player> = {
        "knows all, reads 2.5s": KNOWS_ALL,
        "knows all, reads 4s": { knows: 1, readMs: 4000 },
        "knows all, reads 6s, clumsy": { knows: 1, readMs: 6000, walk: 0.6 },
        "knows all, no dodge or cast": { knows: 1, readMs: 2500, dodges: false, casts: false },
        "knows all, wobbly thumb": { knows: 1, readMs: 2500, aimMs: 300, wobble: 0.5 },
        "knows all, very wobbly": { knows: 1, readMs: 2500, aimMs: 400, wobble: 0.9 },
        "knows half, wobbly thumb": { knows: 0.5, readMs: 2500, aimMs: 300, wobble: 0.5 },
        "knows half, reads 2.5s": KNOWS_HALF,
        "knows half, reads 4s, clumsy": { knows: 0.5, readMs: 4000, walk: 0.6 },
        "blind, instant, nearest": BLIND_INSTANT,
        "blind, 0.5s, nearest": { knows: 0, readMs: 500 },
        "blind, 1s, random": { knows: 0, readMs: 1000, guess: "random" },
        "does nothing": { knows: 0, readMs: 0, idle: true },
      };
      for (const [name, player] of Object.entries(players)) rows[name] = summarize(player);
      rows["knows all, small phone"] = summarize(KNOWS_ALL, SMALL_PHONE_ARENA);
      rows["blind, small phone"] = summarize(BLIND_INSTANT, SMALL_PHONE_ARENA);
      // eslint-disable-next-line no-console
      console.table(
        Object.fromEntries(
          Object.entries(rows).map(([name, r]) => [
            name,
            { correct: r.correct.toFixed(1), found: r.found.toFixed(1), timeS: r.timeS.toFixed(0), caught: r.caught.toFixed(1), hits: r.hits.toFixed(1), ranOut: `${Math.round(r.ranOut * 100)}%` },
          ]),
        ),
      );
    }, 120_000);
  }

  it("a child who knows the words gets nearly all of them", () => {
    const { correct, caught } = summarize(KNOWS_ALL);
    expect(correct).toBeGreaterThanOrEqual(8.5);
    expect(caught).toBeLessThan(1);
  });

  it("a wobbly thumb costs a knowing child very little, since orbs do not stand in the way", () => {
    expect(summarize({ knows: 1, readMs: 2500, aimMs: 300, wobble: 0.5 }).correct).toBeGreaterThanOrEqual(8.5);
  });

  it("knowing half earns about half, and well above guessing", () => {
    const half = summarize(KNOWS_HALF).correct;
    const blind = summarize(BLIND_INSTANT).correct;
    expect(half).toBeGreaterThan(4);
    expect(half).toBeLessThan(7.5);
    expect(half - blind).toBeGreaterThan(2);
  });

  it("the fastest blind grabber earns only what luck gives", () => {
    const { correct, found } = summarize(BLIND_INSTANT);
    expect(correct).toBeLessThan(4);
    // The round still runs for them: they keep seeing and answering words.
    expect(found).toBeGreaterThan(5);
  });

  it("a child who does nothing gets 0 and the round runs to the end", () => {
    const { correct, ranOut } = summarize({ knows: 0, readMs: 0, idle: true });
    expect(correct).toBe(0);
    expect(ranOut).toBe(1);
  });

  it("a small phone plays about the same round", () => {
    expect(Math.abs(summarize(KNOWS_ALL, SMALL_PHONE_ARENA).correct - summarize(KNOWS_ALL).correct)).toBeLessThan(1.5);
  });
});
