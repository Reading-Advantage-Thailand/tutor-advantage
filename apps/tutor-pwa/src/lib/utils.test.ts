import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("tutor-pwa cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", false && "hidden", ["px-4", "text-sm"])).toBe("px-4 text-sm");
  });

  it("keeps text-balance-th next to a text colour", () => {
    expect(cn("type-section text-balance-th", "text-fg")).toBe("type-section text-balance-th text-fg");
    expect(cn("text-fg", "text-balance-th")).toBe("text-fg text-balance-th");
    // It is a wrap utility: another wrap value replaces it.
    expect(cn("text-balance-th", "text-pretty")).toBe("text-pretty");
  });

  it("still merges two real colours (last wins)", () => {
    expect(cn("text-fg", "text-brand-fg")).toBe("text-brand-fg");
    expect(cn("bg-surface", "bg-brand-soft")).toBe("bg-brand-soft");
  });

  it("files bg-hero and bg-gradient-brand as background images, not colours", () => {
    expect(cn("bg-hero", "bg-surface")).toBe("bg-hero bg-surface");
    expect(cn("bg-hero", "bg-none")).toBe("bg-none");
    expect(cn("bg-hero", "bg-gradient-brand")).toBe("bg-gradient-brand");
  });

  it("files the theme shadows as box shadows, not shadow colours", () => {
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-card", "shadow-tap")).toBe("shadow-tap");
  });

  it("merges two type roles but leaves them alone next to sizes and tabular figures", () => {
    expect(cn("type-body", "type-caption")).toBe("type-caption");
    expect(cn("type-body-s", "type-body")).toBe("type-body");
    expect(cn("type-label", "text-sm")).toBe("type-label text-sm");
    expect(cn("tabular", "proportional-nums")).toBe("proportional-nums");
  });
});
