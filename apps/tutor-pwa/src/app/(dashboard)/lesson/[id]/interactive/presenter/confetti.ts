/**
 * Celebrate a results reveal. canvas-confetti is loaded on first use only.
 * The pieces use the four answer colours (components.md §6.5), read from the
 * --answer-* tokens at run time so the source carries no hex values;
 * canvas-confetti respects prefers-reduced-motion (nothing is drawn).
 */
const ANSWER_TOKENS = ["--answer-a", "--answer-b", "--answer-c", "--answer-d"] as const;

function answerColours(): string[] | undefined {
  const style = getComputedStyle(document.documentElement);
  const colours = ANSWER_TOKENS.map((token) => style.getPropertyValue(token).trim()).filter((value) => /^#[0-9a-f]{3,8}$/i.test(value));
  return colours.length > 0 ? colours : undefined;
}

export function fireConfetti() {
  if (typeof window === "undefined") return;
  void import("canvas-confetti")
    .then(({ default: confetti }) =>
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: answerColours(),
        disableForReducedMotion: true,
      }),
    )
    .catch(() => undefined);
}
