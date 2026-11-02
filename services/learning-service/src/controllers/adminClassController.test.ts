import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@tutor-advantage/database";

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  book: {
    findFirst: vi.fn(),
  },
  class: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  classBookCycle: {
    create: vi.fn(),
  },
  auditEvent: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
}));

vi.mock("@tutor-advantage/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tutor-advantage/database")>()),
  prisma,
}));
vi.mock("../services/ReadingAdvantageDB", () => ({ getArticleDetails: vi.fn() }));
vi.mock("../services/LineNotificationService", () => ({
  LineNotificationService: { buildLiffDeepLink: vi.fn(), sendToUser: vi.fn() },
}));

import { createAdminClass, getAdminClasses } from "./adminClassController";

const adminId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tutorId = "11111111-1111-4111-8111-111111111111";
const classId = "22222222-2222-4222-8222-222222222222";
const bookId = "33333333-3333-4333-8333-333333333333";

function response() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

function adminRequest(body: Record<string, unknown> = {}, role = "ADMIN", headers: Record<string, string> = {}) {
  return {
    id: "req-1",
    user: { userId: adminId, role },
    headers,
    body: {
      tutorEmail: "  Kasamphon63@Gmail.com ",
      tutorDisplayName: " T.นกเอี้ยง ",
      title: " English ",
      bookId: "Primary Origins 2",
      ...body,
    },
  };
}

function listRequest(query: Record<string, string> = {}) {
  return { id: "req-1", user: { userId: adminId, role: "ADMIN" }, query };
}

const book = {
  bookId,
  bookCode: "Primary Origins 2",
  title: "Primary Origins 2",
};

function classRow(overrides: Record<string, unknown> = {}) {
  return {
    classId,
    tutorUserId: tutorId,
    bookId,
    title: "English",
    capacity: 30,
    packagePriceMinor: 300000n,
    freeHours: 0,
    enrolledCount: 0,
    status: "OPEN",
    scheduleDescription: null,
    scheduleData: null,
    meetingUrl: null,
    isDemo: false,
    expiresAt: null,
    startsAt: null,
    endsAt: null,
    setupRequiredAt: new Date("2026-11-02T03:00:00.000Z"),
    createdAt: new Date("2026-11-02T03:00:00.000Z"),
    updatedAt: new Date("2026-11-02T03:00:00.000Z"),
    ...overrides,
  };
}

function tutorRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: tutorId,
    role: "TUTOR",
    isActive: true,
    displayName: "ครูนกเอี้ยง",
    email: "kasamphon63@gmail.com",
    _count: { oauthIdentities: 1 },
    ...overrides,
  };
}

describe("POST /v1/admin/classes", () => {
  beforeEach(() => {
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
    prisma.book.findFirst.mockResolvedValue(book);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      userId: tutorId,
      role: data.role,
      isActive: data.isActive,
      displayName: data.displayName,
      email: data.email,
      _count: { oauthIdentities: 0 },
    }));
    prisma.class.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      classRow({
        title: data.title,
        capacity: data.capacity,
        packagePriceMinor: data.packagePriceMinor,
        setupRequiredAt: data.setupRequiredAt,
      }),
    );
    prisma.classBookCycle.create.mockResolvedValue({});
    prisma.auditEvent.create.mockResolvedValue({});
    prisma.auditEvent.findFirst.mockResolvedValue(null);
  });

  it("pre-provisions a tutor who has not signed up and creates an OPEN class waiting for setup", async () => {
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: "kasamphon63@gmail.com", mode: "insensitive" } },
      }),
    );
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: "kasamphon63@gmail.com", role: "TUTOR", displayName: "T.นกเอี้ยง", isActive: true },
      }),
    );
    const classData = prisma.class.create.mock.calls[0][0].data;
    expect(classData).toMatchObject({
      tutorUserId: tutorId,
      bookId,
      title: "English",
      capacity: 30,
      packagePriceMinor: 300000n,
      status: "OPEN",
      freeHours: 0,
      isDemo: false,
    });
    expect(classData.setupRequiredAt).toBeInstanceOf(Date);
    expect(classData.scheduleData).toBe(Prisma.DbNull);
    expect(prisma.classBookCycle.create).toHaveBeenCalledWith({
      data: { classId, bookId, sequence: 1, status: "OPEN", packagePriceMinor: 300000n },
    });

    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditEvent.create).toHaveBeenNthCalledWith(1, {
      data: {
        actorId: adminId,
        action: "ADMIN_CLASS_CREATE",
        entityType: "Class",
        entityId: classId,
        payload: {
          tutorUserId: tutorId,
          tutorEmail: "kasamphon63@gmail.com",
          tutorCreated: true,
          title: "English",
          bookCode: "Primary Origins 2",
          packagePriceSatang: 300000,
          capacity: 30,
        },
      },
    });
    expect(prisma.auditEvent.create).toHaveBeenNthCalledWith(2, {
      data: {
        actorId: adminId,
        action: "ADMIN_TUTOR_PROVISION",
        entityType: "User",
        entityId: tutorId,
        payload: { email: "kasamphon63@gmail.com", displayName: "T.นกเอี้ยง", classId },
      },
    });

    const body = res.json.mock.calls[0][0];
    expect(body.tutor).toEqual({
      userId: tutorId,
      displayName: "T.นกเอี้ยง",
      email: "kasamphon63@gmail.com",
      pendingRegistration: true,
      created: true,
    });
    expect(body.class).toMatchObject({
      classId,
      title: "English",
      status: "OPEN",
      bookCode: "Primary Origins 2",
      bookTitle: "Primary Origins 2",
      packagePriceSatang: 300000,
      capacity: 30,
      enrolledCount: 0,
      activeStudents: 0,
      setupRequired: true,
      tutor: { userId: tutorId, pendingRegistration: true },
    });
    expect(typeof body.class.setupRequiredAt).toBe("string");
  });

  it("reuses an existing active tutor without renaming them", async () => {
    prisma.user.findMany.mockResolvedValue([tutorRow({ email: "Kasamphon63@gmail.com" })]);
    const res = response();

    await createAdminClass(
      adminRequest({ capacity: 12, packagePriceSatang: 150000 }) as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.class.create.mock.calls[0][0].data).toMatchObject({
      tutorUserId: tutorId,
      capacity: 12,
      packagePriceMinor: 150000n,
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditEvent.create.mock.calls[0][0].data).toMatchObject({
      action: "ADMIN_CLASS_CREATE",
      payload: { tutorCreated: false, tutorEmail: "Kasamphon63@gmail.com" },
    });
    expect(res.json.mock.calls[0][0].tutor).toEqual({
      userId: tutorId,
      displayName: "ครูนกเอี้ยง",
      email: "Kasamphon63@gmail.com",
      pendingRegistration: false,
      created: false,
    });
  });

  it("prefers the exact lower-case email row over a differently cased duplicate", async () => {
    prisma.user.findMany.mockResolvedValue([
      tutorRow({ userId: "student-1", role: "STUDENT", email: "KASAMPHON63@gmail.com" }),
      tutorRow(),
    ]);
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.class.create.mock.calls[0][0].data.tutorUserId).toBe(tutorId);
  });

  it("ignores an ILIKE wildcard hit and provisions a new tutor for an email with '_'", async () => {
    // Prisma runs mode "insensitive" as ILIKE, so "_" in the input also
    // matches "." in another person's address.
    prisma.user.findMany.mockResolvedValue([tutorRow({ userId: "someone-else", email: "nok.eiang@hotmail.com" })]);
    const res = response();

    await createAdminClass(adminRequest({ tutorEmail: "nok_eiang@hotmail.com" }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: "nok_eiang@hotmail.com", role: "TUTOR" }) }),
    );
    expect(prisma.class.create.mock.calls[0][0].data.tutorUserId).not.toBe("someone-else");
  });

  it("refuses an email that belongs to a non-tutor account", async () => {
    prisma.user.findMany.mockResolvedValue([tutorRow({ role: "STUDENT" })]);
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "EMAIL_NOT_TUTOR" }) });
    expect(prisma.class.create).not.toHaveBeenCalled();
    expect(prisma.auditEvent.create).not.toHaveBeenCalled();
  });

  it("refuses a suspended tutor", async () => {
    prisma.user.findMany.mockResolvedValue([tutorRow({ isActive: false })]);
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "TUTOR_SUSPENDED" }) });
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("refuses a book that is not open for new classes", async () => {
    prisma.book.findFirst.mockResolvedValue({ ...book, bookCode: "Primary Adventures 1.0" });
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "BOOK_UNAVAILABLE" }) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("returns BOOK_NOT_FOUND for an unknown book id or code", async () => {
    prisma.book.findFirst.mockResolvedValue(null);
    const res = response();

    await createAdminClass(adminRequest({ bookId }) as never, res as never);

    expect(prisma.book.findFirst).toHaveBeenCalledWith({ where: { bookId } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code: "BOOK_NOT_FOUND" }) });
  });

  it.each([
    [{ tutorEmail: "not-an-email" }, "INVALID_EMAIL"],
    [{ tutorEmail: `${"a".repeat(250)}@x.co` }, "INVALID_EMAIL"],
    [{ tutorDisplayName: "   " }, "INVALID_DISPLAY_NAME"],
    [{ tutorDisplayName: "x".repeat(101) }, "INVALID_DISPLAY_NAME"],
    [{ title: "" }, "INVALID_TITLE"],
    [{ title: "x".repeat(121) }, "INVALID_TITLE"],
    [{ capacity: 0 }, "INVALID_CAPACITY"],
    [{ capacity: 101 }, "INVALID_CAPACITY"],
    [{ capacity: 2.5 }, "INVALID_CAPACITY"],
    [{ packagePriceSatang: 0 }, "INVALID_PRICE"],
    [{ packagePriceSatang: 1_000_001 }, "INVALID_PRICE"],
    [{ packagePriceSatang: "300000" }, "INVALID_PRICE"],
  ])("rejects %o with %s", async (body, code) => {
    const res = response();

    await createAdminClass(adminRequest(body) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.objectContaining({ code }) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("re-resolves the tutor once when another request created the same email first", async () => {
    prisma.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([tutorRow({ _count: { oauthIdentities: 0 } })]);
    prisma.user.create.mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["email"] },
    }));
    const res = response();

    await createAdminClass(adminRequest() as never, res as never);

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].tutor).toMatchObject({ userId: tutorId, created: false, pendingRegistration: true });
  });

  it("returns the class an earlier request with the same Idempotency-Key created", async () => {
    const key = "create-class-sheet-1";
    prisma.auditEvent.findFirst.mockResolvedValue({
      entityId: classId,
      payload: { tutorCreated: true, idempotencyKey: key },
    });
    prisma.class.findUnique.mockResolvedValue({ ...classRow(), book, _count: { enrollments: 1 } });
    prisma.user.findUnique.mockResolvedValue(tutorRow({ _count: { oauthIdentities: 0 } }));
    const res = response();

    await createAdminClass(adminRequest({}, "ADMIN", { "idempotency-key": key }) as never, res as never);

    expect(prisma.auditEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          action: "ADMIN_CLASS_CREATE",
          actorId: adminId,
          payload: { path: ["idempotencyKey"], equals: key },
        },
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.class).toMatchObject({ classId, activeStudents: 1, setupRequired: true });
    expect(body.tutor).toMatchObject({ userId: tutorId, created: true, pendingRegistration: true });
  });

  it("records the Idempotency-Key on the create audit row so a retry can find the class", async () => {
    const res = response();

    await createAdminClass(adminRequest({}, "ADMIN", { "idempotency-key": "create-class-sheet-2" }) as never, res as never);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.auditEvent.create.mock.calls[0][0].data.payload).toMatchObject({
      idempotencyKey: "create-class-sheet-2",
    });
  });

  it("ignores a malformed Idempotency-Key instead of storing it", async () => {
    const res = response();

    await createAdminClass(adminRequest({}, "ADMIN", { "idempotency-key": "bad key" }) as never, res as never);

    expect(prisma.auditEvent.findFirst).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(prisma.auditEvent.create.mock.calls[0][0].data.payload).not.toHaveProperty("idempotencyKey");
  });

  it("is admin only", async () => {
    const res = response();

    await createAdminClass(adminRequest({}, "TUTOR") as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("GET /v1/admin/classes", () => {
  beforeEach(() => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.class.count.mockResolvedValue(0);
    prisma.class.findMany.mockResolvedValue([]);
  });

  it("lists non-demo classes newest first with tutor registration state", async () => {
    prisma.class.count.mockResolvedValue(41);
    prisma.class.findMany.mockResolvedValue([
      {
        ...classRow({ enrolledCount: 3 }),
        book,
        _count: { enrollments: 2 },
      },
    ]);
    prisma.user.findMany.mockResolvedValue([tutorRow({ _count: { oauthIdentities: 0 } })]);
    const res = response();

    await getAdminClasses(listRequest({ page: "3", pageSize: "20" }) as never, res as never);

    const args = prisma.class.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ isDemo: false });
    expect(args.orderBy).toEqual({ createdAt: "desc" });
    expect(args.skip).toBe(40);
    expect(args.take).toBe(20);
    expect(args.include._count).toEqual({ select: { enrollments: { where: { status: "ACTIVE" } } } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      items: [
        {
          classId,
          title: "English",
          status: "OPEN",
          isDemo: false,
          bookId,
          bookCode: "Primary Origins 2",
          bookTitle: "Primary Origins 2",
          packagePriceSatang: 300000,
          capacity: 30,
          enrolledCount: 3,
          activeStudents: 2,
          scheduleDescription: null,
          setupRequired: true,
          setupRequiredAt: "2026-11-02T03:00:00.000Z",
          createdAt: "2026-11-02T03:00:00.000Z",
          tutor: {
            userId: tutorId,
            displayName: "ครูนกเอี้ยง",
            email: "kasamphon63@gmail.com",
            pendingRegistration: true,
          },
        },
      ],
      total: 41,
      page: 3,
      pageSize: 20,
    });
  });

  it("filters by setup state and can include demo classes", async () => {
    const res = response();

    await getAdminClasses(listRequest({ setup: "pending", includeDemo: "true" }) as never, res as never);
    expect(prisma.class.findMany.mock.calls[0][0].where).toEqual({ setupRequiredAt: { not: null } });

    await getAdminClasses(listRequest({ setup: "done" }) as never, res as never);
    expect(prisma.class.findMany.mock.calls[1][0].where).toEqual({ isDemo: false, setupRequiredAt: null });
  });

  it("searches class titles, tutor name or email, and exact class ids", async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ userId: tutorId }]);
    const res = response();

    await getAdminClasses(listRequest({ q: classId, pageSize: "500" }) as never, res as never);

    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
      OR: [
        { displayName: { contains: classId, mode: "insensitive" } },
        { email: { contains: classId, mode: "insensitive" } },
      ],
    });
    const args = prisma.class.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      isDemo: false,
      OR: [
        { title: { contains: classId, mode: "insensitive" } },
        { tutorUserId: { in: [tutorId] } },
        { classId },
      ],
    });
    expect(args.take).toBe(100);
  });

  it("matches an exact class id that is not an RFC v1-5 UUID", async () => {
    const seededClassId = "11111111-1111-1111-1111-111111111111";
    const res = response();

    await getAdminClasses(listRequest({ q: seededClassId }) as never, res as never);

    expect(prisma.class.findMany.mock.calls[0][0].where.OR).toContainEqual({ classId: seededClassId });
  });

  it("is admin only", async () => {
    const res = response();

    await getAdminClasses({ id: "req-1", user: { userId: tutorId, role: "TUTOR" }, query: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.class.findMany).not.toHaveBeenCalled();
  });
});
