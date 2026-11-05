import { describe, expect, it } from "vitest";
import { documentExpiryChip, expiryWarningLines } from "./documentExpiry";

const messages = {
  passport: "หนังสือเดินทาง",
  workPermit: "ใบอนุญาตทำงาน",
  inDays: "{document} อีก {days} วัน ({date})",
  today: "{document} วันนี้",
  expired: "{document} หมดแล้ว",
};

describe("documentExpiryChip", () => {
  it("returns nothing without an expiry", () => {
    expect(documentExpiryChip(null, messages)).toBeNull();
    expect(documentExpiryChip(undefined, messages)).toBeNull();
  });

  it("shows days left, warning beyond a week and danger within one", () => {
    expect(documentExpiryChip({ document: "WORK_PERMIT", expiresOn: "2026-12-06", daysLeft: 30 }, messages)).toEqual({
      tone: "warning",
      text: "ใบอนุญาตทำงาน อีก 30 วัน (2026-12-06)",
    });
    expect(documentExpiryChip({ document: "PASSPORT", expiresOn: "2026-11-12", daysLeft: 7 }, messages)?.tone).toBe("danger");
  });

  it("says today and expired explicitly", () => {
    expect(documentExpiryChip({ document: "PASSPORT", expiresOn: "2026-11-05", daysLeft: 0 }, messages)).toEqual({
      tone: "danger",
      text: "หนังสือเดินทาง วันนี้",
    });
    expect(documentExpiryChip({ document: "PASSPORT", expiresOn: "2026-11-01", daysLeft: -4 }, messages)).toEqual({
      tone: "danger",
      text: "หนังสือเดินทาง หมดแล้ว",
    });
  });
});

describe("expiryWarningLines", () => {
  it("lists still-valid warnings soonest first", () => {
    const lines = expiryWarningLines(
      [
        { document: "PASSPORT", expiresOn: "2026-12-01", daysLeft: 26 },
        { document: "WORK_PERMIT", expiresOn: "2026-11-10", daysLeft: 5 },
        { document: "PASSPORT", expiresOn: "2026-11-01", daysLeft: -4 },
      ],
      messages,
    );
    expect(lines).toEqual(["ใบอนุญาตทำงาน อีก 5 วัน (2026-11-10)", "หนังสือเดินทาง อีก 26 วัน (2026-12-01)"]);
    expect(expiryWarningLines(undefined, messages)).toEqual([]);
  });
});
