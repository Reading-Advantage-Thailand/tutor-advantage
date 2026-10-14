import { describe, expect, it } from "vitest";
import {
  CONFETTI_COLORS,
  CONFETTI_PRESETS,
  MAX_FALL_SPEED,
  MAX_PARTICLES,
  createParticles,
  isFinished,
  particleAlpha,
  prefersReducedMotion,
  shouldFire,
  stepParticles,
} from "./confettiModel";

const phone = { width: 390, height: 844 };

/** Deterministic RNG so the tests don't flake. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("createParticles", () => {
  it("caps the particle count for low-end phones", () => {
    for (const intensity of ["small", "medium", "big"] as const) {
      const particles = createParticles(intensity, phone, seeded());
      expect(particles).toHaveLength(Math.min(CONFETTI_PRESETS[intensity].count, MAX_PARTICLES));
      expect(particles.length).toBeLessThanOrEqual(90);
    }
    expect(createParticles("small", phone).length).toBeLessThan(createParticles("big", phone).length);
  });

  it("launches the fountain upwards from the origin with theme colors", () => {
    const particles = createParticles("medium", phone, seeded(7), { x: 0.5, y: 0.4 });
    for (const p of particles) {
      expect(p.x).toBeCloseTo(195);
      expect(p.y).toBeCloseTo(337.6);
      expect(p.vy).toBeLessThan(0);
      expect(CONFETTI_COLORS).toContain(p.color);
      expect(["rect", "circle", "star"]).toContain(p.shape);
    }
  });

  it("adds bottom-corner cannons only for big wins", () => {
    const big = createParticles("big", phone, seeded(3));
    expect(big.some((p) => p.x === 0 && p.y === phone.height)).toBe(true);
    expect(big.some((p) => p.x === phone.width && p.y === phone.height)).toBe(true);
    const medium = createParticles("medium", phone, seeded(3));
    expect(medium.some((p) => p.y === phone.height)).toBe(false);
  });
});

describe("stepParticles", () => {
  it("applies gravity so particles rise, slow down and fall", () => {
    const particles = createParticles("small", phone, seeded(11));
    const startY = particles[0].y;
    stepParticles(particles, 1 / 60);
    expect(particles[0].y).toBeLessThan(startY);
    for (let i = 0; i < 180; i++) stepParticles(particles, 1 / 60);
    expect(particles.every((p) => p.vy > 0)).toBe(true);
  });
});

describe("particleAlpha", () => {
  it("stays opaque, then fades out over the last 30%", () => {
    expect(particleAlpha(0, 2000)).toBe(1);
    expect(particleAlpha(1400, 2000)).toBe(1);
    expect(particleAlpha(1700, 2000)).toBeCloseTo(0.5);
    expect(particleAlpha(2000, 2000)).toBe(0);
    expect(particleAlpha(5000, 2000)).toBe(0);
  });
});

describe("isFinished", () => {
  it("ends when time is up or everything has fallen off-screen", () => {
    const particles = createParticles("small", phone, seeded(5));
    expect(isFinished(particles, 100, 1600, phone)).toBe(false);
    expect(isFinished(particles, 1600, 1600, phone)).toBe(true);
    for (const p of particles) {
      p.y = phone.height + 50;
      p.vy = 100;
    }
    expect(isFinished(particles, 100, 1600, phone)).toBe(true);
  });
});

describe("shouldFire", () => {
  it("treats false/null/undefined/0 as 'not yet' and anything else as a fire key", () => {
    expect([false, null, undefined, 0].map(shouldFire)).toEqual([false, false, false, false]);
    expect([true, 1, 2, "review-1"].map(shouldFire)).toEqual([true, true, true, true]);
  });
});

describe("prefersReducedMotion", () => {
  const host = (matches: boolean) => ({ matchMedia: () => ({ matches }) });

  it("follows the media query", () => {
    expect(prefersReducedMotion(host(true))).toBe(true);
    expect(prefersReducedMotion(host(false))).toBe(false);
  });

  it("plays it safe without matchMedia (SSR / old webviews)", () => {
    expect(prefersReducedMotion(undefined)).toBe(true);
    expect(prefersReducedMotion({})).toBe(true);
    expect(
      prefersReducedMotion({
        matchMedia: () => {
          throw new Error("nope");
        },
      }),
    ).toBe(true);
  });
});

describe("falling", () => {
  it("drifts down like paper instead of dropping like a stone", () => {
    const particles = createParticles("big", phone, seeded(13));
    for (let i = 0; i < 240; i++) stepParticles(particles, 1 / 60);
    expect(particles.every((p) => p.vy <= MAX_FALL_SPEED)).toBe(true);
  });
});
