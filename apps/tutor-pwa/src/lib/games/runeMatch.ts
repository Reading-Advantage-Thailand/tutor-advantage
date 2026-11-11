import type { VocabularyItem } from "@/store/useGameStore";
import { RUNE_MATCH_CONFIG, type MonsterType } from "./runeMatchConfig";
import { tx as translateText } from "./gameText";
import { normalizeMeaning, pickDecoys } from "./pickDecoys";

export type GridPosition = {
  row: number;
  col: number;
};

export type Rune = {
  id: string;
  wordId: string; // The unique English term
  text: string; // Thai or English display text
  face: "term" | "translation";
  meaning: string; // Normalised translation: two words can share one
};

export type Player = {
  hp: number;
  maxHp: number;
};

export type Monster = {
  type: MonsterType;
  hp: number;
  maxHp: number;
  attack: number;
  xp: number;
};

export type FloatingText = {
  id: string;
  text: string;
  x: number; // Grid col or -1 for center
  y: number; // Grid row or -1 for center
  offsetX: number; // Pixel offset
  offsetY: number; // Pixel offset
  color: string;
  opacity: number;
  scale: number;
  duration: number; // Remaining time in ms
  maxDuration: number;
};

export type RuneMessage = {
  text: string;
  tone: "good" | "bad" | "info";
  remainingMs: number;
};

export type MatchBurst = GridPosition & {
  id: string;
  remainingMs: number;
};

export type RuneMatchState = {
  status: "selection" | "playing" | "victory" | "defeat";
  selectedMonster: MonsterType | null;
  player: Player;
  monster: Monster | null;
  grid: Rune[][];
  selectedCell: GridPosition | null;
  selectedAtMs: number;
  correctAnswers: number;
  totalAttempts: number;
  wrongAttempts: number;
  nextAttackTimer: number; // Time until the goblin's next attack pose
  activeVocabulary: VocabularyItem[]; // Subset of vocabulary used in this game session
  vocabulary: VocabularyItem[];
  /** Words matched this cycle. They give no more pairs until every word has had its turn. */
  doneWordIds: string[];
  rng: () => number;
  floatingTexts: FloatingText[];
  bursts: MatchBurst[];
  message: RuneMessage | null;
  monsterState: "idle" | "attack" | "hurt" | "death";
  monsterStateTimer: number; // ms remaining in current state
  currentStreak: number; // Combo streak counter
  wrongStreak: number; // Wrong pairs in a row
  inputLockMs: number; // Tiles ignore taps until this runs out
  inputLockTotalMs: number;
  wrongCells: GridPosition[]; // The pair that caused the lock
  specialMoves: {
    shuffle: number;
  };
  hintCells: GridPosition[]; // Cells to highlight for hint
  hintsRemaining: number; // Max 2 hints per game
  gameTimeMs: number;
};

export type RuneDealOptions = {
  rng?: () => number;
  doneWordIds?: readonly string[];
};

export const RUNE_RULE_LINES = ["แตะ 2 แผ่นที่ติดกัน", "คำศัพท์คู่กับคำแปล"];
export const RUNE_NOT_TOUCHING_TEXT = "คู่ถูก! แต่ต้องอยู่ติดกัน";
export const RUNE_HINT_TEXT = "คำใบ้: ดูกรอบสีเหลือง";

const MESSAGE_MS = 1500;
const HURRY_WINDOW_MS = 15_000;
const BURST_MS = 260;

let lastRuneId = 0;
const generateId = () => `rune-${++lastRuneId}`;

const wordKey = (item: VocabularyItem) => item.term.toLowerCase().trim();

const makeRune = (item: VocabularyItem, face: Rune["face"]): Rune => ({
  id: generateId(),
  wordId: wordKey(item),
  text: face === "translation" ? item.translation : item.term,
  face,
  meaning: normalizeMeaning(item.translation),
});

const randomItem = <T,>(items: readonly T[], rng: () => number): T =>
  items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

const shuffled = <T,>(items: readonly T[], rng: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const isRunePairMatch = (first?: Rune | null, second?: Rune | null): boolean =>
  !!first &&
  !!second &&
  first.face !== second.face &&
  // Two words can share one Thai meaning (idiom and expression are both สำนวน).
  // The tiles look the same, so either one is a correct partner.
  (first.wordId === second.wordId || first.meaning === second.meaning);

// Find all possible valid moves (for hint system)
export const findPossibleMoves = (
  grid: Rune[][],
): { from: GridPosition; to: GridPosition }[] => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const moves: { from: GridPosition; to: GridPosition }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1 && isRunePairMatch(grid[r][c], grid[r][c + 1])) {
        moves.push({ from: { row: r, col: c }, to: { row: r, col: c + 1 } });
      }
      if (r < rows - 1 && isRunePairMatch(grid[r][c], grid[r + 1][c])) {
        moves.push({ from: { row: r, col: c }, to: { row: r + 1, col: c } });
      }
    }
  }
  return moves;
};

// --- Dealing tiles -----------------------------------------------------------

type Deal = {
  vocabulary: readonly VocabularyItem[];
  done: ReadonlySet<string>;
  rng: () => number;
};

const pendingWords = ({ vocabulary, done }: Deal) => {
  const pending = vocabulary.filter((item) => !done.has(wordKey(item)));
  return pending.length > 0 ? pending : [...vocabulary];
};

/**
 * A finished word stays on the board only as a decoy, on one face per meaning,
 * so it can never form a pair and earn the same word twice.
 */
const decoyFace = (meaning: string): Rune["face"] => {
  let sum = 0;
  for (let i = 0; i < meaning.length; i++) sum += meaning.charCodeAt(i);
  return sum % 2 === 0 ? "term" : "translation";
};

type Tally = Map<string, { term: number; translation: number }>;

const countFor = (tally: Tally, id: string) => {
  const entry = tally.get(id);
  return entry ? entry.term + entry.translation : 0;
};

const addToTally = (tally: Tally, rune: Rune, delta = 1) => {
  const entry = tally.get(rune.wordId) ?? { term: 0, translation: 0 };
  entry[rune.face] += delta;
  tally.set(rune.wordId, entry);
};

const tallyGrid = (grid: (Rune | null)[][]) => {
  const tally: Tally = new Map();
  for (const row of grid) {
    for (const rune of row) {
      if (rune) addToTally(tally, rune);
    }
  }
  return tally;
};

const pickDecoyRune = (deal: Deal, tally: Tally): Rune | null => {
  const pending = pendingWords(deal);
  const pendingMeanings = new Set(pending.map((item) => normalizeMeaning(item.translation)));
  const pool = deal.vocabulary.filter(
    (item) =>
      deal.done.has(wordKey(item)) &&
      !pendingMeanings.has(normalizeMeaning(item.translation)) &&
      countFor(tally, wordKey(item)) < RUNE_MATCH_CONFIG.board.decoyTilesPerWord,
  );
  const [decoy] = pickDecoys(randomItem(pending, deal.rng), pool, 1, deal.rng);
  return decoy ? makeRune(decoy, decoyFace(normalizeMeaning(decoy.translation))) : null;
};

/** The next tile for an empty cell: the words still to do, faces kept even so partners exist. */
const chooseRune = (deal: Deal, tally: Tally): Rune => {
  const { wordsOnBoard, tilesPerWord } = RUNE_MATCH_CONFIG.board;
  const live = pendingWords(deal);
  const showing = live.filter((item) => countFor(tally, wordKey(item)) > 0);
  const waiting = live.filter((item) => countFor(tally, wordKey(item)) === 0);

  let word: VocabularyItem | null = null;
  if (showing.length < wordsOnBoard && waiting.length > 0) {
    word = randomItem(waiting, deal.rng);
  } else {
    const open = showing.filter((item) => countFor(tally, wordKey(item)) < tilesPerWord);
    if (open.length > 0) word = randomItem(open, deal.rng);
  }
  if (!word) {
    const decoy = pickDecoyRune(deal, tally);
    if (decoy) return decoy;
    word = randomItem(live, deal.rng);
  }

  const faces = tally.get(wordKey(word)) ?? { term: 0, translation: 0 };
  const face: Rune["face"] =
    faces.term === faces.translation
      ? deal.rng() < 0.5
        ? "term"
        : "translation"
      : faces.term < faces.translation
        ? "term"
        : "translation";
  return makeRune(word, face);
};

const wouldLineUpThree = (grid: (Rune | null)[][], row: number, col: number, rune: Rune) => {
  const same = (other: Rune | null | undefined) => !!other && other.wordId === rune.wordId;
  const left = same(grid[row]?.[col - 1]);
  const right = same(grid[row]?.[col + 1]);
  const up = same(grid[row - 1]?.[col]);
  const down = same(grid[row + 1]?.[col]);
  return (
    (left && (right || same(grid[row]?.[col - 2]))) ||
    (right && same(grid[row]?.[col + 2])) ||
    (up && (down || same(grid[row - 2]?.[col]))) ||
    (down && same(grid[row + 2]?.[col]))
  );
};

const fillCell = (grid: (Rune | null)[][], row: number, col: number, deal: Deal, tally: Tally) => {
  let rune = chooseRune(deal, tally);
  for (let attempt = 0; attempt < 8 && wouldLineUpThree(grid, row, col, rune); attempt++) {
    rune = chooseRune(deal, tally);
  }
  grid[row][col] = rune;
  addToTally(tally, rune);
  return rune;
};

/** Pairs a board must offer, given how many words are still to do. */
const pairFloorFor = (deal: Deal, floor: number) => Math.min(floor, pendingWords(deal).length * 2);

/**
 * Turns one tile into the partner of a neighbour until the board offers enough
 * pairs. New tiles and decoys go first, so a word the child may be tracking only
 * changes when nothing else can; tiles of a pair already on offer never change.
 */
const ensurePairFloor = (grid: Rune[][], floor: number, deal: Deal, fresh: ReadonlySet<string>) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const live = new Set(pendingWords(deal).map(wordKey));
  const wordById = new Map(deal.vocabulary.map((item) => [wordKey(item), item]));

  for (let guard = 0; guard < 16; guard++) {
    const moves = findPossibleMoves(grid);
    if (moves.length >= floor) return;

    const inPair = new Set<string>();
    const wordsOffered = new Set<string>();
    for (const { from, to } of moves) {
      inPair.add(`${from.row},${from.col}`);
      inPair.add(`${to.row},${to.col}`);
      wordsOffered.add(grid[from.row][from.col].wordId);
    }

    const options: { row: number; col: number; word: VocabularyItem; face: Rune["face"]; score: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const anchor = grid[r][c];
        const word = wordById.get(anchor.wordId);
        if (!word || !live.has(anchor.wordId)) continue;
        for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          const target = grid[nr]?.[nc];
          if (!target || inPair.has(`${nr},${nc}`)) continue;
          const replaceable = fresh.has(target.id) || !live.has(target.wordId) ? 4 : 1;
          options.push({
            row: nr,
            col: nc,
            word,
            face: anchor.face === "term" ? "translation" : "term",
            score: replaceable + (wordsOffered.has(anchor.wordId) ? 0 : 2),
          });
        }
      }
    }
    if (options.length === 0) return;
    const bestScore = Math.max(...options.map((option) => option.score));
    const pick = randomItem(options.filter((option) => option.score === bestScore), deal.rng);
    grid[pick.row][pick.col] = makeRune(pick.word, pick.face);
  }
};

/** A full new board: at most `wordsOnBoard` words at once and always a few pairs on offer. */
export const initializeGrid = (
  vocabulary: readonly VocabularyItem[],
  { rng = Math.random, doneWordIds = [] }: RuneDealOptions = {},
): Rune[][] => {
  const { rows, columns } = RUNE_MATCH_CONFIG.grid;
  const deal: Deal = { vocabulary, done: new Set(doneWordIds), rng };
  const grid: (Rune | null)[][] = Array.from({ length: rows }, () => Array<Rune | null>(columns).fill(null));
  const tally: Tally = new Map();
  const cells: GridPosition[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) cells.push({ row, col });
  }
  for (const { row, col } of shuffled(cells, rng)) {
    fillCell(grid, row, col, deal, tally);
  }
  const full = grid as Rune[][];
  ensurePairFloor(full, pairFloorFor(deal, RUNE_MATCH_CONFIG.board.newBoardPairs), deal, new Set());
  return full;
};

/** Matched tiles leave, the columns close up, and new tiles fill the top. */
const applyGravity = (grid: Rune[][], matched: GridPosition[], deal: Deal, fresh: Set<string>): Rune[][] => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next: (Rune | null)[][] = grid.map((row) => [...row]);
  for (const { row, col } of matched) next[row][col] = null;

  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const rune = next[r][c];
      if (!rune) continue;
      next[r][c] = null;
      next[write][c] = rune;
      write--;
    }
  }
  const tally = tallyGrid(next);
  for (let c = 0; c < cols; c++) {
    for (let r = rows - 1; r >= 0; r--) {
      if (!next[r][c]) fresh.add(fillCell(next, r, c, deal, tally).id);
    }
  }
  return next as Rune[][];
};

/**
 * A word that was just matched gives no more points this cycle: tiles that could
 * still pair are swapped for words the child has not done yet. Tiles on its decoy
 * face stay, so the board does not get easier as the words run out.
 */
const retireDoneWords = (grid: Rune[][], deal: Deal, fresh: Set<string>) => {
  const live = pendingWords(deal);
  const liveIds = new Set(live.map(wordKey));
  const liveMeanings = new Set(live.map((item) => normalizeMeaning(item.translation)));
  const tally = tallyGrid(grid);
  grid.forEach((row, r) =>
    row.forEach((rune, c) => {
      if (liveIds.has(rune.wordId)) return;
      if (rune.face === decoyFace(rune.meaning) && !liveMeanings.has(rune.meaning)) return;
      addToTally(tally, rune, -1);
      fresh.add(fillCell(grid, r, c, deal, tally).id);
    }),
  );
};

const refillAfterMatch = (
  grid: Rune[][],
  matched: GridPosition[],
  vocabulary: readonly VocabularyItem[],
  doneWordIds: readonly string[],
  rng: () => number,
) => {
  const deal: Deal = { vocabulary, done: new Set(doneWordIds), rng };
  const fresh = new Set<string>();
  const next = applyGravity(grid, matched, deal, fresh);
  retireDoneWords(next, deal, fresh);
  ensurePairFloor(next, pairFloorFor(deal, RUNE_MATCH_CONFIG.board.refillPairs), deal, fresh);
  return next;
};

// --- Round progress ----------------------------------------------------------

const floatingText = (text: string, x: number, y: number, color: string, duration: number): FloatingText => ({
  id: generateId(),
  text,
  x,
  y,
  offsetX: 0,
  offsetY: 0,
  color,
  opacity: 1,
  scale: 1,
  duration,
  maxDuration: duration,
});

/** The goblin's health is the round's progress: 5 of 10 pairs is half its bar. */
export const monsterHpForProgress = (maxHp: number, correctAnswers: number) => {
  const { targetMatches } = RUNE_MATCH_CONFIG.game;
  return Math.round(maxHp * Math.max(0, 1 - correctAnswers / targetMatches));
};

const endRound = (state: RuneMatchState, status: "victory" | "defeat"): RuneMatchState => ({
  ...state,
  status,
  selectedCell: null,
  hintCells: [],
  floatingTexts: [],
  message: null,
  inputLockMs: 0,
  wrongCells: [],
  monsterState: status === "victory" ? "death" : "idle",
  monsterStateTimer: 0,
});

/**
 * `remainingMs` comes from the round clock in a live round, so a slow phone ends
 * with everyone else. Demos have no clock and count `deltaMs` instead.
 */
export const advanceTime = (state: RuneMatchState, deltaMs: number, remainingMs?: number): RuneMatchState => {
  if (state.status !== "playing") return state;
  const { durationMs } = RUNE_MATCH_CONFIG.game;
  const newState = { ...state };
  newState.gameTimeMs = remainingMs === undefined ? state.gameTimeMs + deltaMs : durationMs - remainingMs;
  const timeLeft = Math.max(0, durationMs - newState.gameTimeMs);
  newState.player = { ...newState.player, hp: timeLeft };

  if (timeLeft <= 0) return endRound(newState, "defeat");

  if (newState.monsterStateTimer > 0) {
    newState.monsterStateTimer -= deltaMs;
    if (newState.monsterStateTimer <= 0) {
      newState.monsterState = "idle";
      newState.monsterStateTimer = 0;
    }
  }

  if (newState.inputLockMs > 0) {
    newState.inputLockMs = Math.max(0, newState.inputLockMs - deltaMs);
    if (newState.inputLockMs === 0) newState.wrongCells = [];
  }

  if (newState.message) {
    const remaining = newState.message.remainingMs - deltaMs;
    newState.message = remaining > 0 ? { ...newState.message, remainingMs: remaining } : null;
  }

  if (newState.bursts.length > 0) {
    newState.bursts = newState.bursts
      .map((burst) => ({ ...burst, remainingMs: burst.remainingMs - deltaMs }))
      .filter((burst) => burst.remainingMs > 0);
  }

  if (newState.floatingTexts.length > 0) {
    newState.floatingTexts = newState.floatingTexts
      .map((ft) => {
        const remaining = ft.duration - deltaMs;
        const progress = 1 - remaining / ft.maxDuration;
        return {
          ...ft,
          offsetY: ft.offsetY - (deltaMs / 1000) * 40,
          opacity: Math.max(0, 1 - progress * progress),
          scale: 1 + progress * 0.15,
          duration: remaining,
        };
      })
      .filter((ft) => ft.duration > 0);
  }

  // The goblin only poses; it has no effect on the round. The warning means
  // something only near the end, so it waits for the last seconds.
  if (newState.monster) {
    newState.nextAttackTimer -= deltaMs;
    if (newState.nextAttackTimer <= 0) {
      if (timeLeft <= HURRY_WINDOW_MS && !newState.message) {
        newState.message = { text: translateText("HURRY!"), tone: "bad", remainingMs: MESSAGE_MS };
      }
      newState.monsterState = "attack";
      newState.monsterStateTimer = 500;
      newState.nextAttackTimer = 3000 + state.rng() * 2000;
    }
  }

  return newState;
};

/** Only these need the round to redraw between clock ticks. */
export const needsFastTick = (state: RuneMatchState) => state.floatingTexts.length > 0 || state.inputLockMs > 0;

// Special move: new tiles for the whole board
export const shuffleGrid = (state: RuneMatchState): RuneMatchState => {
  if (state.status !== "playing" || state.specialMoves.shuffle <= 0) return state;
  return {
    ...state,
    grid: initializeGrid(state.activeVocabulary, { rng: state.rng, doneWordIds: state.doneWordIds }),
    selectedCell: null,
    hintCells: [],
    message: null,
    specialMoves: { shuffle: state.specialMoves.shuffle - 1 },
    floatingTexts: [...state.floatingTexts, floatingText(translateText("SHUFFLE!"), -1, -1, "#22c55e", 1400)],
  };
};

export const applyHint = (state: RuneMatchState): RuneMatchState => {
  if (state.status !== "playing" || state.hintsRemaining <= 0) return state;
  // A hint already showing: a second press must not spend another one.
  if (state.hintCells.length > 0) return state;
  const moves = findPossibleMoves(state.grid);
  if (moves.length === 0) return state;
  const move = randomItem(moves, state.rng);
  return {
    ...state,
    hintsRemaining: state.hintsRemaining - 1,
    hintCells: [move.from, move.to],
    selectedCell: null,
    message: { text: RUNE_HINT_TEXT, tone: "info", remainingMs: MESSAGE_MS },
  };
};

const pairText = (state: RuneMatchState, rune: Rune) => {
  const word = state.activeVocabulary.find((item) => wordKey(item) === rune.wordId);
  return word ? `${word.term} = ${word.translation}` : rune.text;
};

export const applyPairMatchResult = (
  state: RuneMatchState,
  first: GridPosition,
  second: GridPosition,
): RuneMatchState => {
  if (state.status !== "playing") return state;

  const firstRune = state.grid[first.row]?.[first.col];
  const secondRune = state.grid[second.row]?.[second.col];
  if (!firstRune || !secondRune || !isRunePairMatch(firstRune, secondRune)) return state;

  const termRune = firstRune.face === "term" ? firstRune : secondRune;
  const correctAnswers = state.correctAnswers + 1;
  const isVictory = correctAnswers >= RUNE_MATCH_CONFIG.game.targetMatches;

  // Finished words wait until the whole list has had a turn, then come back,
  // so a 4-word lesson can still reach 10 pairs.
  const active = state.activeVocabulary;
  let doneWordIds = state.doneWordIds.includes(termRune.wordId)
    ? state.doneWordIds
    : [...state.doneWordIds, termRune.wordId];
  if (active.every((item) => doneWordIds.includes(wordKey(item)))) doneWordIds = [];

  const matched: RuneMatchState = {
    ...state,
    grid: isVictory ? state.grid : refillAfterMatch(state.grid, [first, second], active, doneWordIds, state.rng),
    doneWordIds,
    selectedCell: null,
    hintCells: [],
    correctAnswers,
    totalAttempts: state.totalAttempts + 1,
    currentStreak: state.currentStreak + 1,
    // One right pair earns back one step, so lucky guesses do not undo the lock.
    wrongStreak: Math.max(0, state.wrongStreak - 1),
    monster: state.monster
      ? { ...state.monster, hp: monsterHpForProgress(state.monster.maxHp, correctAnswers) }
      : null,
    monsterState: "hurt",
    monsterStateTimer: 500,
    message: { text: pairText(state, termRune), tone: "good", remainingMs: MESSAGE_MS },
    bursts: [
      ...state.bursts,
      { ...first, id: generateId(), remainingMs: BURST_MS },
      { ...second, id: generateId(), remainingMs: BURST_MS },
    ],
    floatingTexts: [...state.floatingTexts, floatingText("+1", second.col, second.row, "#22c55e", 1000)],
  };
  return isVictory ? endRound(matched, "victory") : matched;
};

/** A wrong pair costs time, shows what the tile really means, and costs more if it happens again. */
const applyWrongPair = (state: RuneMatchState, first: GridPosition, second: GridPosition): RuneMatchState => {
  const { wrongPairLockMs } = RUNE_MATCH_CONFIG.friction;
  const wrongStreak = state.wrongStreak + 1;
  const lockMs = wrongPairLockMs[Math.min(wrongStreak, wrongPairLockMs.length) - 1];
  return {
    ...state,
    selectedCell: null,
    totalAttempts: state.totalAttempts + 1,
    wrongAttempts: state.wrongAttempts + 1,
    currentStreak: 0,
    wrongStreak,
    inputLockMs: lockMs,
    inputLockTotalMs: lockMs,
    wrongCells: [first, second],
    message: {
      text: pairText(state, state.grid[first.row][first.col]),
      tone: "bad",
      remainingMs: Math.max(lockMs, MESSAGE_MS),
    },
    floatingTexts: [
      ...state.floatingTexts,
      floatingText(translateText("WRONG PAIR"), second.col, second.row, "#ef4444", 1200),
    ],
  };
};

/** One tap on a tile. `nowMs` only tells a shaky double tap from a real cancel. */
export const tapRune = (state: RuneMatchState, tapped: GridPosition, nowMs = 0): RuneMatchState => {
  if (state.status !== "playing" || state.inputLockMs > 0) return state;

  const selected = state.selectedCell;
  if (!selected) return { ...state, selectedCell: tapped, selectedAtMs: nowMs };

  if (selected.row === tapped.row && selected.col === tapped.col) {
    if (nowMs - state.selectedAtMs < RUNE_MATCH_CONFIG.friction.doubleTapMs) return state;
    return { ...state, selectedCell: null };
  }

  const firstRune = state.grid[selected.row]?.[selected.col];
  const secondRune = state.grid[tapped.row]?.[tapped.col];
  const isTouching = Math.abs(selected.row - tapped.row) + Math.abs(selected.col - tapped.col) === 1;

  if (!isTouching) {
    // The child found the right pair; only the rule stops it. Say so, and do not count a try.
    if (isRunePairMatch(firstRune, secondRune)) {
      return {
        ...state,
        selectedCell: null,
        message: { text: RUNE_NOT_TOUCHING_TEXT, tone: "info", remainingMs: MESSAGE_MS },
      };
    }
    return { ...state, selectedCell: tapped, selectedAtMs: nowMs };
  }

  if (!isRunePairMatch(firstRune, secondRune)) return applyWrongPair(state, selected, tapped);

  const matched = applyPairMatchResult(state, selected, tapped);
  if (matched.status !== "playing" || findPossibleMoves(matched.grid).length > 0) return matched;

  // Safety net: the pair floor should prevent this.
  return {
    ...matched,
    grid: initializeGrid(matched.activeVocabulary, { rng: matched.rng, doneWordIds: matched.doneWordIds }),
    floatingTexts: [...matched.floatingTexts, floatingText(translateText("RESHUFFLE!"), -1, -1, "#22c55e", 1400)],
  };
};

/** A word listed twice could never be practised twice, so it counts once. */
const uniqueByTerm = (vocabulary: readonly VocabularyItem[]) => {
  const seen = new Set<string>();
  return vocabulary.filter((item) => {
    const key = wordKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const createRuneMatchState = (
  vocabulary: VocabularyItem[],
  { rng = Math.random }: RuneDealOptions = {},
): RuneMatchState => {
  if (vocabulary.length === 0) throw new Error("Vocabulary cannot be empty");

  // Shuffle to avoid repeating the same words, then take the words for the 10-pair goal.
  const activeVocabulary = shuffled(uniqueByTerm(vocabulary), rng).slice(0, RUNE_MATCH_CONFIG.game.targetMatches);

  return {
    status: "selection",
    selectedMonster: null,
    player: {
      hp: RUNE_MATCH_CONFIG.game.durationMs,
      maxHp: RUNE_MATCH_CONFIG.game.durationMs,
    },
    monster: null,
    grid: [],
    selectedCell: null,
    selectedAtMs: 0,
    correctAnswers: 0,
    totalAttempts: 0,
    wrongAttempts: 0,
    nextAttackTimer: 3000,
    activeVocabulary,
    vocabulary,
    doneWordIds: [],
    rng,
    floatingTexts: [],
    bursts: [],
    message: null,
    monsterState: "idle",
    monsterStateTimer: 0,
    currentStreak: 0,
    wrongStreak: 0,
    inputLockMs: 0,
    inputLockTotalMs: 0,
    wrongCells: [],
    specialMoves: { shuffle: 1 },
    hintCells: [],
    hintsRemaining: 2,
    gameTimeMs: 0,
  };
};
