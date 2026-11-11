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

function startWithCustomer(orders: SentenceItem[]) {
  store().startGame(orders, "normal");
  usePotionRushStore.setState({ customers: [customer(), null, null] });
}

/** Runs the belt until `word` shows up, the way a child waiting for it would see it. */
function wordComesRound(word: string, seconds = 6) {
  usePotionRushStore.setState({ timeToNextCustomerSpawn: 99 });
  for (let t = 0; t < seconds; t += 0.05) {
    store().tick(0.05, 390);
    if (store().conveyorItems.some((item) => item.word.toLowerCase() === word.toLowerCase())) return true;
  }
  return false;
}

beforeEach(() => {
  store().reset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Potion Rush word score", () => {
  it("earns points for each word brewed in order", () => {
    startWithCustomer(longerOrders);
    expect(store().wordBudget).toBe(20);

    drop("Mix");
    expect(store()).toMatchObject({ placedWords: 1, score: 1 });
    drop("the");
    expect(store()).toMatchObject({ placedWords: 2, score: 1 });
    drop("potion");
    expect(store()).toMatchObject({ placedWords: 3, score: 2 });
  });

  it("earns nothing for a wrong word", () => {
    startWithCustomer(longerOrders);
    drop("the");
    expect(store()).toMatchObject({ placedWords: 0, score: 0, wrongDrops: 1 });
  });

  it("does not pay twice when the same customer's pot is refilled", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    // Nothing a player does empties a pot now, so empty it by hand to check the credit rule.
    usePotionRushStore.setState((state) => ({
      cauldrons: state.cauldrons.map((c, i) => (i === 0 ? { ...c, state: "IDLE" as const, currentWords: [] } : c)),
    }));
    drop("Mix");
    drop("the");
    expect(store().placedWords).toBe(2);
    drop("potion");
    expect(store().placedWords).toBe(3);
  });

  it("ends the round at full marks when the budget is reached", () => {
    startWithCustomer([order]);
    expect(store().wordBudget).toBe(3);
    drop("Mix");
    drop("the");
    expect(store().gameState).toBe("PLAYING");
    drop("potion");
    expect(store()).toMatchObject({ gameState: "GAME_OVER", score: 10, completedSentences: 1 });
  });
});

describe("Potion Rush round end", () => {
  it("keeps going after every order was served once, until the words run out or time is up", () => {
    store().startGame([order, longerOrders[1]], "normal");
    expect(store().wordBudget).toBe(10);

    usePotionRushStore.setState({ customers: [customer(), null, null] });
    drop("Mix");
    drop("the");
    drop("potion");
    usePotionRushStore.setState({ customers: [customer({ id: "customer-2" }), null, null], cauldrons: store().cauldrons.map((c, i) => (i === 0 ? { ...c, state: "IDLE" as const, currentWords: [] } : c)) });
    drop("Mix");
    drop("the");
    drop("potion");

    expect(store()).toMatchObject({ completedSentences: 2, placedWords: 6, gameState: "PLAYING" });
  });

  it("does not end for customers who gave up", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ customers: [customer({ patience: 0.01 }), null, null], timeToNextCustomerSpawn: 99 });
    store().tick(0.05, 390);
    expect(store()).toMatchObject({ gameState: "PLAYING", angryCustomers: 1 });
  });

  it("ends at the deadline with the time passed in, even if no frames ran", () => {
    startWithCustomer(longerOrders);
    store().endGame(60);
    expect(store()).toMatchObject({ gameState: "GAME_OVER", gameTime: 60 });
  });

  it("follows the real clock only when it has drifted", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ gameTime: 10 });
    store().syncGameTime(10.01);
    expect(store().gameTime).toBe(10);
    store().syncGameTime(12);
    expect(store().gameTime).toBe(12);
  });
});

describe("Potion Rush serving", () => {
  it("serves a full pot by itself, with no drag", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    drop("potion");
    expect(store().completedSentences).toBe(1);
    expect(store().customers[0]?.state).toBe("LEAVING_HAPPY");
    expect(store().cauldrons[0].state).toBe("COMPLETED");
  });

  it("shows the finished pot until the customer has gone, then empties it", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    drop("potion");
    usePotionRushStore.setState({ timeToNextCustomerSpawn: 99 });
    store().tick(1, 390);
    expect(store().cauldrons[0].state).toBe("COMPLETED");
    store().tick(1, 390);
    expect(store().customers[0]).toBeNull();
    expect(store().cauldrons[0].state).toBe("IDLE");
  });

  it("cannot pay out the same order twice", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    drop("potion");
    store().handleServeCustomer("customer-1", 0);
    expect(store().completedSentences).toBe(1);
  });

  it("finishes a one-word order and ignores a word dropped after it", () => {
    const one = { id: "9", term: "Go", translation: "ไป" };
    store().startGame([one, order], "normal");
    usePotionRushStore.setState({ customers: [customer({ request: one }), null, null] });
    drop("Go");
    expect(store().completedSentences).toBe(1);
    expect(() => drop("again")).not.toThrow();
    expect(store().completedSentences).toBe(1);
  });

  it("matches a word whatever its capitals and end punctuation", () => {
    const withPunctuation = { id: "8", term: "Now, we learn.", translation: "ก" };
    store().startGame([withPunctuation, order], "normal");
    usePotionRushStore.setState({ customers: [customer({ request: withPunctuation }), null, null] });
    drop("now");
    drop("we");
    drop("learn");
    expect(store().completedSentences).toBe(1);
    expect(store().cauldrons[0].currentWords).toEqual(["Now,", "we", "learn."]);
  });
});

describe("Potion Rush wrong words", () => {
  it("keeps the pot's words and returns the wrong word to the belt", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    const wrongId = drop("Mix");
    expect(store().cauldrons[0]).toMatchObject({ state: "BREWING", currentWords: ["Mix", "the"] });
    expect(store().conveyorItems.map((item) => item.id)).toContain(wrongId);
    expect(store().lastRejection).toMatchObject({ slot: 0, word: "Mix" });
    drop("potion");
    expect(store().completedSentences).toBe(1);
  });

  it("costs the customer some patience, and a right word earns some back", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ customers: [customer({ patience: 30 }), null, null] });
    drop("potion");
    expect(store().customers[0]?.patience).toBe(27);
    drop("Mix");
    expect(store().customers[0]?.patience).toBe(30);
  });

  it("rejects a word on a pot with no customer, at no cost and with a message", () => {
    startWithCustomer(longerOrders);
    const id = drop("Mix", 1);
    expect(store().conveyorItems.map((item) => item.id)).toContain(id);
    expect(store().cauldrons[1].state).toBe("IDLE");
    expect(store()).toMatchObject({ wrongDrops: 0, focusedSlot: 0 });
    expect(store().hint?.text).toBeTruthy();
    expect(store().lastRejection).toMatchObject({ slot: 1, word: "Mix" });
  });

  it("rejects a word on a finished pot and keeps the word", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    drop("potion");
    const id = drop("spare");
    expect(store().conveyorItems.map((item) => item.id)).toContain(id);
    expect(store().wrongDrops).toBe(0);
  });
});

describe("Potion Rush belt", () => {
  it("does not put a released word on top of another word", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [{ ...ingredient("a"), x: 100, isDragging: true }, { ...ingredient("b"), x: 120 }],
    });
    store().setIngredientDragging("a", false);
    expect(store().conveyorItems[0]).toMatchObject({ x: 220, isDragging: false });
  });

  it("leaves a held word in its slot", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [{ ...ingredient("a"), x: 65, isHeld: true, holdingSlotIndex: 0 }, { ...ingredient("b"), x: 70 }],
    });
    store().setIngredientDragging("a", false);
    expect(store().conveyorItems[0].x).toBe(65);
  });

  it("sends the word already in a slot back to a free place on the belt", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [
        { ...ingredient("a"), x: 65, isHeld: true, holdingSlotIndex: 0 },
        { ...ingredient("b"), x: 70 },
        { ...ingredient("c"), x: 300 },
      ],
    });
    store().handleHoldIngredient("c", 0);
    expect(store().conveyorItems[0]).toMatchObject({ x: 170, isHeld: false });
    expect(store().conveyorItems[2]).toMatchObject({ x: 65, isHeld: true, holdingSlotIndex: 0 });
  });

  it("does not put a word taken out of a slot on top of another word", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [{ ...ingredient("a"), x: 65, isHeld: true, holdingSlotIndex: 0 }, { ...ingredient("b"), x: 70 }],
    });
    store().releaseHold("a");
    expect(store().conveyorItems[0]).toMatchObject({ x: 170, isHeld: false });
  });
});

describe("Potion Rush customers who give up", () => {
  it("frees the slot and empties the pot, with no change to the score", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    const scoreBefore = store().placedWords;
    usePotionRushStore.setState({
      customers: [customer({ patience: 0.01, creditedWords: 1 }), null, null],
      timeToNextCustomerSpawn: 99,
    });
    store().tick(0.05, 390);
    expect(store().customers[0]?.state).toBe("LEAVING_ANGRY");
    expect(store().cauldrons[0].state).toBe("IDLE");
    expect(store().placedWords).toBe(scoreBefore);
    expect(store().timeToNextCustomerSpawn).toBeLessThanOrEqual(1);
    store().tick(1.6, 390);
    expect(store().customers[0]).toBeNull();
  });

  it("gives a new customer more time for a longer sentence", () => {
    store().startGame([longerOrders[1]], "normal");
    store().tick(0.016, 390);
    const seated = store().customers[0];
    expect(seated?.maxPatience).toBe(49);
    expect(seated?.patience).toBeCloseTo(49, 1);
  });
});

describe("Potion Rush word supply", () => {
  it("brings a trashed word back", () => {
    startWithCustomer(longerOrders);
    const id = "Mix-1";
    usePotionRushStore.setState({ conveyorItems: [ingredient("Mix", id)] });
    store().discardIngredient(id);
    expect(store().conveyorItems).toEqual([]);
    expect(wordComesRound("Mix")).toBe(true);
  });

  it("brings back a word that rolled off the belt", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [{ ...ingredient("Mix"), x: -199 }],
      timeToNextIngredientSpawn: 99,
      timeToNextCustomerSpawn: 99,
    });
    store().tick(0.05, 390);
    expect(store().conveyorItems).toEqual([]);
    usePotionRushStore.setState({ timeToNextIngredientSpawn: 0 });
    expect(wordComesRound("Mix")).toBe(true);
  });

  it("serving one customer leaves a shared word for the other", () => {
    store().startGame(longerOrders, "normal");
    const sharing = { id: "5", term: "the green potion", translation: "ข" };
    usePotionRushStore.setState({ customers: [customer(), customer({ id: "customer-2", request: sharing }), null] });
    drop("Mix");
    drop("the");
    drop("potion");
    expect(store().completedSentences).toBe(1);
    expect(wordComesRound("the")).toBe(true);
    const shared = store().conveyorItems.find((item) => item.word === "the");
    store().handleDropIngredient(1, shared!.id);
    expect(store().cauldrons[1].currentWords).toEqual(["the"]);
  });

  it("never leaves a waiting customer short of a word, whatever the player does", () => {
    store().startGame(longerOrders, "normal");
    const patient = { patience: 999, maxPatience: 999 };
    usePotionRushStore.setState({
      customers: [
        customer(patient),
        customer({ ...patient, id: "customer-2", request: longerOrders[1] }),
        customer({ ...patient, id: "customer-3", request: longerOrders[2] }),
      ],
      timeToNextCustomerSpawn: 99,
    });
    drop("Mix");
    drop("wrong");
    drop("eight", 2);
    store().discardIngredient(store().conveyorItems[0].id);
    usePotionRushStore.setState({ conveyorItems: [] });

    const missing = new Set(["the", "potion", "one", "two", "three", "four", "five", "six", "seven", "nine", "ten", "eleven", "twelve", "thirteen"]);
    // A fixed series of rolls, so the belt's draw does not make the test flaky.
    let seed = 7;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    });
    for (let t = 0; t < 59 && missing.size > 0; t += 0.05) {
      usePotionRushStore.setState({ gameTime: 0 });
      store().tick(0.05, 390);
      store().conveyorItems.forEach((item) => missing.delete(item.word));
    }
    expect([...missing]).toEqual([]);
  });

  it("spawns the word a waiting customer needs", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ timeToNextIngredientSpawn: 0, timeToNextCustomerSpawn: 99 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().tick(0.016, 400);
    expect(store().conveyorItems.map((item) => item.word)).toEqual(["mix"]);
  });

  it("does not repeat a needed word already on the belt", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [ingredient("mix")],
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().tick(0.016, 400);
    expect(store().conveyorItems.map((item) => item.word)).toEqual(["mix", "the"]);
  });

  it("forces a needed word after three seconds without one", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      timeSinceNextWord: 3,
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });
    // A roll that would not choose the needed word by chance.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    store().tick(0.016, 400);
    expect(store().conveyorItems.map((item) => item.word)).toEqual(["mix"]);
    expect(store().timeSinceNextWord).toBe(0);
  });

  it("puts nothing on the belt when every needed word is already out", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      conveyorItems: [ingredient("mix"), ingredient("the"), ingredient("potion")],
      timeToNextIngredientSpawn: 0,
      timeToNextCustomerSpawn: 99,
    });
    store().tick(0.016, 400);
    expect(store().conveyorItems).toHaveLength(3);
  });

  it("hides sentence-start capitals and end punctuation on the belt", () => {
    const sentence = { id: "6", term: "Students read.", translation: "ก" };
    store().startGame([sentence], "normal");
    usePotionRushStore.setState({ customers: [customer({ request: sentence }), null, null], timeToNextCustomerSpawn: 99, timeToNextIngredientSpawn: 0 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    store().tick(0.016, 400);
    expect(store().conveyorItems[0].word).toBe("students");
    usePotionRushStore.setState({ conveyorItems: [ingredient("students")], timeToNextIngredientSpawn: 0 });
    store().tick(0.016, 400);
    expect(store().conveyorItems[1].word).toBe("read");
  });
});

describe("Potion Rush pacing", () => {
  it("brings the next customer in soon when nobody else is waiting", () => {
    startWithCustomer(longerOrders);
    drop("Mix");
    drop("the");
    usePotionRushStore.setState({ timeToNextCustomerSpawn: 9 });
    drop("potion");
    expect(store().timeToNextCustomerSpawn).toBe(1);
  });

  it("leaves the spawn timer alone while another customer waits", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ customers: [customer(), customer({ id: "customer-2", request: longerOrders[1] }), null] });
    drop("Mix");
    drop("the");
    usePotionRushStore.setState({ timeToNextCustomerSpawn: 9 });
    drop("potion");
    expect(store().timeToNextCustomerSpawn).toBe(9);
  });

  it("does not add a customer while plenty of words are still on order", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      customers: [
        customer({ request: longerOrders[1] }),
        customer({ id: "customer-2", request: longerOrders[2] }),
        null,
      ],
      timeToNextCustomerSpawn: 0,
    });
    store().tick(0.016, 390);
    expect(store().customers[2]).toBeNull();
    expect(store().timeToNextCustomerSpawn).toBe(1);
  });

  it("does not seat two customers with the same sentence", () => {
    store().startGame(longerOrders, "normal");
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      usePotionRushStore.setState({ timeToNextCustomerSpawn: 0 });
      store().tick(0.016, 390);
    }
    store().customers.forEach((c) => {
      if (c) seen.push(c.request.term);
    });
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("caps how fast the belt gets", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({
      completedSentences: 20,
      conveyorItems: [ingredient("far")],
      timeToNextIngredientSpawn: 99,
      timeToNextCustomerSpawn: 99,
    });
    store().tick(1, 400);
    expect(store().conveyorItems[0].x).toBeCloseTo(100 - 130);
  });
});

describe("Potion Rush banner focus", () => {
  it("follows the pot the player last dropped into", () => {
    store().startGame(longerOrders, "normal");
    usePotionRushStore.setState({ customers: [customer(), customer({ id: "customer-2", request: longerOrders[1] }), null] });
    drop("one", 1);
    expect(store().focusedSlot).toBe(1);
  });

  it("follows a wrong drop too, so the child can see that pot's order", () => {
    store().startGame(longerOrders, "normal");
    usePotionRushStore.setState({ customers: [customer(), customer({ id: "customer-2", request: longerOrders[1] }), null] });
    drop("nope", 1);
    expect(store().focusedSlot).toBe(1);
  });

  it("moves on when its customer has gone", () => {
    store().startGame(longerOrders, "normal");
    usePotionRushStore.setState({
      customers: [customer({ patience: 0.01 }), customer({ id: "customer-2", request: longerOrders[1] }), null],
      timeToNextCustomerSpawn: 99,
    });
    store().tick(0.05, 390);
    expect(store().focusedSlot).toBe(1);
  });

  it("ignores a tap on an empty slot", () => {
    startWithCustomer(longerOrders);
    store().setFocusedSlot(2);
    expect(store().focusedSlot).toBe(0);
  });
});

describe("Potion Rush frame updates", () => {
  it("keeps the same pots and effects arrays when nothing changed, so they do not redraw", () => {
    startWithCustomer(longerOrders);
    usePotionRushStore.setState({ timeToNextIngredientSpawn: 99, timeToNextCustomerSpawn: 99 });
    const { cauldrons, effects } = store();
    store().tick(0.016, 390);
    expect(store().cauldrons).toBe(cauldrons);
    expect(store().effects).toBe(effects);
  });
});
