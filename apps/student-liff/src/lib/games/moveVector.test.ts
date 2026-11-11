import { describe, expect, it } from "vitest";

import { clampMoveVector, stickVector } from "./moveVector";
import { advanceWizardZombieTime, createWizardZombieState, GAME_HEIGHT, GAME_WIDTH } from "./wizardZombie";
import { movePlayer } from "./castleDefense";

const length = ({ dx, dy }: { dx: number; dy: number }) => Math.hypot(dx, dy);

describe("clampMoveVector", () => {
  it("shrinks only what is longer than 1", () => {
    expect(length(clampMoveVector(1, 1))).toBeCloseTo(1);
    expect(clampMoveVector(1, 0)).toEqual({ dx: 1, dy: 0 });
    expect(clampMoveVector(0.5, 0.5)).toEqual({ dx: 0.5, dy: 0.5 });
    expect(clampMoveVector(0, 0)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("stickVector", () => {
  it("rests inside the dead zone", () => {
    expect(stickVector(3, 3)).toEqual({ dx: 0, dy: 0 });
  });

  it("walks at full length in every direction and keeps the thumb's angle", () => {
    for (let degrees = 10; degrees <= 80; degrees += 5) {
      const radians = (degrees * Math.PI) / 180;
      const vector = stickVector(Math.cos(radians) * 30, Math.sin(radians) * 30);
      expect(length(vector)).toBeCloseTo(1);
      expect((Math.atan2(vector.dy, vector.dx) * 180) / Math.PI).toBeCloseTo(degrees);
    }
  });

  it("holds a straight line through a small wobble", () => {
    expect(stickVector(30, 3)).toEqual({ dx: 1, dy: 0 });
    expect(stickVector(-3, -30)).toEqual({ dx: 0, dy: -1 });
  });
});

describe("walking speed", () => {
  const walked = (dx: number, dy: number) => {
    const words = [
      { term: "sun", translation: "พระอาทิตย์" },
      { term: "moon", translation: "พระจันทร์" },
    ];
    const state = createWizardZombieState(words, { difficulty: "medium" });
    const start = { ...state, player: { ...state.player, x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 }, zombies: [], orbs: [] };
    const next = advanceWizardZombieTime(start, 16.6, { dx, dy, cast: false }, words);
    return Math.hypot(next.player.x - start.player.x, next.player.y - start.player.y);
  };

  it("is the same straight and diagonal in Wizard vs Zombie", () => {
    const straight = walked(1, 0);
    expect(straight).toBeGreaterThan(0);
    expect(walked(Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(straight);
    expect(walked(1, 1)).toBeCloseTo(straight);
  });

  it("is the same straight and diagonal in Castle Defense", () => {
    const player = { x: 400, y: 300, radius: 10, speed: 3 } as Parameters<typeof movePlayer>[0];
    const moved = (dx: number, dy: number) => {
      const next = movePlayer(player, { dx, dy } as Parameters<typeof movePlayer>[1], 16.6);
      return Math.hypot(next.x - player.x, next.y - player.y);
    };
    expect(moved(Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(moved(1, 0));
  });
});
