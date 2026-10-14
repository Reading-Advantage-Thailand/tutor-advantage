import { describe, expect, it } from "vitest";
import { GUARDIAN_RELATIONS, getGuardianErrorKey, hasErrors, validateGuardianForm } from "./form";

describe("validateGuardianForm", () => {
  it("accepts a complete form", () => {
    const errors = validateGuardianForm({ guardianName: "สมศรี รักเรียน", relation: "Mother", agreed: true });
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  it("flags each missing step", () => {
    expect(validateGuardianForm({ guardianName: "   ", relation: "", agreed: false })).toEqual({
      guardianName: "guardian.nameRequired",
      relation: "guardian.relationRequired",
      agreed: "guardian.agreementHint",
    });
  });
});

describe("GUARDIAN_RELATIONS", () => {
  it("keeps the values the API expects as guardianContact", () => {
    expect(GUARDIAN_RELATIONS.map((relation) => relation.value)).toEqual(["Father", "Mother", "Relative", "Other"]);
  });
});

describe("getGuardianErrorKey", () => {
  it("maps API errors to Thai copy keys", () => {
    expect(getGuardianErrorKey({ status: 401 })).toBe("guardian.sessionExpired");
    expect(getGuardianErrorKey({ status: 400, code: "DATE_OF_BIRTH_REQUIRED" })).toBe("guardian.dobRequired");
    expect(getGuardianErrorKey({ status: 400, code: "GUARDIAN_CONSENT_NOT_REQUIRED" })).toBe("guardian.notRequired");
    expect(getGuardianErrorKey({ status: 400, code: "BAD_REQUEST" })).toBe("guardian.invalidData");
    expect(getGuardianErrorKey({ status: 500 })).toBe("guardian.saveFailed");
  });

  it("never exposes raw errors (network failures, unknown values)", () => {
    expect(getGuardianErrorKey(new TypeError("Failed to fetch"))).toBe("guardian.saveFailed");
    expect(getGuardianErrorKey(null)).toBe("guardian.saveFailed");
    expect(getGuardianErrorKey("boom")).toBe("guardian.saveFailed");
  });
});
