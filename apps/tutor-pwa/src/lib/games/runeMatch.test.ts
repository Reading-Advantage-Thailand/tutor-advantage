import { describe, expect, it } from "vitest";
import type { VocabularyItem } from "@/store/useGameStore";
import {
  advanceTime,
  applyHint,
  createRuneMatchState,
  findPossibleMoves,
  initializeGrid,
  isRunePairMatch,
  monsterHpForProgress,
  RUNE_NOT_TOUCHING_TEXT,
  shuffleGrid,
  tapRune,
  type GridPosition,
  type Rune,
  type RuneMatchState,
} from "./runeMatch";
import { RUNE_MATCH_CONFIG } from "./runeMatchConfig";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const word = (term: string, translation: string): VocabularyItem => ({ id: term, term, translation });

const TEN_WORDS = [
  word("idiom", "สำนวน"),
  word("expression", "สำนวน"),
  word("constituent", "ส่วนประกอบ"),
  word("predictable", "ทำนายได้"),
  word("slang", "คำแสลง"),
  word("informal", "ไม่เป็นทางการ"),
  word("restricted", "จำกัด"),
  word("particular", "โดยเฉพาะ"),
  word("context", "บริบท"),
  word("example", "ตัวอย่าง"),
];

const playing = (vocabulary: VocabularyItem[], seed = 7): RuneMatchState => {
  const rng = seeded(seed);
  const state = createRuneMatchState(vocabulary, { rng });
  return {
    ...state,
    status: "playing",
    selectedMonster: "goblin",
    monster: { type: "goblin", hp: 90, maxHp: 90, attack: 2, xp: 3 },
    grid: initializeGrid(state.activeVocabulary, { rng }),
  };
};

const rune = (wordId: string, face: Rune["face"], meaning: string): Rune => ({
  id: `${wordId}-${face}-${Math.random()}`,
  wordId,
  text: face === "term" ? wordId : meaning,
  face,
  meaning,
});

/** A board with exact tiles; anything not listed is an unrelated term tile. */
const boardWith = (cells: Record<string, Rune>): Rune[][] => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: columns }, (_, c) => cells[`${r},${c}`] ?? rune(`filler${r}${c}`, "term", `f${r}${c}`)),
  );
};

const correctMoveOf = (state: RuneMatchState) => findPossibleMoves(state.grid)[0];

const tap = (state: RuneMatchState, cell: GridPosition, nowMs: number) => tapRune(state, cell, nowMs);

const playPair = (state: RuneMatchState, nowMs = 10_000) => {
  const move = correctMoveOf(state);
  return tap(tap(state, move.from, nowMs), move.to, nowMs + 500);
};

describe("board", () => {
  it("is 4 by 6 with big tiles in mind", () => {
    const grid = initializeGrid(TEN_WORDS, { rng: seeded(3) });
    expect(grid).toHaveLength(RUNE_MATCH_CONFIG.grid.rows);
    expect(grid[0]).toHaveLength(RUNE_MATCH_CONFIG.grid.columns);
  });

  it("always starts with the floor of touching pairs", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const grid = initializeGrid(TEN_WORDS, { rng: seeded(seed) });
      expect(findPossibleMoves(grid).length).toBeGreaterThanOrEqual(RUNE_MATCH_CONFIG.board.newBoardPairs);
    }
  });

  it("shows only some of the words at once", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const grid = initializeGrid(TEN_WORDS, { rng: seeded(seed) });
      const words = new Set(grid.flat().map((tile) => tile.wordId));
      expect(words.size).toBeLessThanOrEqual(RUNE_MATCH_CONFIG.board.wordsOnBoard + 1);
    }
  });

  it("works with a two-word lesson", () => {
    const grid = initializeGrid([word("cat", "แมว"), word("dog", "สุนัข")], { rng: seeded(5) });
    expect(findPossibleMoves(grid).length).toBeGreaterThanOrEqual(3);
  });

  it("counts a word listed twice once", () => {
    const state = createRuneMatchState([word("cat", "แมว"), word("Cat ", "แมว"), word("dog", "สุนัข")], { rng: seeded(5) });
    expect(state.activeVocabulary.map((item) => item.term.toLowerCase().trim()).sort()).toEqual(["cat", "dog"]);
  });
});

describe("a full round", () => {
  it("never leaves fewer pairs than the floor, and never resets the board", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let state = playing(TEN_WORDS, seed);
      while (state.status === "playing") {
        const before = new Set(state.grid.flat().map((tile) => tile.id));
        state = playPair(state);
        if (state.status !== "playing") break;
        const pending = state.activeVocabulary.length - state.doneWordIds.length;
        expect(findPossibleMoves(state.grid).length).toBeGreaterThanOrEqual(
          Math.min(RUNE_MATCH_CONFIG.board.refillPairs, pending * 2),
        );
        const kept = state.grid.flat().filter((tile) => before.has(tile.id)).length;
        expect(kept, "the board must not be replaced after a match").toBeGreaterThan(12);
      }
      expect(state.status).toBe("victory");
    }
  });

  it("gives ten different words in ten matches when the lesson has ten", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let state = playing(TEN_WORDS, seed);
      const seen: string[] = [];
      while (state.status === "playing") {
        const move = correctMoveOf(state);
        const tiles = [state.grid[move.from.row][move.from.col], state.grid[move.to.row][move.to.col]];
        seen.push(tiles.find((tile) => tile.face === "term")!.wordId);
        state = playPair(state);
      }
      expect(new Set(seen).size, `seed ${seed}: ${seen.join(",")}`).toBe(10);
    }
  });

  it("brings words back when the lesson has fewer than ten, so ten pairs stay reachable", () => {
    let state = playing([word("cat", "แมว"), word("dog", "สุนัข"), word("sun", "พระอาทิตย์"), word("moon", "พระจันทร์")]);
    while (state.status === "playing") state = playPair(state);
    expect(state.status).toBe("victory");
    expect(state.correctAnswers).toBe(10);
  });

  it("tracks the goblin's bar exactly with the pairs", () => {
    expect(monsterHpForProgress(90, 0)).toBe(90);
    expect(monsterHpForProgress(90, 5)).toBe(45);
    expect(monsterHpForProgress(90, 10)).toBe(0);
    let state = playing(TEN_WORDS);
    state = playPair(state);
    expect(state.monster?.hp).toBe(81);
  });

  it("ends a win on the death pose, with nothing left floating and no new board", () => {
    let state = playing(TEN_WORDS);
    let last = state;
    while (state.status === "playing") {
      last = state;
      state = playPair(state);
    }
    expect(state.status).toBe("victory");
    expect(state.monsterState).toBe("death");
    expect(state.monster?.hp).toBe(0);
    expect(state.floatingTexts).toEqual([]);
    expect(state.grid).toBe(last.grid);
    expect(advanceTime(state, 500)).toBe(state);
  });
});

describe("what counts as a pair", () => {
  it("accepts either word with a shared meaning", () => {
    const idiom = rune("idiom", "term", "สำนวน");
    const fromExpression = rune("expression", "translation", "สำนวน");
    expect(isRunePairMatch(idiom, fromExpression)).toBe(true);
    expect(isRunePairMatch(idiom, rune("idiom", "term", "สำนวน"))).toBe(false);
    expect(isRunePairMatch(idiom, rune("slang", "translation", "คำแสลง"))).toBe(false);
  });

  it("scores the term tile's word when the meaning came from another word", () => {
    let state = playing(TEN_WORDS);
    state = {
      ...state,
      grid: boardWith({
        "0,0": rune("idiom", "term", "สำนวน"),
        "0,1": rune("expression", "translation", "สำนวน"),
      }),
    };
    state = tap(tap(state, { row: 0, col: 0 }, 1000), { row: 0, col: 1 }, 1500);
    expect(state.correctAnswers).toBe(1);
    expect(state.doneWordIds).toEqual(["idiom"]);
    expect(state.message?.text).toBe("idiom = สำนวน");
  });
});

describe("tapping", () => {
  const pairApart = () => {
    const state = playing(TEN_WORDS);
    return {
      ...state,
      grid: boardWith({
        "0,0": rune("context", "term", "บริบท"),
        "2,2": rune("context", "translation", "บริบท"),
      }),
    };
  };

  it("says so when a real pair does not touch, and counts no try", () => {
    const state = tap(tap(pairApart(), { row: 0, col: 0 }, 1000), { row: 2, col: 2 }, 1500);
    expect(state.message?.text).toBe(RUNE_NOT_TOUCHING_TEXT);
    expect(state.selectedCell).toBeNull();
    expect(state.totalAttempts).toBe(0);
    expect(state.correctAnswers).toBe(0);
  });

  it("just moves the selection when a child changes their mind", () => {
    const state = tap(tap(pairApart(), { row: 0, col: 0 }, 1000), { row: 4, col: 3 }, 1500);
    expect(state.selectedCell).toEqual({ row: 4, col: 3 });
    expect(state.message).toBeNull();
    expect(state.totalAttempts).toBe(0);
  });

  it("ignores a shaky double tap but lets a later tap cancel", () => {
    const first = tap(pairApart(), { row: 1, col: 1 }, 1000);
    expect(tap(first, { row: 1, col: 1 }, 1090).selectedCell).toEqual({ row: 1, col: 1 });
    expect(tap(first, { row: 1, col: 1 }, 1500).selectedCell).toBeNull();
  });
});

describe("a wrong pair", () => {
  const wrongPair = (state: RuneMatchState, nowMs = 1000) => {
    const a = { row: 0, col: 0 };
    const b = { row: 0, col: 1 };
    const board = {
      ...state,
      grid: boardWith({ "0,0": rune("context", "term", "บริบท"), "0,1": rune("slang", "translation", "คำแสลง") }),
    };
    return tap(tap(board, a, nowMs), b, nowMs + 400);
  };

  it("locks the tiles, longer each time in a row, and adds no score penalty", () => {
    const { wrongPairLockMs } = RUNE_MATCH_CONFIG.friction;
    let state = wrongPair(playing(TEN_WORDS));
    expect(state.inputLockMs).toBe(wrongPairLockMs[0]);
    expect(state.correctAnswers).toBe(0);

    state = advanceTime(state, wrongPairLockMs[0]);
    expect(state.inputLockMs).toBe(0);
    state = wrongPair(state);
    expect(state.inputLockMs).toBe(wrongPairLockMs[1]);

    state = advanceTime(state, wrongPairLockMs[1]);
    state = wrongPair(state);
    expect(state.inputLockMs).toBe(wrongPairLockMs[2]);

    state = advanceTime(state, wrongPairLockMs[2]);
    state = wrongPair(state);
    expect(state.inputLockMs).toBe(wrongPairLockMs[3]);

    state = advanceTime(state, wrongPairLockMs[3]);
    state = wrongPair(state);
    expect(state.inputLockMs).toBe(wrongPairLockMs[3]);
  });

  it("ignores taps during the lock and counts no extra tries", () => {
    const state = wrongPair(playing(TEN_WORDS));
    const tapped = tap(state, { row: 3, col: 3 }, 2000);
    expect(tapped).toBe(state);
  });

  it("shows what the first tile really means", () => {
    const state = wrongPair(playing(TEN_WORDS));
    expect(state.message).toMatchObject({ text: "context = บริบท", tone: "bad" });
    expect(state.wrongCells).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  });

  it("steps the lock back one for each correct pair, not all the way", () => {
    let state = wrongPair(playing(TEN_WORDS));
    state = advanceTime(state, 5000);
    state = wrongPair(state);
    state = advanceTime(state, 5000);
    expect(state.wrongStreak).toBe(2);
    const fresh = {
      ...state,
      grid: boardWith({ "1,0": rune("context", "term", "บริบท"), "1,1": rune("context", "translation", "บริบท") }),
    };
    const matched = tap(tap(fresh, { row: 1, col: 0 }, 9000), { row: 1, col: 1 }, 9500);
    expect(matched.wrongStreak).toBe(1);
  });
});

describe("clock and warnings", () => {
  it("uses the round clock's time when it has one", () => {
    const state = advanceTime(playing(TEN_WORDS), 50, 42_000);
    expect(state.player.hp).toBe(42_000);
    expect(state.gameTimeMs).toBe(18_000);
  });

  it("ends the round when the clock reaches zero", () => {
    const state = advanceTime(playing(TEN_WORDS), 0, 0);
    expect(state.status).toBe("defeat");
    expect(state.floatingTexts).toEqual([]);
  });

  it("poses the goblin at any time but warns only near the end", () => {
    let early = playing(TEN_WORDS);
    early = advanceTime({ ...early, nextAttackTimer: 10 }, 50, 50_000);
    expect(early.monsterState).toBe("attack");
    expect(early.message).toBeNull();

    let late = playing(TEN_WORDS);
    late = advanceTime({ ...late, nextAttackTimer: 10 }, 50, 10_000);
    expect(late.monsterState).toBe("attack");
    expect(late.message?.tone).toBe("bad");
  });
});

describe("skills", () => {
  it("shuffle clears the selection and any hint, so a stale hint cannot mislead", () => {
    let state = playing(TEN_WORDS);
    state = applyHint(state);
    state = { ...state, selectedCell: { row: 1, col: 1 } };
    state = shuffleGrid(state);
    expect(state.hintCells).toEqual([]);
    expect(state.selectedCell).toBeNull();
    expect(state.specialMoves.shuffle).toBe(0);
    expect(shuffleGrid(state)).toBe(state);
  });

  it("does not spend a second hint while one is showing", () => {
    const first = applyHint(playing(TEN_WORDS));
    expect(first.hintsRemaining).toBe(1);
    expect(first.hintCells).toHaveLength(2);
    expect(applyHint(first)).toBe(first);
  });

  it("shuffle keeps finished words out of play", () => {
    let state = playing(TEN_WORDS);
    state = playPair(state);
    const done = state.doneWordIds[0];
    state = shuffleGrid(state);
    expect(state.grid.flat().filter((tile) => tile.wordId === done).map((tile) => tile.face).length).toBeLessThanOrEqual(
      RUNE_MATCH_CONFIG.board.decoyTilesPerWord,
    );
    for (const { from, to } of findPossibleMoves(state.grid)) {
      const pair = [state.grid[from.row][from.col], state.grid[to.row][to.col]];
      expect(pair.some((tile) => tile.wordId === done)).toBe(false);
    }
  });
});

describe("a child who mashes", () => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  const neighbours = (cell: GridPosition) =>
    [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    ].filter((n) => n.row >= 0 && n.row < rows && n.col >= 0 && n.col < columns);

  /** Plays 60 seconds. `pick` chooses the next pair; `tapMs` is the time between taps. */
  const round = (seed: number, tapMs: number, pick: (state: RuneMatchState, rng: () => number) => [GridPosition, GridPosition]) => {
    const rng = seeded(seed * 31 + 1);
    let state = playing(TEN_WORDS, seed);
    let clock = 0;
    while (state.status === "playing" && clock < 60_000) {
      if (state.inputLockMs > 0) {
        clock += state.inputLockMs;
        state = advanceTime(state, state.inputLockMs);
        continue;
      }
      const [a, b] = pick(state, rng);
      state = tap(state, a, clock);
      clock += tapMs;
      state = advanceTime(state, tapMs);
      state = tap(state, b, clock);
      clock += tapMs;
      state = advanceTime(state, tapMs);
    }
    return state.correctAnswers;
  };

  const average = (runs: number, one: (seed: number) => number) => {
    let total = 0;
    for (let seed = 1; seed <= runs; seed++) total += one(seed);
    return total / runs;
  };

  const blind = (state: RuneMatchState, rng: () => number): [GridPosition, GridPosition] => {
    const a = { row: Math.floor(rng() * rows), col: Math.floor(rng() * columns) };
    const options = neighbours(a);
    return [a, options[Math.floor(rng() * options.length)]];
  };

  const facesOnly = (state: RuneMatchState, rng: () => number): [GridPosition, GridPosition] => {
    const pairs: [GridPosition, GridPosition][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        for (const n of neighbours({ row: r, col: c })) {
          if (state.grid[r][c].face !== state.grid[n.row][n.col].face) pairs.push([{ row: r, col: c }, n]);
        }
      }
    }
    return pairs[Math.floor(rng() * pairs.length)] ?? blind(state, rng);
  };

  it("earns far less than a child who reads, even one who is slow", () => {
    const readerAt7s = 60 / 7;
    const blindMash = average(200, (seed) => round(seed, 150, blind));
    const facesMash = average(200, (seed) => round(seed, 150, facesOnly));
    // Printed so a change to the lock or the floor shows its effect on balance.
    console.log(`blind mash ${blindMash.toFixed(1)}, English-next-to-Thai mash ${facesMash.toFixed(1)}, reader at 7 s ${readerAt7s.toFixed(1)}`);
    expect(blindMash).toBeLessThan(3);
    expect(facesMash).toBeLessThan(readerAt7s * 0.7);
  });
});
