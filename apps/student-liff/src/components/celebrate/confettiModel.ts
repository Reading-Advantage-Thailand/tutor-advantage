/**
 * Pure confetti physics + gating used by <Confetti />. No DOM access here
 * (except the injectable `matchMedia` check) so it can be unit-tested.
 */

export type ConfettiIntensity = "small" | "medium" | "big";
export type ConfettiShape = "rect" | "circle" | "star";

export interface ConfettiPreset {
  /** Particle count (kept ≤ 90 for low-end Android phones). */
  count: number;
  /** Total animation length in ms. */
  durationMs: number;
  /** Launch speed range in px/s (scaled by viewport). */
  speed: [number, number];
  /** Extra side cannons from the bottom corners (big wins only). */
  sideCannons: boolean;
}

export const CONFETTI_PRESETS: Record<ConfettiIntensity, ConfettiPreset> = {
  small: { count: 36, durationMs: 1600, speed: [380, 720], sideCannons: false },
  medium: { count: 64, durationMs: 2000, speed: [460, 900], sideCannons: false },
  big: { count: 90, durationMs: 2400, speed: [520, 1020], sideCannons: true },
};

export const MAX_PARTICLES = 90;

/** Bright, kid-friendly colors that sit well on the light-green theme. */
export const CONFETTI_COLORS = [
  "#22c55e", // brand green
  "#4ade80",
  "#facc15", // sunny yellow
  "#f59e0b", // amber
  "#fb7185", // pink
  "#38bdf8", // sky
  "#a78bfa", // lilac
  "#f97316", // orange
] as const;

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  /** Phase for the side-to-side flutter. */
  wobble: number;
  color: string;
  shape: ConfettiShape;
}

export interface Viewport {
  width: number;
  height: number;
}

/** Gravity in px/s², per-second velocity retention (air drag) and paper-like max fall speed. */
export const GRAVITY = 1100;
export const MAX_FALL_SPEED = 360;
export const DRAG_PER_SECOND = 0.35;

type Rng = () => number;

function between(rng: Rng, [min, max]: [number, number]) {
  return min + (max - min) * rng();
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function launch(
  rng: Rng,
  originX: number,
  originY: number,
  angleCenter: number,
  angleSpread: number,
  speed: [number, number],
  scale: number,
): Particle {
  const angle = angleCenter + (rng() - 0.5) * angleSpread;
  const v = between(rng, speed) * scale;
  const shapeRoll = rng();
  const shape: ConfettiShape = shapeRoll < 0.5 ? "rect" : shapeRoll < 0.8 ? "circle" : "star";
  return {
    x: originX,
    y: originY,
    vx: Math.cos(angle) * v,
    vy: Math.sin(angle) * v,
    size: shape === "star" ? between(rng, [9, 13]) : between(rng, [6, 10]),
    rotation: rng() * Math.PI * 2,
    spin: (rng() - 0.5) * 12,
    wobble: rng() * Math.PI * 2,
    color: pick(rng, CONFETTI_COLORS),
    shape,
  };
}

/**
 * Builds the initial burst: a fountain from (originX, originY) (fractions of
 * the viewport) and, for big wins, two cannons from the bottom corners.
 */
export function createParticles(
  intensity: ConfettiIntensity,
  viewport: Viewport,
  rng: Rng = Math.random,
  origin: { x: number; y: number } = { x: 0.5, y: 0.4 },
): Particle[] {
  const preset = CONFETTI_PRESETS[intensity];
  const count = Math.min(preset.count, MAX_PARTICLES);
  // Phones are ~390×844; scale speed so the burst fills smaller/larger screens alike.
  const scale = Math.max(0.6, Math.min(1.4, viewport.height / 844));
  const ox = origin.x * viewport.width;
  const oy = origin.y * viewport.height;
  const up = -Math.PI / 2;
  const particles: Particle[] = [];

  const sideEach = preset.sideCannons ? Math.floor(count * 0.2) : 0;
  const center = count - sideEach * 2;
  for (let i = 0; i < center; i++) {
    particles.push(launch(rng, ox, oy, up, Math.PI * 0.9, preset.speed, scale));
  }
  for (let i = 0; i < sideEach; i++) {
    particles.push(launch(rng, 0, viewport.height, up + 0.45, 0.5, preset.speed, scale * 1.25));
    particles.push(launch(rng, viewport.width, viewport.height, up - 0.45, 0.5, preset.speed, scale * 1.25));
  }
  return particles;
}

/** Advances every particle by `dt` seconds (mutates for speed: no per-frame allocation). */
export function stepParticles(particles: Particle[], dt: number): void {
  const drag = Math.pow(DRAG_PER_SECOND, dt);
  for (const p of particles) {
    p.vx *= drag;
    p.vy = Math.min(p.vy * drag + GRAVITY * dt, MAX_FALL_SPEED);
    p.wobble += dt * 8;
    p.x += (p.vx + Math.sin(p.wobble) * 40) * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
  }
}

/** Opacity over time: fully visible, then fades out over the last 30%. */
export function particleAlpha(elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0) return 1;
  if (elapsedMs >= durationMs) return 0;
  const fadeStart = durationMs * 0.7;
  if (elapsedMs <= fadeStart) return 1;
  return 1 - (elapsedMs - fadeStart) / (durationMs - fadeStart);
}

/** True once the burst is over (time is up, or every particle fell off-screen). */
export function isFinished(particles: Particle[], elapsedMs: number, durationMs: number, viewport: Viewport): boolean {
  if (elapsedMs >= durationMs) return true;
  return particles.every((p) => p.y - p.size > viewport.height && p.vy > 0);
}

/** A `fire` key triggers a burst unless it is explicitly "off" (false / null / undefined / 0). */
export function shouldFire(fire: unknown): boolean {
  return !(fire === false || fire === null || fire === undefined || fire === 0);
}

type MatchMediaHost = { matchMedia?: (query: string) => { matches: boolean } } | undefined;

/** Reduced motion (or no window/matchMedia, e.g. SSR) means: no animation. */
export function prefersReducedMotion(win: MatchMediaHost = typeof window === "undefined" ? undefined : window): boolean {
  if (!win || typeof win.matchMedia !== "function") return true;
  try {
    return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

/** Short, soft "yay" buzz where supported (Android); a no-op on iOS/desktop. */
export const HAPTIC_PATTERN: Record<ConfettiIntensity, number | number[]> = {
  small: 18,
  medium: [20, 60, 20],
  big: [25, 70, 25, 70, 40],
};
