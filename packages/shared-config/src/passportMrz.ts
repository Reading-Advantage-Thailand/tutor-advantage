/**
 * Passport machine readable zone (ICAO 9303 TD3: two lines of 44
 * characters). Pure functions only. Used to check what OCR read from a
 * passport photo: a field covered by a check digit is only trusted when the
 * digit matches.
 */

export const TD3_LINE_LENGTH = 44;

/** ICAO 9303 check digit: weights 7-3-1, digits as-is, A-Z = 10-35, filler "<" = 0. */
export function mrzCheckDigit(value: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    let charValue = 0;
    if (code >= 48 && code <= 57) charValue = code - 48;
    else if (code >= 65 && code <= 90) charValue = code - 55;
    sum += charValue * weights[i % 3];
  }
  return sum % 10;
}

function checkDigitMatches(value: string, digit: string | undefined): boolean {
  return digit !== undefined && /^\d$/.test(digit) && mrzCheckDigit(value) === Number(digit);
}

/** Upper-case, no whitespace, look-alike chevrons replaced by the "<" filler. */
export function normalizeMrzLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.toUpperCase().replace(/\s+/g, "").replace(/[«‹＜]/g, "<");
}

function fillerToSpace(value: string): string {
  return value.replace(/</g, " ").replace(/\s+/g, " ").trim();
}

/** YYMMDD as YYYY-MM-DD; null when it is not a real date. */
function mrzDate(value: string, century: (yy: number) => number): string | null {
  if (!/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const iso = `${century(yy)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export type PassportMrz = {
  issuingState: string;
  surname: string;
  givenNames: string;
  documentNumber: string;
  /** ICAO 3-letter nationality code ("D" for Germany). */
  nationality: string;
  birthDate: string | null;
  sex: string;
  expiryDate: string | null;
  valid: { documentNumber: boolean; birthDate: boolean; expiryDate: boolean; composite: boolean };
};

/**
 * Parses a TD3 passport MRZ. Line 1 may come back short of fillers and is
 * padded; line 2 needs at least the document number, birth and expiry
 * fields (28 characters), and its composite digit is checked only when it is
 * complete. Returns null when the lines are not a passport MRZ.
 */
export function parsePassportMrz(line1: unknown, line2: unknown, now: Date = new Date()): PassportMrz | null {
  const first = normalizeMrzLine(line1);
  const second = normalizeMrzLine(line2);
  if (!/^P[A-Z<]/.test(first) || first.length > TD3_LINE_LENGTH || second.length < 28 || second.length > TD3_LINE_LENGTH) {
    return null;
  }
  const top = first.padEnd(TD3_LINE_LENGTH, "<");

  const [surnamePart = "", ...givenParts] = top.slice(5).split("<<");
  const documentNumberField = second.slice(0, 9);
  const birthField = second.slice(13, 19);
  const expiryField = second.slice(21, 27);
  const thisYear = now.getUTCFullYear() % 100;

  return {
    issuingState: top.slice(2, 5).replace(/</g, ""),
    surname: fillerToSpace(surnamePart),
    givenNames: fillerToSpace(givenParts.join("<")),
    documentNumber: documentNumberField.replace(/</g, ""),
    nationality: second.slice(10, 13).replace(/</g, ""),
    // Birth dates are in the past; passports expiring in the 1900s are long gone.
    birthDate: mrzDate(birthField, (yy) => (yy > thisYear ? 1900 + yy : 2000 + yy)),
    sex: second[20] === "<" ? "" : second[20],
    expiryDate: mrzDate(expiryField, (yy) => 2000 + yy),
    valid: {
      documentNumber: checkDigitMatches(documentNumberField, second[9]),
      birthDate: checkDigitMatches(birthField, second[19]),
      expiryDate: checkDigitMatches(expiryField, second[27]),
      composite:
        second.length === TD3_LINE_LENGTH &&
        checkDigitMatches(second.slice(0, 10) + second.slice(13, 20) + second.slice(21, 43), second[43]),
    },
  };
}

/** ISO 3166-1 alpha-3 → alpha-2 (plus Thailand), matching the tutor app's nationality picker. */
const ALPHA3_TO_ALPHA2: Record<string, string> = Object.fromEntries(
  (
    "AND:AD ARE:AE AFG:AF ATG:AG AIA:AI ALB:AL ARM:AM AGO:AO ARG:AR AUT:AT AUS:AU AZE:AZ BIH:BA BRB:BB BGD:BD BEL:BE " +
    "BFA:BF BGR:BG BHR:BH BDI:BI BEN:BJ BRN:BN BOL:BO BRA:BR BHS:BS BTN:BT BWA:BW BLR:BY BLZ:BZ CAN:CA COD:CD CAF:CF " +
    "COG:CG CHE:CH CIV:CI CHL:CL CMR:CM CHN:CN COL:CO CRI:CR CUB:CU CPV:CV CYP:CY CZE:CZ DEU:DE DJI:DJ DNK:DK DMA:DM " +
    "DOM:DO DZA:DZ ECU:EC EST:EE EGY:EG ERI:ER ESP:ES ETH:ET FIN:FI FJI:FJ FSM:FM FRA:FR GAB:GA GBR:GB GRD:GD GEO:GE " +
    "GHA:GH GMB:GM GIN:GN GNQ:GQ GRC:GR GTM:GT GNB:GW GUY:GY HKG:HK HND:HN HRV:HR HTI:HT HUN:HU IDN:ID IRL:IE ISR:IL " +
    "IND:IN IRQ:IQ IRN:IR ISL:IS ITA:IT JAM:JM JOR:JO JPN:JP KEN:KE KGZ:KG KHM:KH KIR:KI COM:KM KNA:KN PRK:KP KOR:KR " +
    "KWT:KW KAZ:KZ LAO:LA LBN:LB LCA:LC LIE:LI LKA:LK LBR:LR LSO:LS LTU:LT LUX:LU LVA:LV LBY:LY MAR:MA MCO:MC MDA:MD " +
    "MNE:ME MDG:MG MHL:MH MKD:MK MLI:ML MMR:MM MNG:MN MAC:MO MRT:MR MLT:MT MUS:MU MDV:MV MWI:MW MEX:MX MYS:MY MOZ:MZ " +
    "NAM:NA NER:NE NGA:NG NIC:NI NLD:NL NOR:NO NPL:NP NRU:NR NZL:NZ OMN:OM PAN:PA PER:PE PNG:PG PHL:PH PAK:PK POL:PL " +
    "PSE:PS PRT:PT PLW:PW PRY:PY QAT:QA ROU:RO SRB:RS RUS:RU RWA:RW SAU:SA SLB:SB SYC:SC SDN:SD SWE:SE SGP:SG SVN:SI " +
    "SVK:SK SLE:SL SMR:SM SEN:SN SOM:SO SUR:SR SSD:SS STP:ST SLV:SV SYR:SY SWZ:SZ TCD:TD TGO:TG TJK:TJ TLS:TL TKM:TM " +
    "TUN:TN TON:TO TUR:TR TTO:TT TUV:TV TWN:TW TZA:TZ UKR:UA UGA:UG USA:US URY:UY UZB:UZ VAT:VA VCT:VC VEN:VE VNM:VN " +
    "VUT:VU WSM:WS YEM:YE ZAF:ZA ZMB:ZM ZWE:ZW THA:TH " +
    // ICAO-only codes: Germany, and British nationals other than citizens.
    "D:DE GBD:GB GBN:GB GBO:GB GBP:GB GBS:GB"
  )
    .split(" ")
    .map((pair) => pair.split(":")),
);

/** ICAO / ISO alpha-3 nationality code as ISO alpha-2; null when unknown (e.g. stateless "XXA"). */
export function icaoNationalityToAlpha2(code: unknown): string | null {
  if (typeof code !== "string") return null;
  return ALPHA3_TO_ALPHA2[code.replace(/</g, "").trim().toUpperCase()] ?? null;
}
