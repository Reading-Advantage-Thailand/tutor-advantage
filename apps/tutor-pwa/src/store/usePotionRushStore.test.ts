import { beforeEach, describe, expect, it } from "vitest";

import {
  usePotionRushStore,
  type Cauldron,
  type Customer,
  type SentenceItem,
} from "./usePotionRushStore";

const sentence: SentenceItem = {
  id: "sentence-1",
  term: "Mix the potion",
  translation: "ผสมยา",
};

beforeEach(() => {
  usePotionRushStore.getState().reset();
});

describe("Potion Rush tutor balancing", () => {
  it("awards one uncapped point without ending early or unpausing a tutorial", () => {
    usePotionRushStore.getState().startGame([sentence], "easy");

    const customer: Customer = {
      id: "customer-1",
      type: "wizard",
      request: sentence,
      patience: 60,
      maxPatience: 60,
      state: "WAITING",
    };
    const completedCauldron: Cauldron = {
      id: 0,
      state: "COMPLETED",
      targetSentence: sentence,
      currentWords: sentence.term.split(" "),
      shake: false,
    };

    usePotionRushStore.setState({
      gameState: "PAUSED",
      score: 10,
      completedSentences: 10,
      customers: [customer, null, null],
      cauldrons: [
        completedCauldron,
        { id: 1, state: "IDLE", targetSentence: null, currentWords: [], shake: false },
        { id: 2, state: "IDLE", targetSentence: null, currentWords: [], shake: false },
      ],
    });

    usePotionRushStore.getState().handleServeCustomer(customer.id, 0);

    const state = usePotionRushStore.getState();
    expect(state.score).toBe(11);
    expect(state.completedSentences).toBe(11);
    expect(state.gameState).toBe("PAUSED");
  });

  it("uses the slower easy belt and keeps spawned ingredients about 100px apart", () => {
    usePotionRushStore.getState().startGame([], "easy");
    usePotionRushStore.setState({
      activeWordPool: ["Mix"],
      timeToNextIngredientSpawn: 0,
    });

    usePotionRushStore.getState().tick(0.1, 390);

    const state = usePotionRushStore.getState();
    expect(state.beltSpeed).toBe(45);
    expect(state.conveyorItems).toHaveLength(1);
    expect(state.timeToNextIngredientSpawn).toBeCloseTo(100 / 45, 5);
  });

  it("keeps a finished round at game over when later animation frames arrive", () => {
    usePotionRushStore.getState().startGame([sentence], "easy");
    usePotionRushStore.setState({ gameTime: 59.9 });

    usePotionRushStore.getState().tick(0.2, 390);
    const finishedTime = usePotionRushStore.getState().gameTime;

    expect(usePotionRushStore.getState().gameState).toBe("GAME_OVER");

    usePotionRushStore.getState().tick(1, 390);

    expect(usePotionRushStore.getState().gameState).toBe("GAME_OVER");
    expect(usePotionRushStore.getState().gameTime).toBe(finishedTime);
  });
});
