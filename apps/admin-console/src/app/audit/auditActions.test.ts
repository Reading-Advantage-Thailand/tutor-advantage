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

/**
 * The timeline on a user's page (users/[id]/audit) lists every audit event
 * whose entity is that user. It used to print "admin tutor provision" for a
 * tutor account an admin created, because it only knew its own short list.
 */
describe("user audit actions", () => {
  const actions: Record<string, string> = audit.actions;
  const source = readFileSync(join(__dirname, "auditLabels.ts"), "utf8");
  const classCategory = source.slice(source.indexOf('id: "class"'), source.indexOf('id: "system"'));
  const timeline = readFileSync(join(__dirname, "..", "users", "[id]", "audit", "page.tsx"), "utf8");

  it("labels the pending tutor account in Thai and files it under classes", () => {
    expect(actions.ADMIN_TUTOR_PROVISION).toBe("สร้างบัญชีครูรอลงทะเบียน");
    expect(classCategory).toContain('"ADMIN_TUTOR_PROVISION"');
  });

  it("labels every action the services write on a user", () => {
    for (const action of [
      "ADMIN_TUTOR_PROVISION",
      "USER_VERIFY",
      "USER_SUSPEND",
      "USER_UNSUSPEND",
      "USER_ANONYMIZE",
      "USER_OMISE_RECIPIENT_UPDATE",
      "USER_PII_REVEAL",
      "USER_TAX_RESIDENCY_UPDATE",
      "CARD_PAYMENTS_TRUST",
      "ROLE_CHANGE",
    ]) {
      expect(actions[action], action).toMatch(/[฀-๿]/);
    }
  });

  it("the user timeline falls back to these labels, never to the raw action name", () => {
    expect(timeline).toContain("?? auditActionLabel(action)");
    expect(timeline).not.toContain('.replace(/_/g, " ")');
  });
});
