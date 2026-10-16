import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateWithholdingAtRate,
  computeTutorVerificationStatus,
  isExpired,
  isValidNationality,
  isValidPassportNumber,
  isValidThaiId,
  maskDocumentNumber,
  normalizePassportNumber,
  parseIsoDate,
  payoutDocumentBlock,
  requiredVerificationFields,
  whtRatePercentFor,
} from "./tutorIdentity";
import { decryptPii, encryptPii, isPiiEncryptionConfigured } from "./piiCrypto";
import { redactLogValue, redactSensitiveText } from "./middlewares/logger";

describe("Thai ID", () => {
  it("accepts a 13-digit ID with a valid check digit, with or without dashes", () => {
    expect(isValidThaiId("1101700230708")).toBe(true);
    expect(isValidThaiId("1-1017-00230-70-8")).toBe(true);
  });

  it("rejects a wrong check digit or wrong length", () => {
    expect(isValidThaiId("1101700230705")).toBe(false);
    expect(isValidThaiId("110170023070")).toBe(false);
    expect(isValidThaiId("0000000000000")).toBe(false);
    expect(isValidThaiId(undefined)).toBe(false);
  });
});

describe("passport", () => {
  it("allows 6–20 letters or digits after normalising case, spaces and dashes", () => {
    expect(normalizePassportNumber(" aa 123-456 ")).toBe("AA123456");
    expect(isValidPassportNumber("aa123456")).toBe(true);
    expect(isValidPassportNumber("A12345")).toBe(true);
    expect(isValidPassportNumber("A1234")).toBe(false);
    expect(isValidPassportNumber("A".repeat(21))).toBe(false);
    expect(isValidPassportNumber("AB12/456")).toBe(false);
  });

  it("validates nationality as a 2- or 3-letter code", () => {
    expect(isValidNationality("gb")).toBe(true);
    expect(isValidNationality("GBR")).toBe(true);
    expect(isValidNationality("United Kingdom")).toBe(false);
  });

  it("masks all but the last 4 characters", () => {
    expect(maskDocumentNumber("AA1234567")).toBe("•••••4567");
    expect(maskDocumentNumber(null)).toBeNull();
  });
});

describe("expiry", () => {
  it("parses only real YYYY-MM-DD dates", () => {
    expect(parseIsoDate("2027-02-28")?.toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(parseIsoDate("2027-02-30")).toBeNull();
    expect(parseIsoDate("28/02/2027")).toBeNull();
  });

  it("treats a document as valid through its expiry day (Bangkok time)", () => {
    const expiry = new Date("2026-10-16T00:00:00.000Z");
    // 23:00 Bangkok on the expiry day
    expect(isExpired(expiry, new Date("2026-10-16T16:00:00.000Z"))).toBe(false);
    // 00:30 Bangkok the next day
    expect(isExpired(expiry, new Date("2026-10-16T17:30:00.000Z"))).toBe(true);
    expect(isExpired(null)).toBe(false);
  });
});

describe("verification requirements", () => {
  const verified = { status: "VERIFIED" };
  const base = { idCard: verified, bankBook: verified, address: verified, taxInfo: verified };

  it("needs a work permit only for passport holders teaching from Thailand", () => {
    expect(requiredVerificationFields({ idType: "THAI_ID" })).not.toContain("workPermit");
    expect(requiredVerificationFields({ idType: "PASSPORT", teachingLocation: "ABROAD" })).not.toContain("workPermit");
    expect(requiredVerificationFields({ idType: "PASSPORT", teachingLocation: "THAILAND" })).toContain("workPermit");
  });

  it("keeps Thai ID tutors VERIFIED with the original four fields", () => {
    expect(computeTutorVerificationStatus(base, {})).toBe("VERIFIED");
  });

  it("is not VERIFIED until the work permit is approved", () => {
    const user = { idType: "PASSPORT", teachingLocation: "THAILAND" };
    expect(computeTutorVerificationStatus(base, user)).toBe("UNVERIFIED");
    expect(computeTutorVerificationStatus({ ...base, workPermit: { status: "PENDING" } }, user)).toBe("PENDING");
    expect(computeTutorVerificationStatus({ ...base, workPermit: verified }, user)).toBe("VERIFIED");
  });
});

describe("payoutDocumentBlock", () => {
  const asOf = new Date("2026-10-16T05:00:00.000Z");
  const future = new Date("2027-01-01");
  const past = new Date("2026-01-01");

  it("never blocks Thai ID tutors", () => {
    expect(payoutDocumentBlock({ idType: "THAI_ID" }, asOf)).toBeNull();
    expect(payoutDocumentBlock({}, asOf)).toBeNull();
  });

  it("blocks on an expired passport or work permit", () => {
    expect(payoutDocumentBlock({ idType: "PASSPORT", teachingLocation: "ABROAD", passportExpiresOn: past }, asOf)).toBe("PASSPORT_EXPIRED");
    expect(
      payoutDocumentBlock({ idType: "PASSPORT", teachingLocation: "THAILAND", passportExpiresOn: future, workPermitExpiresOn: past }, asOf),
    ).toBe("WORK_PERMIT_EXPIRED");
    expect(
      payoutDocumentBlock({ idType: "PASSPORT", teachingLocation: "THAILAND", passportExpiresOn: future }, asOf),
    ).toBe("WORK_PERMIT_MISSING");
    expect(
      payoutDocumentBlock({ idType: "PASSPORT", teachingLocation: "THAILAND", passportExpiresOn: future, workPermitExpiresOn: future }, asOf),
    ).toBeNull();
  });
});

describe("withholding", () => {
  it("uses 3% for residents and 15% for non-residents", () => {
    expect(whtRatePercentFor("RESIDENT")).toBe(3);
    expect(whtRatePercentFor("NON_RESIDENT")).toBe(15);
    expect(whtRatePercentFor(undefined)).toBe(3);
    expect(calculateWithholdingAtRate(10_000n, 15)).toEqual({
      grossPayoutMinor: 10_000n,
      withholdingTaxMinor: 1_500n,
      netPayoutMinor: 8_500n,
    });
  });
});

describe("piiCrypto", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips with a random IV and refuses without a key", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const a = encryptPii("AA1234567");
    const b = encryptPii("AA1234567");
    expect(a).not.toBe(b);
    expect(a).not.toContain("AA1234567");
    expect(decryptPii(a)).toBe("AA1234567");

    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    expect(isPiiEncryptionConfigured()).toBe(false);
    expect(() => encryptPii("x")).toThrow();
  });

  it("detects tampering", () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
    const [v, iv, tag, data] = encryptPii("AA1234567").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decryptPii([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });
});

describe("log redaction", () => {
  it("hides passport numbers in structured fields and free text", () => {
    expect(redactLogValue({ passportNumber: "AA1234567" })).toEqual({ passportNumber: "[REDACTED]" });
    expect(redactLogValue({ nationalId: "1101700230708" })).toEqual({ nationalId: "[REDACTED]" });
    expect(redactSensitiveText("bad passport AA1234567 given")).toBe("bad passport [REDACTED_DOCUMENT_NUMBER] given");
  });
});
