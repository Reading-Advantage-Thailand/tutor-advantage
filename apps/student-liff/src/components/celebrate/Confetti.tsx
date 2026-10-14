"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CONFETTI_PRESETS,
  HAPTIC_PATTERN,
  createParticles,
  isFinished,
  particleAlpha,
  prefersReducedMotion,
  shouldFire,
  stepParticles,
  type ConfettiIntensity,
  type Particle,
} from "./confettiModel";

export interface ConfettiProps {
  /**
   * Fires once on mount by default. Pass a changing key (e.g. a counter from
   * `useCelebrate()`) to fire again; `false` / `null` / `0` means "not yet".
   * Re-renders with the same key never re-fire.
   */
  fire?: unknown;
  intensity?: ConfettiIntensity;
  /** Burst origin as fractions of the viewport (default: centre, a little above the middle). */
  origin?: { x: number; y: number };
  /** Soft success buzz on supporting devices (Android). Default on. */
  haptic?: boolean;
}

// useLayoutEffect warns during SSR; this component only animates on the client.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Some webviews throw instead of ignoring; a missing buzz is fine.
  }
}

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  const inner = r * 0.45;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : inner;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
    else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], dpr: number, alpha: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalAlpha = alpha;
  for (const p of particles) {
    const cos = Math.cos(p.rotation) * dpr;
    const sin = Math.sin(p.rotation) * dpr;
    ctx.setTransform(cos, sin, -sin, cos, p.x * dpr, p.y * dpr);
    ctx.fillStyle = p.color;
    if (p.shape === "rect") {
      // Squash with the flutter so paper strips look like they flip.
      const h = p.size * 0.55 * Math.max(0.2, Math.abs(Math.cos(p.wobble)));
      ctx.fillRect(-p.size / 2, -h / 2, p.size, h);
    } else if (p.shape === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      drawStar(ctx, p.size / 2 + 1);
    }
  }
}

/**
 * A short, dependency-free confetti + star burst for real achievements.
 * Draws on one fixed, pointer-events-none canvas appended to <body> (so it
 * never blocks taps or gets clipped), runs on requestAnimationFrame, and
 * removes itself when done. Renders nothing with prefers-reduced-motion.
 */
export function Confetti({ fire = true, intensity = "medium", origin, haptic = true }: ConfettiProps) {
  // Latest options without making them effect deps (a rank/score update must not re-fire).
  const optionsRef = useRef({ intensity, origin, haptic });
  useIsoLayoutEffect(() => {
    optionsRef.current = { intensity, origin, haptic };
  });

  useEffect(() => {
    if (!shouldFire(fire)) return;
    const { intensity: level, origin: from, haptic: buzz } = optionsRef.current;
    if (prefersReducedMotion()) return;
    if (buzz) vibrate(HAPTIC_PATTERN[level]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewport.width * dpr);
    canvas.height = Math.round(viewport.height * dpr);
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.celebrate = level;
    canvas.style.cssText = `position:fixed;inset:0;width:${viewport.width}px;height:${viewport.height}px;pointer-events:none;z-index:70;`;
    document.body.appendChild(canvas);

    const particles = createParticles(level, viewport, Math.random, from);
    const { durationMs } = CONFETTI_PRESETS[level];
    let frame = 0;
    let start = 0;
    let last = 0;

    const tick = (now: number) => {
      if (!start) start = last = now;
      // Clamp dt so a backgrounded tab doesn't teleport particles.
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const elapsed = now - start;
      stepParticles(particles, dt);
      if (isFinished(particles, elapsed, durationMs, viewport)) {
        canvas.remove();
        return;
      }
      drawParticles(ctx, particles, dpr, particleAlpha(elapsed, durationMs));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      canvas.remove();
    };
  }, [fire]);

  return null;
}

/**
 * `const [celebration, celebrate] = useCelebrate();`
 * then `<Confetti fire={celebration} />` and call `celebrate()` after a success.
 */
export function useCelebrate() {
  const [key, setKey] = useState(0);
  const celebrate = useCallback(() => setKey((value) => value + 1), []);
  return [key, celebrate] as const;
}
