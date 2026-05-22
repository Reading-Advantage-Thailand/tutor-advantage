import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("tutor-pwa i18n", () => {
  it("returns typed Thai UI messages by key", () => {
    expect(t("tutorClass.days.monFull")).toBe("จันทร์");
    expect(t("tutorClass.errors.claimClass")).toBe("Failed to claim class");
  });
});
