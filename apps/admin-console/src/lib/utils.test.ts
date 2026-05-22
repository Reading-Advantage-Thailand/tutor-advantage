import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("admin-console cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", undefined, ["px-4", "text-sm"])).toBe("px-4 text-sm");
  });
});
