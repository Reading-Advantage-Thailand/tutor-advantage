import { describe, expect, it } from "vitest";
import { forwardedSearch } from "./forwardedSearch";

describe("proxy forwardedSearch", () => {
  it("turns form-encoded spaces into %20 for the services' validator", () => {
    expect(forwardedSearch("?role=TUTOR&q=Local+Tutor&pageSize=8")).toBe("?role=TUTOR&q=Local%20Tutor&pageSize=8");
  });

  it("keeps everything else as sent", () => {
    expect(forwardedSearch("")).toBe("");
    expect(forwardedSearch("?q=Local%20Tutor")).toBe("?q=Local%20Tutor");
    expect(forwardedSearch("?q=A%2BB&status=PENDING,APPROVED")).toBe("?q=A%2BB&status=PENDING,APPROVED");
  });
});
