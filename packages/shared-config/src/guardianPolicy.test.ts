import { describe, expect, it } from "vitest";
import {
  isUnderGuardianAge,
  requiresGuardianConsent,
} from "./guardianPolicy";

const NOW = new Date("2026-07-01T12:00:00.000Z");

describe("guardian policy", () => {
  it("requires consent for a 17-year-old student", () => {
    expect(
      requiresGuardianConsent(
        "STUDENT",
        new Date("2008-07-02T00:00:00.000Z"),
        false,
        NOW,
      ),
    ).toBe(true);
  });

  it("does not require consent once the student turns 18", () => {
    expect(
      isUnderGuardianAge(new Date("2008-07-01T00:00:00.000Z"), NOW),
    ).toBe(false);
    expect(
      requiresGuardianConsent(
        "STUDENT",
        new Date("2008-07-01T00:00:00.000Z"),
        false,
        NOW,
      ),
    ).toBe(false);
  });

  it("fails closed for a student without a date of birth", () => {
    expect(requiresGuardianConsent("STUDENT", null, false, NOW)).toBe(true);
  });

  it("accepts an existing consent for a minor and ignores tutors", () => {
    expect(
      requiresGuardianConsent(
        "STUDENT",
        new Date("2012-01-01T00:00:00.000Z"),
        true,
        NOW,
      ),
    ).toBe(false);
    expect(requiresGuardianConsent("TUTOR", null, false, NOW)).toBe(false);
  });
});
