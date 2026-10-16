import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => {
  const mock = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    userConsent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  return mock;
});

vi.mock("@tutor-advantage/database", () => ({ prisma }));
vi.mock("../lib/storage", () => ({
  deleteFromGCS: vi.fn().mockResolvedValue(undefined),
  getSignedVerificationUrl: vi.fn(),
  isOwnedVerificationObjectKey: (value: unknown, owner: string) =>
    typeof value === "string" && value.startsWith(`verification/${owner}/`),
}));

import { decryptPii } from "@tutor-advantage/shared-config";
import { submitVerification } from "./userController";

const USER = { userId: "tutor-1", role: "TUTOR" };
const WORK_PERMIT_KEY = "verification/tutor-1/11111111-1111-1111-1111-111111111111.png";

function response() {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
  };
  return res;
}

async function submit(body: Record<string, unknown>) {
  const res = response();
  await submitVerification({ id: "req-1", user: USER, body } as never, res as never);
  return res;
}

const passportBody = {
  idType: "PASSPORT",
  taxName: "John Smith",
  passportNumber: "aa 1234567",
  passportNationality: "gb",
  passportExpiresOn: "2099-01-01",
  teachingLocation: "THAILAND",
  privacyNoticeAccepted: true,
  rightToWorkConfirmed: true,
};

describe("submitVerification identity documents", () => {
  beforeEach(() => {
    vi.stubEnv("PII_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
    prisma.user.findUnique.mockReset().mockResolvedValue({ settings: {}, idType: "THAI_ID" });
    prisma.user.update.mockReset().mockResolvedValue({ userId: "tutor-1", verificationStatus: "PENDING", settings: {} });
    prisma.userConsent.create.mockReset().mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps the Thai ID flow (no idType) and enforces the checksum", async () => {
    const bad = await submit({ taxName: "สมชาย", nationalId: "1101700230705" });
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_THAI_ID");

    const ok = await submit({ taxName: "สมชาย", nationalId: "1-1017-00230-70-8" });
    expect(ok.statusCode).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.idType).toBe("THAI_ID");
    expect(data.settings.nationalId).toBe("1101700230708");
    expect(data.settings.verification.taxInfo.status).toBe("PENDING");
  });

  it("stores the passport encrypted with only the last 4 in clear and records both consents", async () => {
    const res = await submit(passportBody);
    expect(res.statusCode).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.idType).toBe("PASSPORT");
    expect(data.passportNumberEnc).not.toContain("AA1234567");
    expect(decryptPii(data.passportNumberEnc)).toBe("AA1234567");
    expect(data.passportNumberLast4).toBe("4567");
    expect(data.passportNationality).toBe("GB");
    expect(data.teachingLocation).toBe("THAILAND");
    expect(data.rightToWorkConfirmedAt).toBeInstanceOf(Date);
    expect(data.settings.nationalId).toBeUndefined();
    expect(JSON.stringify(data.settings)).not.toContain("1234567");
    expect(prisma.userConsent.create.mock.calls.map((call) => call[0].data.consentType)).toEqual([
      "PRIVACY_NOTICE_PASSPORT_V1",
      "RIGHT_TO_WORK",
    ]);
  });

  it.each([
    [{ passportNumber: "A12" }, "INVALID_PASSPORT_NUMBER"],
    [{ passportNationality: "Britain" }, "INVALID_NATIONALITY"],
    [{ passportExpiresOn: "2020-01-01" }, "PASSPORT_EXPIRED"],
    [{ teachingLocation: "MOON" }, "INVALID_TEACHING_LOCATION"],
    [{ privacyNoticeAccepted: false }, "PRIVACY_NOTICE_REQUIRED"],
    [{ rightToWorkConfirmed: undefined }, "RIGHT_TO_WORK_REQUIRED"],
  ])("rejects an invalid passport submission %o", async (override, code) => {
    const res = await submit({ ...passportBody, ...override });
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe(code);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("refuses passports when encryption is not configured", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    const res = await submit(passportBody);
    expect(res.statusCode).toBe(503);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a work permit only for passport holders teaching from Thailand", async () => {
    const thai = await submit({ workPermitImageUrl: WORK_PERMIT_KEY, workPermitExpiresOn: "2099-01-01" });
    expect(thai.statusCode).toBe(400);
    expect(thai.body.error.code).toBe("WORK_PERMIT_NOT_REQUIRED");

    prisma.user.findUnique.mockResolvedValue({ settings: {}, idType: "PASSPORT", teachingLocation: "THAILAND" });
    const expired = await submit({ workPermitImageUrl: WORK_PERMIT_KEY, workPermitExpiresOn: "2020-01-01" });
    expect(expired.body.error.code).toBe("INVALID_WORK_PERMIT");

    const ok = await submit({ workPermitImageUrl: WORK_PERMIT_KEY, workPermitExpiresOn: "2099-01-01" });
    expect(ok.statusCode).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.workPermitImageUrl).toBe(WORK_PERMIT_KEY);
    expect(data.settings.verification.workPermit.status).toBe("PENDING");
  });

  it("keeps the stored passport number and earlier consents when a passport holder edits other details", async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: { taxName: "John Smith" },
      idType: "PASSPORT",
      teachingLocation: "THAILAND",
      passportNumberEnc: "v1:stored",
      rightToWorkConfirmedAt: new Date("2026-10-01"),
      userConsents: [{ userConsentId: "c1" }],
    });
    const res = await submit({
      ...passportBody,
      passportNumber: "",
      teachingLocation: "ABROAD",
      privacyNoticeAccepted: false,
      rightToWorkConfirmed: false,
    });
    expect(res.statusCode).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty("passportNumberEnc");
    expect(data).not.toHaveProperty("rightToWorkConfirmedAt");
    expect(data.teachingLocation).toBe("ABROAD");
    expect(prisma.userConsent.create).not.toHaveBeenCalled();
  });

  it("still requires a passport number and consents the first time", async () => {
    const res = await submit({ ...passportBody, passportNumber: "" });
    expect(res.body.error.code).toBe("INVALID_PASSPORT_NUMBER");
  });

  it("drops the work permit when a passport holder switches to teaching from abroad", async () => {
    prisma.user.findUnique.mockResolvedValue({
      settings: { verification: { workPermit: { status: "VERIFIED" } } },
      idType: "PASSPORT",
      teachingLocation: "THAILAND",
      workPermitImageUrl: WORK_PERMIT_KEY,
    });
    const res = await submit({ ...passportBody, teachingLocation: "ABROAD" });
    expect(res.statusCode).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.workPermitImageUrl).toBeNull();
    expect(data.settings.verification.workPermit).toBeUndefined();
  });
});
