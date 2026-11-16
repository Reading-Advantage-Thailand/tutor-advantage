/**
 * Motion helpers for scripted scrolling. The global prefers-reduced-motion CSS
 * override only covers CSS scroll-behavior; `scrollIntoView({ behavior: "smooth" })`
 * bypasses it, so scripted scrolls ask here instead.
 */
export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
