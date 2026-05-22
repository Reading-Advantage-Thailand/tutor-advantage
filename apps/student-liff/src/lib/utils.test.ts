import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("student-liff cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", null, ["px-4", "text-sm"])).toBe("px-4 text-sm");
  });
});
