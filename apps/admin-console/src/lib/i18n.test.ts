import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("admin-console i18n", () => {
  it("returns typed API messages by key", () => {
    expect(t("api.genericError")).toBe("Something went wrong");
    expect(t("api.sessionExpiredEnglish")).toBe("Session expired. Please sign in again.");
  });
});
