import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePotionRushStore, type Customer, type Ingredient, type SentenceItem } from "./usePotionRushStore";

const order: SentenceItem = { id: "1", term: "Mix the potion", translation: "ผสมยา" };
const longerOrders: SentenceItem[] = [
  order,
  { id: "2", term: "one two three four five six seven", translation: "ก" },
  { id: "3", term: "eight nine ten eleven twelve thirteen", translation: "ข" },
  { id: "4", term: "red green blue white black pink", translation: "ค" },
];

const customer = (overrides: Partial<Customer> = {}): Customer => ({
  id: "customer-1",
  type: "wizard",
  request: order,
  patience: 60,
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

function drop(word: string, cauldronIndex = 0) {
  const id = `${word}-${Math.random()}`;
  usePotionRushStore.setState((state) => ({ conveyorItems: [...state.conveyorItems, ingredient(word, id)] }));
  usePotionRushStore.getState().handleDropIngredient(cauldronIndex, id);
}

function startWithCustomer(orders: SentenceItem[]) {
  usePotionRushStore.getState().startGame(orders, "normal");
  usePotionRushStore.setState({ customers: [customer(), null, null] });
}

beforeEach(() => {
  usePotionRushStore.getState().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Potion Rush word score", () => {
  it("earns points for each word brewed in order", () => {
    startWithCustomer(longerOrders);
    expect(usePotionRushStore.getState().wordBudget).toBe(20);

    drop("Mix");
    expect(usePotionRushStore.getState()).toMatchObject({ placedWords: 1, score: 1 });
    drop("the");
    expect(usePotionRushStore.getState()).toMatchObject({ placedWords: 2, score: 1 });
    drop("potion");
    expect(usePotionRushStore.getState()).toMatchObject({ placedWords: 3, score: 2 });
  });

  it("earns nothing for a wrong word", () => {
    startWithCustomer(longerOrders);
    drop("the");
    expect(usePotionRushStore.getState()).toMatchObject({ placedWords: 0, score: 0 });
    expect(usePotionRushStore.getState().cauldrons[0].state).toBe("WARNING");
  });

  it("does not pay twice for refilling a dumped pot", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    usePotionRushStore.getState().handleDumpCauldron(0);
    drop("Mix");
    drop("the");
    expect(usePotionRushStore.getState().placedWords).toBe(2);
    drop("potion");
    expect(usePotionRushStore.getState().placedWords).toBe(3);
  });

  it("ends the round at full marks when the budget is reached", () => {
    startWithCustomer([order]);
    expect(usePotionRushStore.getState().wordBudget).toBe(3);
    drop("Mix");
    drop("the");
    expect(usePotionRushStore.getState().gameState).toBe("PLAYING");
    drop("potion");
    expect(usePotionRushStore.getState()).toMatchObject({ gameState: "GAME_OVER", score: 10 });
  });
});

describe("Potion Rush round end", () => {
  it("keeps going after every order was served once, until the words run out or time is up", () => {
    usePotionRushStore.getState().startGame([order, longerOrders[1]], "normal");
    expect(usePotionRushStore.getState().wordBudget).toBe(10);

    for (const id of ["customer-1", "customer-2"]) {
      usePotionRushStore.setState({ customers: [customer({ id }), null, null] });
      drop("Mix");
      drop("the");
      drop("potion");
      usePotionRushStore.getState().handleServeCustomer(id, 0);
    }

    expect(usePotionRushStore.getState()).toMatchObject({ completedSentences: 2, placedWords: 6, gameState: "PLAYING" });
  });
});

describe("Potion Rush pacing", () => {
  it("brings the next customer in soon when nobody else is waiting", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    drop("potion");
    usePotionRushStore.setState({ timeToNextCustomerSpawn: 9 });
    usePotionRushStore.getState().handleServeCustomer("customer-1", 0);
    expect(usePotionRushStore.getState().timeToNextCustomerSpawn).toBe(1);
  });

  it("leaves the spawn timer alone while another customer waits", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ customers: [customer(), customer({ id: "customer-2", request: longerOrders[1] }), null] });
    drop("Mix");
    drop("the");
    drop("potion");
    usePotionRushStore.setState({ timeToNextCustomerSpawn: 9 });
    usePotionRushStore.getState().handleServeCustomer("customer-1", 0);
    expect(usePotionRushStore.getState().timeToNextCustomerSpawn).toBe(9);
  });

  it("spawns the word a waiting customer needs, even if it left the pool", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ activeWordPool: [], timeToNextIngredientSpawn: 0, timeToNextCustomerSpawn: 99 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    usePotionRushStore.getState().tick(0.016, 400);
    expect(usePotionRushStore.getState().conveyorItems.map((item) => item.word)).toEqual(["Mix"]);
  });

  it("does not repeat a needed word already on the belt", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      activeWordPool: ["potion"],
      conveyorItems: [ingredient("Mix")],
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    usePotionRushStore.getState().tick(0.016, 400);
    expect(usePotionRushStore.getState().conveyorItems.map((item) => item.word)).toEqual(["Mix", "potion"]);
  });

  it("caps how fast the belt gets", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      completedSentences: 20,
      conveyorItems: [ingredient("far")],
      timeToNextIngredientSpawn: 99,
      timeToNextCustomerSpawn: 99,
    });
    usePotionRushStore.getState().tick(1, 400);
    expect(usePotionRushStore.getState().conveyorItems[0].x).toBeCloseTo(100 - 130);
  });
});
