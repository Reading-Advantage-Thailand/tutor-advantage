import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("student-liff i18n", () => {
  it("returns typed payment UI messages by key", () => {
    expect(t("payment.defaultTutor")).toBe("Tutor Advantage");
    expect(t("payment.defaultClassName")).toBe("Reading Advantage Class");
  });
});
