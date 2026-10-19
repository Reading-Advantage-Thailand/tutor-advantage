import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("ai", () => ai);
vi.mock("@ai-sdk/google", () => ({ google: (model: string) => ({ model }) }));

import { mrzCheckDigit } from "@tutor-advantage/shared-config";
import {
  combinePassportReading,
  PassportScanUnavailableError,
  scanPassportImage,
  type PassportReading,
} from "./passportScan";

const NOW = new Date("2026-10-19T00:00:00.000Z");

/** A TD3 line 2 with correct check digits. */
function line2(documentNumber: string, nationality: string, birth: string, sex: string, expiry: string): string {
  const doc = documentNumber.padEnd(9, "<");
  const optional = "<".repeat(14);
  const head = `${doc}${mrzCheckDigit(doc)}${nationality}${birth}${mrzCheckDigit(birth)}${sex}${expiry}${mrzCheckDigit(expiry)}${optional}${mrzCheckDigit(optional)}`;
  const composite = mrzCheckDigit(head.slice(0, 10) + head.slice(13, 20) + head.slice(21, 43));
  return `${head}${composite}`;
}

const GOOD: PassportReading = {
  isPassportDataPage: true,
  mrzLine1: "P<GBRSMITH<<JOHN<WILLIAM<<<<<<<<<<<<<<<<<<<<",
  mrzLine2: line2("533401372", "GBR", "900115", "M", "320930"),
  surname: "SMITH",
  givenNames: "JOHN WILLIAM",
  passportNumber: "533401372",
  nationalityCode: "GBR",
  expiryDate: "2032-09-30",
};

describe("combinePassportReading", () => {
  it("fills every field and confirms them when the MRZ checks out", () => {
    expect(GOOD.mrzLine2).toHaveLength(44);
    expect(combinePassportReading(GOOD, NOW)).toEqual({
      fields: {
        fullName: "JOHN WILLIAM SMITH",
        passportNumber: "533401372",
        nationality: "GB",
        expiresOn: "2032-09-30",
      },
      confirmed: ["passportNumber", "expiresOn", "nationality", "fullName"],
    });
  });

  it("prefers the MRZ value when the printed one was misread", () => {
    const result = combinePassportReading({ ...GOOD, passportNumber: "S33401372", expiryDate: "2032-08-30" }, NOW);
    expect(result?.fields.passportNumber).toBe("533401372");
    expect(result?.fields.expiresOn).toBe("2032-09-30");
  });

  it("falls back to the printed values, unconfirmed, when a check digit fails", () => {
    const broken = GOOD.mrzLine2.replace("533401372", "533401373");
    const result = combinePassportReading({ ...GOOD, mrzLine2: broken }, NOW);
    expect(result?.fields.passportNumber).toBe("533401372");
    expect(result?.confirmed).not.toContain("passportNumber");
    expect(result?.confirmed).toContain("expiresOn");
  });

  it("uses printed fields alone when no MRZ was read", () => {
    const result = combinePassportReading({ ...GOOD, mrzLine1: "", mrzLine2: "" }, NOW);
    expect(result).toEqual({
      fields: { fullName: "JOHN WILLIAM SMITH", passportNumber: "533401372", nationality: "GB", expiresOn: "2032-09-30" },
      confirmed: [],
    });
  });

  it("keeps the printed name with accents and confirms it against a transliterated, truncated MRZ", () => {
    const result = combinePassportReading(
      {
        ...GOOD,
        mrzLine1: "P<DEUMULLER<<ANNA<SOPHIE<KATHARINA<MARIA<ELI",
        mrzLine2: line2("C01X00T47", "D<<", "900115", "F", "320930"),
        surname: "Müller",
        givenNames: "Anna Sophie Katharina Maria Elisabeth",
        nationalityCode: "D",
        passportNumber: "C01X00T47",
      },
      NOW,
    );
    expect(result?.fields.fullName).toBe("ANNA SOPHIE KATHARINA MARIA ELISABETH MÜLLER");
    expect(result?.fields.nationality).toBe("DE");
    expect(result?.confirmed).toEqual(expect.arrayContaining(["fullName", "passportNumber", "nationality"]));
  });

  it("does not confirm a name that differs from the MRZ", () => {
    const result = combinePassportReading({ ...GOOD, givenNames: "JON WILLIAM" }, NOW);
    expect(result?.fields.fullName).toBe("JON WILLIAM SMITH");
    expect(result?.confirmed).not.toContain("fullName");
  });

  it("drops values that are not usable", () => {
    const result = combinePassportReading(
      { ...GOOD, mrzLine1: "", mrzLine2: "", passportNumber: "12/45", nationalityCode: "XXA", expiryDate: "30/09/2032" },
      NOW,
    );
    expect(result?.fields).toEqual({ fullName: "JOHN WILLIAM SMITH" });
  });

  it("returns null for an image that is not a passport page, or with nothing readable", () => {
    expect(combinePassportReading({ ...GOOD, isPassportDataPage: false }, NOW)).toBeNull();
    expect(
      combinePassportReading(
        { isPassportDataPage: true, mrzLine1: "", mrzLine2: "", surname: "", givenNames: "", passportNumber: "", nationalityCode: "", expiryDate: "" },
        NOW,
      ),
    ).toBeNull();
  });
});

describe("scanPassportImage", () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    delete process.env.PASSPORT_SCAN_ENABLED;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("sends the image as a file part and combines the reading", async () => {
    ai.generateObject.mockResolvedValue({ object: GOOD });
    const buffer = Buffer.from([0xff, 0xd8, 0xff]);
    const result = await scanPassportImage({ buffer, mimeType: "image/jpeg" }, NOW);

    expect(result?.fields.passportNumber).toBe("533401372");
    const call = ai.generateObject.mock.calls[0][0];
    expect(call.temperature).toBe(0);
    expect(call.messages[0].content[1]).toEqual({ type: "file", data: buffer, mediaType: "image/jpeg" });
  });

  it("refuses to run without an API key or when switched off", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    await expect(scanPassportImage({ buffer: Buffer.alloc(1), mimeType: "image/png" })).rejects.toBeInstanceOf(
      PassportScanUnavailableError,
    );
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    process.env.PASSPORT_SCAN_ENABLED = "false";
    await expect(scanPassportImage({ buffer: Buffer.alloc(1), mimeType: "image/png" })).rejects.toBeInstanceOf(
      PassportScanUnavailableError,
    );
    expect(ai.generateObject).not.toHaveBeenCalled();
  });
});
