import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  usePotionRushStore,
  type Cauldron,
  type Customer,
  type Ingredient,
  type SentenceItem,
} from "./usePotionRushStore";

const sentence: SentenceItem = {
  id: "sentence-1",
  term: "Mix the potion",
  translation: "ผสมยา",
};

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "customer-1",
  type: "wizard",
  request: sentence,
  patience: 30,
  maxPatience: 60,
  state: "WAITING",
  ...overrides,
});

const ingredient = (word: string, id = word): Ingredient => ({
  id,
  word,
  x: 100,
  y: 500,
  type: "herb",
  width: 80,
  isDragging: false,
});

const store = () => usePotionRushStore.getState();

function drop(word: string, cauldronIndex = 0) {
  const id = `${word}-${Math.random()}`;
  usePotionRushStore.setState((state) => ({ conveyorItems: [...state.conveyorItems, ingredient(word, id)] }));
  store().handleDropIngredient(cauldronIndex, id);
  return id;
}

beforeEach(() => {
  store().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Potion Rush tutor balancing", () => {
  it("awards one uncapped point without ending early or unpausing a tutorial", () => {
    store().startGame([sentence], "easy");

    const completedCauldron: Cauldron = {
      id: 0,
      state: "COMPLETED",
      targetSentence: sentence,
      currentWords: sentence.term.split(" "),
    };

    usePotionRushStore.setState({
      gameState: "PAUSED",
      score: 10,
      completedSentences: 10,
      customers: [customer(), null, null],
      cauldrons: [
        completedCauldron,
        { id: 1, state: "IDLE", targetSentence: null, currentWords: [] },
        { id: 2, state: "IDLE", targetSentence: null, currentWords: [] },
      ],
    });

    store().handleServeCustomer("customer-1", 0);

    const state = store();
    expect(state.score).toBe(11);
    expect(state.completedSentences).toBe(11);
    expect(state.gameState).toBe("PAUSED");
  });

  it("uses the slower easy belt and keeps spawned ingredients about 160px apart", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({
      customers: [customer(), null, null],
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });

    store().tick(0.1, 390);

    const state = store();
    expect(state.beltSpeed).toBe(45);
    expect(state.conveyorItems).toHaveLength(1);
    expect(state.timeToNextIngredientSpawn).toBeCloseTo(160 / 45, 5);
  });

  it("keeps a finished round at game over when later animation frames arrive", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({ gameTime: 59.9 });

    store().tick(0.2, 390);
    const finishedTime = store().gameTime;

    expect(store().gameState).toBe("GAME_OVER");

    store().tick(1, 390);

    expect(store().gameState).toBe("GAME_OVER");
    expect(store().gameTime).toBe(finishedTime);
  });
});

describe("Potion Rush tutor demo rules", () => {
  it("serves a full pot by itself and scores one point", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({ customers: [customer(), null, null] });
    drop("mix");
    drop("the");
    drop("potion");
    expect(store()).toMatchObject({ completedSentences: 1, score: 1, gameState: "PLAYING" });
    expect(store().customers[0]?.state).toBe("LEAVING_HAPPY");
  });

  it("keeps the pot's words and the wrong word when a word is wrong", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({ customers: [customer(), null, null] });
    drop("mix");
    const wrongId = drop("potion");
    expect(store().cauldrons[0]).toMatchObject({ state: "BREWING", currentWords: ["Mix"] });
    expect(store().conveyorItems.map((item) => item.id)).toContain(wrongId);
  });

  it("does not take a word on a pot with no customer", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({ customers: [customer(), null, null] });
    const id = drop("mix", 2);
    expect(store().conveyorItems.map((item) => item.id)).toContain(id);
    expect(store().cauldrons[2].state).toBe("IDLE");
    expect(store().wrongDrops).toBe(0);
  });

  it("brings back a trashed word", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({
      customers: [customer(), null, null],
      conveyorItems: [ingredient("the"), ingredient("potion")],
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().tick(0.016, 390);
    expect(store().conveyorItems.map((item) => item.word)).toEqual(["the", "potion", "mix"]);
  });

  it("does not end the demo for customers who gave up", () => {
    store().startGame([sentence], "easy");
    usePotionRushStore.setState({ customers: [customer({ patience: 0.01 }), null, null], timeToNextCustomerSpawn: 99 });
    store().tick(0.05, 390);
    expect(store()).toMatchObject({ gameState: "PLAYING", angryCustomers: 1 });
  });
});

describe("Potion Rush tutorial scene", () => {
  const sentences: SentenceItem[] = [
    { id: "long", term: "Students read the whole long article carefully", translation: "ก" },
    { id: "short", term: "We learn.", translation: "ข" },
  ];

  it("uses the shortest sentence, paused, with the words in order on the belt", () => {
    store().prepareTutorialScene(sentences, "normal", 390);
    expect(store().gameState).toBe("PAUSED");
    expect(store().customers[0]?.request.id).toBe("short");
    expect(store().conveyorItems.map((item) => item.word)).toEqual(["we", "learn"]);
  });

  it("serves the customer on the last word and stays paused", () => {
    store().prepareTutorialScene(sentences, "normal", 390);
    const ids = store().conveyorItems.map((item) => item.id);
    ids.forEach((id) => store().handleDropIngredient(0, id, { x: 64, y: 380 }));
    expect(store()).toMatchObject({ gameState: "PAUSED", completedSentences: 1 });
    expect(store().cauldrons[0].state).toBe("COMPLETED");
    expect(store().customers[0]?.state).toBe("LEAVING_HAPPY");
  });

  it("falls back to its own sentence when given nothing", () => {
    store().prepareTutorialScene([], "normal", 390);
    expect(store().customers[0]?.request.term).toBe("Students read the article carefully");
  });
});
