/** Celebrate a results reveal. canvas-confetti is loaded on first use only. */
export function fireConfetti() {
  if (typeof window === "undefined") return;
  void import("canvas-confetti")
    .then(({ default: confetti }) =>
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#14b8a6"],
        disableForReducedMotion: true,
      }),
    )
    .catch(() => undefined);
}
