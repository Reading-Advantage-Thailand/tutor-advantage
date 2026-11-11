import { describe, expect, it } from "vitest";

import {
  advanceEnchantedLibraryTime,
  activateShield,
  BOOK_SPACING,
  checkBookCollisions,
  computeLibraryCamera,
  createEnchantedLibraryState,
  EXHAUSTED_STUN_MS,
  finishAnswerHold,
  FIXED_STEP_MS,
  HIT_STUN_MS,
  libraryBookArea,
  libraryInsets,
  libraryZoom,
  MANA_LOSS_SPIRIT_HIT,
  MAX_SPIRIT_SPEED,
  placeEdgeChips,
  rectsOverlap,
  selectNextTargetWord,
  spawnBooks,
  SPIRIT_GRACE_MS,
  SPIRIT_WARNING_MS,
  takeFixedSteps,
  type DirectionalInput,
  type EnchantedLibraryConfig,
  type EnchantedLibraryState,
  type Spirit,
} from "./enchantedLibrary";

const vocabulary = [
  { id: "1", term: "sun", translation: "พระอาทิตย์" },
  { id: "2", term: "moon", translation: "พระจันทร์" },
  { id: "3", term: "star", translation: "ดาว" },
  { id: "4", term: "sky", translation: "ท้องฟ้า" },
  { id: "5", term: "rain", translation: "ฝน" },
  { id: "6", term: "wind", translation: "ลม" },
];

const STILL: DirectionalInput = { up: false, down: false, left: false, right: false, cast: false, dx: 0, dy: 0 };
const live: EnchantedLibraryConfig = { vocabulary, masteryTarget: 1 };
const PHONE = { width: 390, height: 844 };

function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

/** Runs the game for this long. Books are out of reach unless a test puts the player on one. */
function run(state: EnchantedLibraryState, ms: number, input = STILL, config = live) {
  let next = state;
  for (let elapsed = 0; elapsed < ms; elapsed += FIXED_STEP_MS) {
    next = advanceEnchantedLibraryTime(next, input, FIXED_STEP_MS, config);
  }
  return next;
}

const ghost = (overrides: Partial<Spirit> = {}): Spirit => ({
  id: "ghost",
  x: 400,
  y: 300,
  radius: 15,
  velocityX: 0,
  velocityY: 0,
  speed: 3.5,
  bounced: false,
  hasHitPlayer: false,
  warnMs: 0,
  ...overrides,
});

describe("Enchanted Library ghosts", () => {
  it("sends no ghost during the opening grace period", () => {
    const state = run(createEnchantedLibraryState(vocabulary), SPIRIT_GRACE_MS - 100);
    expect(state.spirits).toHaveLength(0);
  });

  it("warns before a ghost moves, and a warned ghost cannot hurt", () => {
    const start = createEnchantedLibraryState(vocabulary);
    let state = run(start, SPIRIT_GRACE_MS + 50);
    expect(state.spirits).toHaveLength(1);
    const waiting = state.spirits[0];
    expect(waiting.warnMs).toBeGreaterThan(0);
    expect(waiting.velocityX).toBe(0);

    // Even right on top of the player it does nothing while warning.
    state = {
      ...state,
      spirits: [{ ...waiting, x: state.player.x, y: state.player.y }],
    };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.mana).toBe(start.mana);

    // Once the warning is over it sets off at its own speed.
    const launched = run(start, SPIRIT_GRACE_MS + SPIRIT_WARNING_MS + 100).spirits[0];
    expect(launched.warnMs).toBe(0);
    expect(Math.hypot(launched.velocityX, launched.velocityY)).toBeCloseTo(launched.speed, 5);
  });

  it("keeps ghost speed within what a child can react to across a whole round", () => {
    const state = run(createEnchantedLibraryState(vocabulary), 60_000);
    expect(state.spiritSpeed).toBeLessThanOrEqual(MAX_SPIRIT_SPEED);
  });

  it("does not hit a child who stands still with every ghost", () => {
    const hitsPerRound: number[] = [];
    for (let seed = 1; seed <= 12; seed++) {
      let state = createEnchantedLibraryState(vocabulary, { rng: seeded(seed) });
      let hits = 0;
      let launched = 0;
      const seen = new Set<string>();
      for (let elapsed = 0; elapsed < 60_000; elapsed += FIXED_STEP_MS) {
        state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, { ...live, rng: seeded(seed + elapsed) });
        state.events.forEach((event) => {
          if (event.kind === "hit") hits++;
        });
        state.spirits.forEach((spirit) => {
          if (!seen.has(spirit.id)) {
            seen.add(spirit.id);
            launched++;
          }
        });
      }
      expect(state.status).toBe("playing");
      expect(hits).toBeLessThan(launched);
      hitsPerRound.push(hits);
    }
    const average = hitsPerRound.reduce((sum, hits) => sum + hits, 0) / hitsPerRound.length;
    expect(average).toBeLessThan(8);
  });

  it("a hit costs mana and a short stun, and only once per ghost", () => {
    let state = createEnchantedLibraryState(vocabulary);
    state = { ...state, spiritSpawnTimer: 99_999, spirits: [ghost({ x: state.player.x, y: state.player.y })] };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.mana).toBe(50 - MANA_LOSS_SPIRIT_HIT);
    expect(state.stunMs).toBe(HIT_STUN_MS);
    expect(state.events.map((event) => event.kind)).toContain("hit");

    const after = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(after.mana).toBe(state.mana);
  });

  it("a stunned wizard cannot walk, and walks again afterwards", () => {
    const walkRight = { ...STILL, right: true, dx: 1 };
    let state = createEnchantedLibraryState(vocabulary);
    state = { ...state, stunMs: HIT_STUN_MS, stunReason: "hit", books: [] };
    const x = state.player.x;
    state = run(state, HIT_STUN_MS - 50, walkRight);
    expect(state.player.x).toBe(x);
    state = run(state, 200, walkRight);
    expect(state.player.x).toBeGreaterThan(x);
  });

  it("mana 0 costs a rest and never ends the round", () => {
    let state = createEnchantedLibraryState(vocabulary);
    state = { ...state, mana: MANA_LOSS_SPIRIT_HIT, spiritSpawnTimer: 99_999, spirits: [ghost({ x: state.player.x, y: state.player.y })] };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.status).toBe("playing");
    expect(state.mana).toBeGreaterThan(0);
    expect(state.stunMs).toBe(EXHAUSTED_STUN_MS);
    expect(state.stunReason).toBe("exhausted");
  });

  it("only the clock ends a round for a child who never answers", () => {
    let state = { ...createEnchantedLibraryState(vocabulary), timeRemaining: 60_000 };
    state = run(state, 59_000);
    expect(state.status).toBe("playing");
    state = run(state, 1_100);
    expect(state.status).toBe("gameover");
  });

  it("the shield bounces a ghost away for good, and a bounced ghost never hits", () => {
    let state = activateShield(createEnchantedLibraryState(vocabulary));
    state = {
      ...state,
      spiritSpawnTimer: 99_999,
      spirits: [ghost({ x: state.player.x - 30, y: state.player.y, velocityX: 3.5, velocityY: 0 })],
    };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.spirits[0].bounced).toBe(true);
    expect(state.spirits[0].velocityX).toBeLessThan(0);

    const firstBounce = state.spirits[0].velocityX;
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.spirits[0].velocityX).toBe(firstBounce);

    state = { ...state, shieldActive: false };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(state.mana).toBe(50);
  });

  it("reports the shield once, on activation", () => {
    const state = createEnchantedLibraryState(vocabulary);
    const cast = { ...STILL, cast: true };
    const first = advanceEnchantedLibraryTime(state, cast, FIXED_STEP_MS, live);
    expect(first.events.map((event) => event.kind)).toEqual(["shield"]);
    const second = advanceEnchantedLibraryTime(first, cast, FIXED_STEP_MS, live);
    expect(second.events).toEqual([]);
    expect(second.player.shieldCharges).toBe(first.player.shieldCharges);
  });

  it("stays harmless in the tutorial", () => {
    let state = createEnchantedLibraryState(vocabulary);
    state = { ...state, spiritSpawnTimer: 99_999, spirits: [ghost({ x: state.player.x, y: state.player.y })] };
    state = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, { ...live, isTutorial: true, tutorialMode: true });
    expect(state.mana).toBe(50);
    expect(state.stunMs).toBe(0);
  });
});

describe("Enchanted Library answers", () => {
  const standOn = (state: EnchantedLibraryState, correct: boolean) => {
    const book = state.books.find((b) => b.isCorrect === correct)!;
    return { ...state, player: { ...state.player, x: book.x, y: book.y } };
  };

  it("holds the world and shows the right pair after a wrong pick, then moves to another word", () => {
    let state = checkBookCollisions(standOn(createEnchantedLibraryState(vocabulary), false));
    const target = state.targetWord;
    const meaning = vocabulary.find((word) => word.term === target)!.translation;
    expect(state.reveal).toEqual({ kind: "wrong", term: target, meaning });
    expect(state.mana).toBe(45);
    expect(state.pauseMs).toBeGreaterThan(1000);

    // The prompt and board stay while the child reads.
    const board = state.books;
    const held = advanceEnchantedLibraryTime(state, { ...STILL, dx: 1, right: true }, FIXED_STEP_MS, live);
    expect(held.targetWord).toBe(target);
    expect(held.books).toBe(board);
    expect(held.player.x).toBe(state.player.x);

    state = run(state, state.pauseMs + 50);
    expect(state.reveal).toBeNull();
    expect(state.targetWord).not.toBe(target);
    expect(state.missedWords.has(target)).toBe(true);
  });

  it("never shows a wrong pick in the tutorial's scripted walk", () => {
    const state = standOn(createEnchantedLibraryState(vocabulary), false);
    const tutorial = { ...live, isTutorial: true, tutorialMode: true };
    const next = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, tutorial);
    expect(next.reveal).toBeNull();
    expect(next.missedWords.size).toBe(0);
  });

  it("holds a ghost still during the answer, so reading it is safe", () => {
    let state = checkBookCollisions(standOn(createEnchantedLibraryState(vocabulary), true));
    state = { ...state, spirits: [ghost({ x: 100, y: 100, velocityX: 3, velocityY: 0 })] };
    const held = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(held.spirits[0].x).toBe(100);
  });

  it("the round clock keeps running during a hold", () => {
    const state = checkBookCollisions(standOn(createEnchantedLibraryState(vocabulary), false));
    const held = advanceEnchantedLibraryTime(state, STILL, FIXED_STEP_MS, live);
    expect(held.timeRemaining).toBeLessThan(state.timeRemaining);
  });

  it("puts a missed word behind every word not yet tried", () => {
    const start = createEnchantedLibraryState(vocabulary);
    const missedWords = new Set([vocabulary[1].term]);
    const state = { ...start, targetWord: vocabulary[0].term, missedWords };
    for (let seed = 1; seed < 30; seed++) {
      const next = selectNextTargetWord(state, vocabulary, { rng: seeded(seed), masteryTarget: 1 });
      expect(next).not.toBe(vocabulary[0].term);
      expect(next).not.toBe(vocabulary[1].term);
    }
  });

  it("asks a missed word again once nothing else is left, and the round can then end", () => {
    const start = createEnchantedLibraryState(vocabulary);
    const progress = new Map(vocabulary.map((word) => [word.term, 1]));
    progress.set("sun", 0);
    const state = { ...start, targetWord: "sun", vocabularyProgress: progress, missedWords: new Set(["sun"]) };
    expect(selectNextTargetWord(state, vocabulary, { masteryTarget: 1 })).toBe("sun");

    const allFound = { ...state, vocabularyProgress: new Map(vocabulary.map((word) => [word.term, 1])) };
    expect(finishAnswerHold(allFound, live).status).toBe("victory");
  });

  it("shows the last word's answer before the round ends", () => {
    const start = createEnchantedLibraryState([vocabulary[0], vocabulary[1]]);
    const progress = new Map(start.vocabularyProgress);
    const other = start.targetWord === vocabulary[0].term ? vocabulary[1].term : vocabulary[0].term;
    progress.set(other, 1);
    const config = { vocabulary: [vocabulary[0], vocabulary[1]], masteryTarget: 1 };
    const walkOn = standOn({ ...start, vocabularyProgress: progress }, true);
    const picked = advanceEnchantedLibraryTime(walkOn, STILL, FIXED_STEP_MS, config);
    expect(picked.status).toBe("playing");
    expect(picked.reveal?.kind).toBe("correct");
    expect(run(picked, picked.pauseMs + 50, STILL, config).status).toBe("victory");
  });
});

describe("Enchanted Library board", () => {
  const player = createEnchantedLibraryState(vocabulary).player;

  it("never offers a decoy that reads the same as the answer", () => {
    const words = [
      { id: "a", term: "idiom", translation: "สำนวน" },
      { id: "b", term: "expression", translation: "สำนวน" },
      { id: "c", term: "sun", translation: "พระอาทิตย์" },
      { id: "d", term: "moon", translation: "พระจันทร์" },
    ];
    for (let seed = 1; seed < 40; seed++) {
      const books = spawnBooks(words[0], words, player, seeded(seed));
      expect(books.filter((book) => book.translation === "สำนวน")).toHaveLength(1);
      expect(books).toHaveLength(3);
    }
  });

  it("shows fewer books on a small list instead of padding", () => {
    const words = [vocabulary[0], vocabulary[1]];
    expect(spawnBooks(words[0], words, player, seeded(3))).toHaveLength(2);
  });

  it("keeps books far enough apart that a label is nearest its own book", () => {
    for (let seed = 1; seed < 60; seed++) {
      const books = spawnBooks(vocabulary[0], vocabulary, player, seeded(seed));
      expect(books).toHaveLength(4);
      for (let i = 0; i < books.length; i++) {
        for (let j = i + 1; j < books.length; j++) {
          expect(Math.hypot(books[i].x - books[j].x, books[i].y - books[j].y)).toBeGreaterThanOrEqual(BOOK_SPACING);
        }
      }
    }
  });

  it("puts all four books on screen on a portrait phone, clear of the HUD and controls", () => {
    const insets = libraryInsets(PHONE);
    const positions = [{ x: 400, y: 300 }, { x: 60, y: 60 }, { x: 740, y: 540 }, { x: 400, y: 560 }];
    let boards = 0;
    let inView = 0;
    for (let seed = 1; seed < 200; seed++) {
      const from = positions[seed % positions.length];
      const here = { ...player, ...from };
      const camera = computeLibraryCamera(PHONE, here, insets);
      const books = spawnBooks(vocabulary[0], vocabulary, here, seeded(seed), libraryBookArea(PHONE, here, insets));
      boards++;
      const visible = books.every((book) => {
        const x = book.x * camera.scale + camera.x;
        const y = book.y * camera.scale + camera.y;
        return x > 0 && x < PHONE.width && y > insets.top && y < PHONE.height - insets.bottom;
      });
      if (visible) inView++;
    }
    expect(inView / boards).toBeGreaterThan(0.95);
  });
});

describe("Enchanted Library board on a landscape phone", () => {
  it("keeps new books and labels clear of the stick and Shield at the sides", () => {
    const view = { width: 768, height: 390 };
    const insets = libraryInsets(view);
    const player = createEnchantedLibraryState(vocabulary).player;
    const stickRight = 150;
    let clear = 0;
    let boards = 0;
    for (let seed = 1; seed < 150; seed++) {
      const here = { ...player, x: 100 + (seed * 37) % 600, y: 60 + (seed * 53) % 480 };
      const camera = computeLibraryCamera(view, here, insets);
      const books = spawnBooks(vocabulary[0], vocabulary, here, seeded(seed), libraryBookArea(view, here, insets));
      boards++;
      const ok = books.every((book) => {
        const x = book.x * camera.scale + camera.x;
        return x - 75 >= stickRight && x + 75 <= view.width - stickRight;
      });
      if (ok) clear++;
    }
    expect(clear / boards).toBeGreaterThan(0.9);
  });
});

describe("Enchanted Library camera", () => {
  it("shows the same part of the map across phones, and keeps sprites readable", () => {
    expect(libraryZoom(PHONE)).toBeCloseTo(0.8125, 3);
    expect(390 / libraryZoom(PHONE)).toBeGreaterThanOrEqual(470);
    expect(360 / libraryZoom({ width: 360, height: 640 })).toBeGreaterThanOrEqual(470);
    expect(844 / libraryZoom({ width: 844, height: 390 })).toBeGreaterThanOrEqual(800);
  });

  it("keeps the whole map on a presenter screen, as before", () => {
    const view = { width: 1280, height: 800 };
    const camera = computeLibraryCamera(view, { x: 400, y: 300 }, libraryInsets(view));
    expect(camera.scale).toBeCloseTo(800 / 600, 3);
    expect(camera.y).toBeCloseTo(0, 3);
    expect(camera.x).toBeCloseTo((1280 - 800 * camera.scale) / 2, 3);
  });

  it("keeps the wizard above the controls and below the HUD on a portrait phone", () => {
    const insets = libraryInsets(PHONE);
    for (const player of [{ x: 400, y: 580 }, { x: 400, y: 20 }, { x: 20, y: 300 }, { x: 780, y: 300 }]) {
      const camera = computeLibraryCamera(PHONE, player, insets);
      const y = player.y * camera.scale + camera.y;
      expect(y).toBeGreaterThanOrEqual(insets.top);
      expect(y).toBeLessThanOrEqual(PHONE.height - insets.bottom);
    }
  });

  it("scrolls a small phone so bottom-row books can rise above the controls", () => {
    const view = { width: 360, height: 640 };
    const insets = libraryInsets(view);
    const camera = computeLibraryCamera(view, { x: 400, y: 580 }, insets);
    const mapBottom = 600 * camera.scale + camera.y;
    expect(mapBottom).toBeLessThanOrEqual(view.height - insets.bottom + 0.5);
  });
});

describe("takeFixedSteps", () => {
  it("runs the same number of steps per second at any frame rate", () => {
    for (const fps of [15, 30, 59, 60, 90, 120]) {
      let leftover = 0;
      let total = 0;
      for (let frame = 0; frame < fps; frame++) {
        const { steps, leftoverMs } = takeFixedSteps(leftover + 1000 / fps);
        leftover = leftoverMs;
        total += steps;
      }
      expect(Math.abs(total - 60)).toBeLessThanOrEqual(1);
    }
  });

  it("walks the same distance in one second on a slow and a fast phone", () => {
    const walkRight = { ...STILL, right: true, dx: 1 };
    const distanceAt = (fps: number) => {
      let state: EnchantedLibraryState = { ...createEnchantedLibraryState(vocabulary), books: [] };
      const startX = state.player.x;
      let leftover = 0;
      for (let frame = 0; frame < fps; frame++) {
        const { steps, leftoverMs } = takeFixedSteps(leftover + 1000 / fps);
        leftover = leftoverMs;
        for (let i = 0; i < steps; i++) {
          state = advanceEnchantedLibraryTime(state, walkRight, FIXED_STEP_MS, { masteryTarget: 1 });
        }
      }
      return state.player.x - startX;
    };
    expect(distanceAt(30)).toBeCloseTo(distanceAt(120), -1);
    expect(distanceAt(30)).toBeGreaterThan(170);
  });
});

describe("placeEdgeChips", () => {
  const view = { width: 390, height: 844 };
  const size = { width: 120, height: 44 };

  it("keeps chips on screen, off the HUD and controls, and apart", () => {
    const hud = { left: 0, top: 0, right: 130, bottom: 130 };
    const stick = { left: 0, top: 690, right: 160, bottom: 844 };
    const points = [
      { id: "a", x: -200, y: 40 },
      { id: "b", x: -300, y: 60 },
      { id: "c", x: -100, y: 800 },
      { id: "d", x: -100, y: 790 },
    ];
    const placed = placeEdgeChips(points, view, [hud, stick], size);
    const rects = placed.map((chip) => ({
      left: chip.left,
      top: chip.top,
      right: chip.left + size.width,
      bottom: chip.top + size.height,
    }));
    rects.forEach((rect, i) => {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(view.width);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.bottom).toBeLessThanOrEqual(view.height);
      expect(rectsOverlap(rect, hud)).toBe(false);
      expect(rectsOverlap(rect, stick)).toBe(false);
      rects.slice(i + 1).forEach((other) => expect(rectsOverlap(rect, other)).toBe(false));
    });
  });
});
