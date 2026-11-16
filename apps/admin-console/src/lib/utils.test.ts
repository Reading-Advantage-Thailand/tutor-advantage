import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("admin-console cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", undefined, ["px-4", "text-sm"])).toBe("px-4 text-sm");
  });

  it("keeps text-balance-th next to a text colour (they set different properties)", () => {
    expect(cn("text-fg text-balance-th")).toBe("text-fg text-balance-th");
    expect(cn("text-balance-th", "text-fg")).toBe("text-balance-th text-fg");
    // …and next to a font size
    expect(cn("text-xl text-balance-th text-fg")).toBe("text-xl text-balance-th text-fg");
  });

  it("still merges two real text colours", () => {
    expect(cn("text-fg", "text-danger-fg")).toBe("text-danger-fg");
    expect(cn("text-fg-muted text-brand-fg")).toBe("text-brand-fg");
  });

  it("files the app's custom utilities in the right groups", () => {
    // text-balance-th wraps like text-balance / text-pretty
    expect(cn("text-balance-th", "text-pretty")).toBe("text-pretty");
    // tabular is font-variant-numeric spacing
    expect(cn("tabular", "proportional-nums")).toBe("proportional-nums");
    // bg-hero is a background image, not a colour
    expect(cn("bg-hero", "bg-surface")).toBe("bg-hero bg-surface");
    // shadow-card is a shadow, not a shadow colour
    expect(cn("shadow-card", "shadow-none")).toBe("shadow-none");
    expect(cn("shadow-card", "shadow-popover")).toBe("shadow-popover");
    // focus-ring-inset and pressable stay
    expect(cn("focus-ring-inset pressable", "outline-none")).toBe("focus-ring-inset pressable outline-none");
  });
});
