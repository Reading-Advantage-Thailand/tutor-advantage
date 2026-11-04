import { describe, expect, it } from "vitest";
import { documentExpiryWarningTexts, payoutBlockText } from "./documentExpiry";

describe("documentExpiryWarningTexts", () => {
  it("returns nothing without warnings", () => {
    expect(documentExpiryWarningTexts(null)).toEqual([]);
    expect(documentExpiryWarningTexts({ idType: "THAI_ID" })).toEqual([]);
    expect(documentExpiryWarningTexts({ idType: "PASSPORT", expiryWarnings: [] })).toEqual([]);
  });

  it("formats the days left and the expiry date in Thai and English", () => {
    const [passport, workPermit] = documentExpiryWarningTexts({
      idType: "PASSPORT",
      payoutBlock: null,
      expiryWarnings: [
        { document: "PASSPORT", expiresOn: "2026-11-20", daysLeft: 16 },
        { document: "WORK_PERMIT", expiresOn: "2026-11-05", daysLeft: 1 },
      ],
    });
    expect(passport).toBe(
      "หนังสือเดินทางจะหมดอายุในอีก 16 วัน (วันที่ 20 พ.ย. 2569) กรุณาส่งฉบับใหม่ก่อนหมดอายุเพื่อไม่ให้การจ่ายเงินถูกระงับ · Your passport expires in 16 days (2026-11-20). Submit a new one before then so payouts are not paused",
    );
    expect(workPermit).toContain("ใบอนุญาตทำงานจะหมดอายุในอีก 1 วัน");
    expect(workPermit).toContain("Your work permit expires in 1 day (2026-11-05)");
  });

  it("uses the 'today' copy on the last valid day", () => {
    const [text] = documentExpiryWarningTexts({
      expiryWarnings: [{ document: "PASSPORT", expiresOn: "2026-11-04", daysLeft: 0 }],
    });
    expect(text).toContain("หนังสือเดินทางจะหมดอายุวันนี้");
    expect(text).toContain("Your passport expires today (2026-11-04)");
  });

  it("still warns about the passport while a work-permit block is active", () => {
    for (const payoutBlock of ["WORK_PERMIT_EXPIRED", "WORK_PERMIT_MISSING"] as const) {
      const texts = documentExpiryWarningTexts({
        payoutBlock,
        expiryWarnings: [
          { document: "PASSPORT", expiresOn: "2026-11-09", daysLeft: 5 },
          { document: "WORK_PERMIT", expiresOn: "2026-11-05", daysLeft: 1 },
        ],
      });
      expect(texts).toHaveLength(1);
      expect(texts[0]).toContain("Your passport expires in 5 days (2026-11-09)");
    }
  });

  it("stays silent once the passport itself blocks payouts", () => {
    expect(
      documentExpiryWarningTexts({
        payoutBlock: "PASSPORT_EXPIRED",
        expiryWarnings: [{ document: "WORK_PERMIT", expiresOn: "2026-11-20", daysLeft: 16 }],
      }),
    ).toEqual([]);
  });
});

describe("payoutBlockText", () => {
  it("maps each block to its danger copy", () => {
    expect(payoutBlockText(null)).toBeNull();
    expect(payoutBlockText(undefined)).toBeNull();
    expect(payoutBlockText("PASSPORT_EXPIRED")).toContain("Passport expired: payouts are paused");
    expect(payoutBlockText("WORK_PERMIT_EXPIRED")).toContain("Work permit expired: payouts are paused");
    expect(payoutBlockText("WORK_PERMIT_MISSING")).toContain("Work permit missing: payouts are paused");
  });
});
