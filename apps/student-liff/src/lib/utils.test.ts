import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("student-liff cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", null, ["px-4", "text-sm"])).toBe("px-4 text-sm");
  });

  it("keeps a custom wrap utility next to a text colour", () => {
    expect(cn("text-balance-th", "text-fg")).toBe("text-balance-th text-fg");
    expect(cn("text-fg", "text-balance-th")).toBe("text-fg text-balance-th");
  });

  it("keeps the background-image utilities next to a background colour", () => {
    expect(cn("bg-hero", "bg-surface")).toBe("bg-hero bg-surface");
    expect(cn("bg-gradient-brand", "bg-brand-solid")).toBe("bg-gradient-brand bg-brand-solid");
    // Token colours that start with the same words are still colours.
    expect(cn("bg-hero-bg-base", "bg-hero-chip")).toBe("bg-hero-chip");
  });

  it("still merges two real colours (last wins)", () => {
    expect(cn("text-fg", "text-brand-fg")).toBe("text-brand-fg");
    expect(cn("bg-surface", "bg-brand-soft")).toBe("bg-brand-soft");
  });
});
