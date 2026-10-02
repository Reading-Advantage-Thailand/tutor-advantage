import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    oAuthIdentity: { count: vi.fn(), deleteMany: vi.fn() },
    guardianConsent: { count: vi.fn(), updateMany: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    payoutLine: { count: vi.fn(), updateMany: vi.fn(), findMany: vi.fn() },
    class: { groupBy: vi.fn(), findMany: vi.fn() },
    enrollment: { groupBy: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof mock) => unknown)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return mock;
});

vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));
vi.mock("../services/omiseService", () => ({
  isOmiseConfigured: () => false,
  createOmiseRecipient: vi.fn(),
}));

import {
  anonymizeUser,
  buildUserListWhere,
  computeVerificationStatus,
  getUserDetails,
  getUsers,
  maskTail,
  planVerification,
  scrubSettings,
  settingsForRole,
  suspendUser,
  verifyUser,
} from "./userController";

const USER_ID = "5eed0000-0000-4000-8000-000000000101";
const ADMIN = { userId: "ad000000-1111-4000-8000-000000000001", role: "ADMIN" };
const CHECKER = { userId: "5eed0000-0000-4000-8000-000000000301", role: "FINANCE_CHECKER" };

function createResponse() {
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

const pendingTutor = {
  role: "TUTOR",
  displayName: "มานี",
  email: null,
  idCardImageUrl: "/id.png",
  bankBookImageUrl: null,
  payoutIdentityVersion: 3,
  verificationStatus: "PENDING",
  settings: {
    address: "99/1",
    bankAccountNumber: "1234567890",
    bankBrand: "kbank",
    verification: {
      idCard: { status: "PENDING" },
      address: { status: "PENDING" },
      bankBook: { status: "PENDING" },
      // taxInfo never submitted
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof prismaMock) => unknown)(prismaMock);
    return Promise.all(arg as Promise<unknown>[]);
  });
});

describe("planVerification", () => {
  it("ALL approves only submitted (PENDING) fields, never unsubmitted ones", () => {
    const plan = planVerification({ field: "ALL", status: "VERIFIED", user: pendingTutor });
    expect(plan).toEqual({ ok: true, targets: ["idCard", "bankBook", "address"] });
  });

  it("refuses a single field that was never submitted", () => {
    const plan = planVerification({ field: "taxInfo", status: "VERIFIED", user: pendingTutor });
    expect(plan).toMatchObject({ ok: false, code: "VERIFICATION_NOT_SUBMITTED" });
  });

  it("refuses ALL when nothing is pending", () => {
    const plan = planVerification({
      field: "ALL",
      status: "VERIFIED",
      user: { settings: { verification: { idCard: { status: "VERIFIED" } } } },
    });
    expect(plan).toMatchObject({ ok: false, status: 409, code: "NO_PENDING_VERIFICATION" });
  });

  it("rejects a stale confirm list", () => {
    const plan = planVerification({ field: "ALL", fields: ["idCard"], status: "VERIFIED", user: pendingTutor });
    expect(plan).toMatchObject({ ok: false, code: "VERIFICATION_CHANGED" });
  });

  it("refuses approval when the document is missing", () => {
    const user = { ...pendingTutor, idCardImageUrl: null };
    const plan = planVerification({ field: "idCard", status: "VERIFIED", user });
    expect(plan).toMatchObject({ ok: false, code: "VERIFICATION_DATA_MISSING" });
  });
});

describe("computeVerificationStatus", () => {
  it("derives the overall status", () => {
    expect(computeVerificationStatus({})).toBe("UNVERIFIED");
    expect(computeVerificationStatus({ idCard: { status: "PENDING" } })).toBe("PENDING");
    expect(computeVerificationStatus({ idCard: { status: "REJECTED" }, address: { status: "PENDING" } })).toBe("REJECTED");
    expect(
      computeVerificationStatus({
        idCard: { status: "VERIFIED" },
        bankBook: { status: "VERIFIED" },
        address: { status: "VERIFIED" },
        taxInfo: { status: "VERIFIED" },
      }),
    ).toBe("VERIFIED");
  });
});

describe("PII masking", () => {
  it("masks all but the last 4 digits", () => {
    expect(maskTail("1234567890")).toBe("••••••7890");
    expect(maskTail(null)).toBeNull();
  });

  it("FINANCE_CHECKER never receives national ID, address or full bank account", () => {
    const masked = settingsForRole(
      { nationalId: "1101700000011", address: "99/1", bankAccountNumber: "1234567890", taxName: "มานี" },
      "FINANCE_CHECKER",
    );
    expect(masked.nationalId).toBeNull();
    expect(masked.address).toBeNull();
    expect(masked.bankAccountNumber).toBe("••••••7890");
    expect(masked.masked).toBe(true);
    expect(JSON.stringify(masked)).not.toContain("1101700000011");
  });

  it("ADMIN receives the full data for review", () => {
    const full = settingsForRole({ nationalId: "1101700000011" }, "ADMIN");
    expect(full.nationalId).toBe("1101700000011");
    expect(full.masked).toBe(false);
  });

  it("getUserDetails masks server-side for checkers and hides document images", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      userId: USER_ID,
      ...pendingTutor,
      phoneNumber: "0812345678",
      dateOfBirth: null,
      isActive: true,
      createdAt: new Date("2026-01-01"),
      sponsorTutorId: null,
      settings: { ...pendingTutor.settings, nationalId: "1101700000011" },
      userConsents: [],
      oauthIdentities: [],
    });
    prismaMock.guardianConsent.findMany.mockResolvedValue([]);
    prismaMock.class.findMany.mockResolvedValue([]);
    prismaMock.enrollment.findMany.mockResolvedValue([]);
    const res = createResponse();
    await getUserDetails({ params: { id: USER_ID }, user: CHECKER, query: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("1101700000011");
    expect(body).not.toContain("1234567890");
    expect(body).not.toContain("0812345678");
    expect(res.body.user.idCardImageUrl).toBeNull();
    expect(res.body.user.piiMasked).toBe(true);
  });
});

describe("getUsers", () => {
  it("builds server-side filters (search tolerates null emails, review = any pending field)", () => {
    const where = buildUserListWhere({ q: "may", role: "student", verification: "REVIEW", status: "ACTIVE" }) as any;
    expect(where.AND[0]).toEqual({ role: "STUDENT" });
    expect(where.AND[1].OR[1]).toEqual({ email: { contains: "may", mode: "insensitive" } });
    expect(where.AND).toContainEqual({ isActive: true });
    expect(where.AND[3].OR).toHaveLength(4);
  });

  it("paginates and never returns settings", async () => {
    prismaMock.user.count.mockResolvedValue(42);
    prismaMock.user.findMany.mockResolvedValue([
      {
        userId: USER_ID,
        displayName: null,
        email: null,
        role: "STUDENT",
        profilePictureUrl: null,
        verificationStatus: "UNVERIFIED",
        settings: { nationalId: "1101700000011" },
        isActive: true,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    prismaMock.class.groupBy.mockResolvedValue([]);
    prismaMock.enrollment.groupBy.mockResolvedValue([]);
    prismaMock.guardianConsent.groupBy.mockResolvedValue([]);
    const res = createResponse();
    await getUsers({ user: ADMIN, query: { page: "2", pageSize: "10" } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    expect(res.body.total).toBe(42);
    expect(res.body.items[0].email).toBeNull();
    expect(res.body.items[0].name).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("1101700000011");
  });
});

describe("verifyUser", () => {
  it("approves only pending fields and writes an audit event in the transaction", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(pendingTutor);
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.auditEvent.create.mockResolvedValueOnce({});
    const res = createResponse();
    await verifyUser(
      { params: { id: USER_ID }, user: ADMIN, body: { status: "VERIFIED", field: "ALL" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.fields).toEqual(["idCard", "bankBook", "address"]);
    const update = prismaMock.user.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ userId: USER_ID, payoutIdentityVersion: 3 });
    expect(update.data.settings.verification.taxInfo).toBeUndefined();
    expect(update.data.verificationStatus).toBe("UNVERIFIED");
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "USER_VERIFY", payload: expect.objectContaining({ status: "VERIFIED" }), entityId: USER_ID, actorId: ADMIN.userId }),
    });
  });

  it("returns 409 and writes nothing when the tutor re-submitted meanwhile", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(pendingTutor);
    prismaMock.user.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = createResponse();
    await verifyUser(
      { params: { id: USER_ID }, user: ADMIN, body: { status: "VERIFIED", field: "idCard" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("VERIFICATION_CHANGED");
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it("requires a reason to reject", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(pendingTutor);
    const res = createResponse();
    await verifyUser(
      { params: { id: USER_ID }, user: ADMIN, body: { status: "REJECTED", field: "idCard" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("REJECT_REASON_REQUIRED");
  });
});

describe("suspendUser", () => {
  it("is idempotent with an explicit target state", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ isActive: false, role: "STUDENT", settings: {} });
    const res = createResponse();
    await suspendUser(
      { params: { id: USER_ID }, user: ADMIN, body: { isActive: false, reason: "ทดสอบ" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.unchanged).toBe(true);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});

describe("anonymize", () => {
  it("scrubSettings drops every key and keeps only the erasure marker", () => {
    const { settings, removed } = scrubSettings(
      { address: "x", bankAccountNumber: "1", nationalId: "2", taxName: "t", omiseRecipientId: "recp_1", verification: {} },
      { anonymizedAt: "2026-10-02T00:00:00Z", anonymizedBy: "admin" },
    );
    expect(settings).toEqual({ anonymizedAt: "2026-10-02T00:00:00Z", anonymizedBy: "admin" });
    expect(removed).toEqual(expect.arrayContaining(["address", "bankAccountNumber", "nationalId", "omiseRecipientId"]));
  });

  const tutorRow = {
    role: "TUTOR",
    settings: { nationalId: "1101700000011", bankAccountNumber: "1234567890", address: "99/1" },
    displayName: "มานี",
    email: "m@example.com",
    phoneNumber: "081",
    profilePictureUrl: null,
    dateOfBirth: null,
    idCardImageUrl: "/id.png",
    bankBookImageUrl: "/bank.png",
    verificationComment: null,
    isActive: true,
  };

  it("scrubs settings, documents, OAuth, guardian names and payout snapshots with an audit row", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(tutorRow);
    prismaMock.payoutLine.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prismaMock.oAuthIdentity.count.mockResolvedValueOnce(1);
    prismaMock.guardianConsent.count.mockResolvedValueOnce(0);
    const res = createResponse();
    await anonymizeUser({ params: { id: USER_ID }, user: ADMIN, body: { reason: "คำขอ PDPA" } } as never, res as never);
    expect(res.statusCode).toBe(200);
    const update = prismaMock.user.update.mock.calls[0][0];
    expect(update.data).toMatchObject({ email: null, idCardImageUrl: null, bankBookImageUrl: null, isActive: false });
    expect(Object.keys(update.data.settings)).toEqual(["anonymizedAt", "anonymizedBy"]);
    expect(prismaMock.oAuthIdentity.deleteMany).toHaveBeenCalled();
    expect(prismaMock.payoutLine.updateMany).toHaveBeenCalledWith({
      where: { tutorUserId: USER_ID, recipientSnapshot: { not: null } },
      data: { recipientSnapshot: null },
    });
    const audit = prismaMock.auditEvent.create.mock.calls[0][0].data;
    expect(audit.action).toBe("USER_ANONYMIZE");
    expect(JSON.stringify(audit.payload)).not.toContain("1101700000011");
  });

  it("is a no-op the second time", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({
      ...tutorRow,
      settings: { anonymizedAt: "2026-10-01T00:00:00Z", anonymizedBy: "a" },
      displayName: "Anonymized User",
      email: null,
      phoneNumber: null,
      idCardImageUrl: null,
      bankBookImageUrl: null,
      isActive: false,
    });
    prismaMock.payoutLine.count.mockResolvedValue(0);
    prismaMock.oAuthIdentity.count.mockResolvedValueOnce(0);
    prismaMock.guardianConsent.count.mockResolvedValueOnce(0);
    const res = createResponse();
    await anonymizeUser({ params: { id: USER_ID }, user: ADMIN, body: {} } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body.alreadyAnonymized).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("blocks while the tutor still has unsettled payouts", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(tutorRow);
    prismaMock.payoutLine.count.mockResolvedValueOnce(1);
    const res = createResponse();
    await anonymizeUser({ params: { id: USER_ID }, user: ADMIN, body: {} } as never, res as never);
    expect(res.statusCode).toBe(409);
    expect(res.body.error.code).toBe("USER_HAS_OPEN_PAYOUTS");
  });

  it("refuses staff accounts and checkers", async () => {
    const res = createResponse();
    await anonymizeUser({ params: { id: USER_ID }, user: CHECKER, body: {} } as never, res as never);
    expect(res.statusCode).toBe(403);
    prismaMock.user.findUnique.mockResolvedValueOnce({ ...tutorRow, role: "ADMIN" });
    const res2 = createResponse();
    await anonymizeUser({ params: { id: USER_ID }, user: ADMIN, body: {} } as never, res2 as never);
    expect(res2.statusCode).toBe(409);
  });
});

describe("verifyUser permissions", () => {
  it("is ADMIN only (checkers see masked data)", async () => {
    const res = createResponse();
    await verifyUser(
      { params: { id: USER_ID }, user: CHECKER, body: { status: "VERIFIED", field: "idCard" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
