import { describe, expect, it } from "vitest";
import { icaoNationalityToAlpha2, mrzCheckDigit, normalizeMrzLine, parsePassportMrz } from "./passportMrz";

// ICAO 9303 part 4 specimen passport (fictional state "UTO").
const SPECIMEN_LINE1 = "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<";
const SPECIMEN_LINE2 = "L898902C36UTO7408122F1204159ZE184226B<<<<<10";
const NOW = new Date("2026-10-19T00:00:00.000Z");

describe("mrzCheckDigit", () => {
  it("matches the ICAO specimen check digits", () => {
    expect(mrzCheckDigit("L898902C3")).toBe(6);
    expect(mrzCheckDigit("740812")).toBe(2);
    expect(mrzCheckDigit("120415")).toBe(9);
    expect(mrzCheckDigit("ZE184226B<<<<<")).toBe(1);
  });
});

describe("parsePassportMrz", () => {
  it("parses the ICAO specimen and validates every check digit", () => {
    expect(parsePassportMrz(SPECIMEN_LINE1, SPECIMEN_LINE2, NOW)).toEqual({
      issuingState: "UTO",
      surname: "ERIKSSON",
      givenNames: "ANNA MARIA",
      documentNumber: "L898902C3",
      nationality: "UTO",
      birthDate: "1974-08-12",
      sex: "F",
      expiryDate: "2012-04-15",
      valid: { documentNumber: true, birthDate: true, expiryDate: true, composite: true },
    });
  });

  it("tolerates spaces, lower case, look-alike chevrons and missing line-1 fillers", () => {
    const parsed = parsePassportMrz("p<uto eriksson««anna‹maria", ` ${SPECIMEN_LINE2.slice(0, 22)} ${SPECIMEN_LINE2.slice(22)} `, NOW);
    expect(parsed?.surname).toBe("ERIKSSON");
    expect(parsed?.givenNames).toBe("ANNA MARIA");
    expect(parsed?.valid.composite).toBe(true);
    expect(normalizeMrzLine("P«UTO")).toBe("P<UTO");
  });

  it("flags a misread character through its check digit", () => {
    const misread = SPECIMEN_LINE2.replace("L898902C3", "L898902G3");
    const parsed = parsePassportMrz(SPECIMEN_LINE1, misread, NOW);
    expect(parsed?.valid.documentNumber).toBe(false);
    expect(parsed?.valid.composite).toBe(false);
    expect(parsed?.valid.expiryDate).toBe(true);
  });

  it("still checks the leading fields when trailing fillers were dropped", () => {
    const parsed = parsePassportMrz(SPECIMEN_LINE1, SPECIMEN_LINE2.slice(0, 40), NOW);
    expect(parsed?.valid).toEqual({ documentNumber: true, birthDate: true, expiryDate: true, composite: false });
  });

  it("puts birth years after this year in the 1900s and expiry years in the 2000s", () => {
    const line2 = "AB1234567" + "0" + "GBR" + "3001010" + "M" + "3012319" + "<".repeat(14) + "00";
    const parsed = parsePassportMrz("P<GBRSMITH<<JOHN", line2, NOW);
    expect(parsed?.birthDate).toBe("1930-01-01");
    expect(parsed?.expiryDate).toBe("2030-12-31");
  });

  it("returns null for something that is not a passport MRZ", () => {
    expect(parsePassportMrz("I<UTOD231458907<<<<<<<<<<<<<<<", SPECIMEN_LINE2, NOW)).toBeNull();
    expect(parsePassportMrz(SPECIMEN_LINE1, "L898902C36UTO", NOW)).toBeNull();
    expect(parsePassportMrz("", "", NOW)).toBeNull();
    expect(parsePassportMrz(undefined, null, NOW)).toBeNull();
  });

  it("rejects impossible dates", () => {
    const line2 = SPECIMEN_LINE2.replace("1204159", "1213319");
    expect(parsePassportMrz(SPECIMEN_LINE1, line2, NOW)?.expiryDate).toBeNull();
  });
});

describe("icaoNationalityToAlpha2", () => {
  it("maps ISO alpha-3 and ICAO-only codes to alpha-2", () => {
    expect(icaoNationalityToAlpha2("GBR")).toBe("GB");
    expect(icaoNationalityToAlpha2("usa")).toBe("US");
    expect(icaoNationalityToAlpha2("D<<")).toBe("DE");
    expect(icaoNationalityToAlpha2("GBN")).toBe("GB");
    expect(icaoNationalityToAlpha2("THA")).toBe("TH");
  });

  it("returns null for unknown or stateless codes", () => {
    expect(icaoNationalityToAlpha2("UTO")).toBeNull();
    expect(icaoNationalityToAlpha2("XXA")).toBeNull();
    expect(icaoNationalityToAlpha2(undefined)).toBeNull();
  });
});
