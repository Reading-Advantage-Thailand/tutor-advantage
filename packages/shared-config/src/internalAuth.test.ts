import { describe, expect, it } from "vitest";
import { isValidInternalKey } from "./internalAuth";

describe("isValidInternalKey", () => {
  it("accepts only the exact configured key", () => {
    expect(isValidInternalKey("long-random-secret", "long-random-secret")).toBe(true);
    expect(isValidInternalKey("long-random-secreT", "long-random-secret")).toBe(false);
    expect(isValidInternalKey("long-random-secret-and-more", "long-random-secret")).toBe(false);
    expect(isValidInternalKey("short", "long-random-secret")).toBe(false);
  });

  it("fails closed when the key is missing on either side", () => {
    expect(isValidInternalKey("anything", undefined)).toBe(false);
    expect(isValidInternalKey("anything", "")).toBe(false);
    expect(isValidInternalKey(undefined, "secret")).toBe(false);
    expect(isValidInternalKey(null, "secret")).toBe(false);
    expect(isValidInternalKey("", "secret")).toBe(false);
    expect(isValidInternalKey(["secret", "secret"], "secret")).toBe(false);
  });

  it("reads INTERNAL_API_KEY by default", () => {
    const previous = process.env.INTERNAL_API_KEY;
    process.env.INTERNAL_API_KEY = "from-env";
    try {
      expect(isValidInternalKey("from-env")).toBe(true);
      delete process.env.INTERNAL_API_KEY;
      expect(isValidInternalKey("from-env")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.INTERNAL_API_KEY;
      else process.env.INTERNAL_API_KEY = previous;
    }
  });
});
