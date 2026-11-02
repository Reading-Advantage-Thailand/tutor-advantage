import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { audit } from "../../locales/th/audit";

/**
 * auditLabels.ts imports through "@/…" (the vitest alias points at another
 * app), so its class category is checked in the source text.
 */
describe("discount code audit actions", () => {
  const actions: Record<string, string> = audit.actions;
  const source = readFileSync(join(__dirname, "auditLabels.ts"), "utf8");
  const classCategory = source.slice(source.indexOf('id: "class"'), source.indexOf('id: "system"'));

  it("labels every discount code action in Thai and files it under classes", () => {
    for (const action of ["DISCOUNT_CODE_CREATE", "DISCOUNT_CODE_UPDATE", "DISCOUNT_CODE_VOID", "DISCOUNT_CODE_REDEEM"]) {
      expect(actions[action], action).toMatch(/[฀-๿]/);
      expect(classCategory, action).toContain(`"${action}"`);
    }
  });

  it("names the offline amount change", () => {
    expect(actions.DISCOUNT_CODE_UPDATE).toBe("แก้ยอดที่รับของโค้ดส่วนลด");
  });
});
