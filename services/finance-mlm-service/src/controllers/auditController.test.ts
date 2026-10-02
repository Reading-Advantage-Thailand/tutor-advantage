import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  auditEvent: { count: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn() },
}));

vi.mock("@tutor-advantage/database", () => ({ prisma: prismaMock }));

import {
  bangkokMonthRange,
  buildAuditWhere,
  csvCell,
  exportAuditLogs,
  getAuditLogs,
  parseAuditLogQuery,
} from "./auditController";

function createResponse() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, string>,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    send: vi.fn((body: unknown) => {
      res.body = body;
      return res;
    }),
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
  };
  return res;
}

const ADMIN_ID = "ad000000-1111-4000-8000-000000000001";

describe("parseAuditLogQuery", () => {
  it("defaults to page 1, 50 rows, newest first, no filters", () => {
    const parsed = parseAuditLogQuery({});
    expect(parsed).toEqual({
      ok: true,
      value: expect.objectContaining({ page: 1, pageSize: 50, order: "desc", createdFrom: undefined, actions: undefined }),
    });
  });

  it("maps periodMonth to the Bangkok month of the EVENT time", () => {
    const parsed = parseAuditLogQuery({ periodMonth: "2026-10" });
    if (!parsed.ok) throw new Error("expected ok");
    // 2026-10-01 00:00 +07:00 → 2026-09-30T17:00Z ; 2026-11-01 00:00 +07:00 → 2026-10-31T17:00Z
    expect(parsed.value.createdFrom?.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(parsed.value.createdBefore?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("handles December → next year", () => {
    expect(bangkokMonthRange("2026-12")?.end.toISOString()).toBe("2026-12-31T17:00:00.000Z");
  });

  it("intersects periodMonth with an inclusive from/to range", () => {
    const parsed = parseAuditLogQuery({ periodMonth: "2026-10", from: "2026-10-05", to: "2026-10-05" });
    if (!parsed.ok) throw new Error("expected ok");
    expect(parsed.value.createdFrom?.toISOString()).toBe("2026-10-04T17:00:00.000Z");
    expect(parsed.value.createdBefore?.toISOString()).toBe("2026-10-05T17:00:00.000Z");
  });

  it("splits comma separated actions", () => {
    const parsed = parseAuditLogQuery({ actionType: "APPROVE,APPROVE_SETTLEMENT,APPROVE" });
    if (!parsed.ok) throw new Error("expected ok");
    expect(parsed.value.actions).toEqual(["APPROVE", "APPROVE_SETTLEMENT"]);
  });

  it.each([
    [{ page: "0" }, "page"],
    [{ pageSize: "500" }, "pageSize"],
    [{ periodMonth: "2026-13" }, "periodMonth"],
    [{ from: "2026-02-31" }, "from"],
    [{ from: "2026-10-09", to: "2026-10-01" }, "from"],
    [{ actionType: "drop table" }, "actionType"],
    [{ entityType: "User;" }, "entityType"],
    [{ order: "sideways" }, "order"],
    [{ sort: "actorId" }, "sort"],
  ])("rejects %o", (query, field) => {
    const parsed = parseAuditLogQuery(query);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.field).toBe(field);
  });
});

describe("buildAuditWhere", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses an exact actorId for uuids and SYSTEM", async () => {
    const parsed = parseAuditLogQuery({ actor: ADMIN_ID.toUpperCase() });
    if (!parsed.ok) throw new Error("expected ok");
    expect(await buildAuditWhere(parsed.value)).toEqual({ actorId: ADMIN_ID });
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("resolves free-text actors to matching user ids", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ userId: ADMIN_ID }]);
    const parsed = parseAuditLogQuery({ actor: "admin@", entityType: "User", actionType: "USER_VERIFY" });
    if (!parsed.ok) throw new Error("expected ok");
    expect(await buildAuditWhere(parsed.value)).toEqual({
      actorId: { in: [ADMIN_ID] },
      entityType: "User",
      action: "USER_VERIFY",
    });
  });
});

describe("getAuditLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a 400 with the offending field instead of querying", async () => {
    const res = createResponse();
    await getAuditLogs({ id: "req-1", query: { periodMonth: "10/2026" } } as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "INVALID_AUDIT_QUERY", details: { field: "periodMonth" } } });
    expect(prismaMock.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it("pages on the server and includes non-settlement events in a month", async () => {
    prismaMock.auditEvent.count.mockResolvedValue(51);
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        auditEventId: "a-1",
        actorId: ADMIN_ID,
        action: "USER_VERIFY",
        entityType: "User",
        entityId: "u-1",
        payload: { field: "idCard", previousStatus: "PENDING", newStatus: "VERIFIED" },
        createdAt: new Date("2026-10-02T03:00:00Z"),
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      { userId: ADMIN_ID, displayName: "Finance Admin", email: "admin@example.com", role: "ADMIN" },
    ]);
    const res = createResponse();
    await getAuditLogs({ id: "req-2", query: { periodMonth: "2026-10", page: "2", pageSize: "50" } } as never, res as never);

    expect(res.statusCode).toBe(200);
    const args = prismaMock.auditEvent.findMany.mock.calls[0][0];
    expect(args.skip).toBe(50);
    expect(args.take).toBe(50);
    // Filter by event time only: no payload.periodMonth condition.
    expect(args.where).toEqual({
      createdAt: { gte: new Date("2026-09-30T17:00:00.000Z"), lt: new Date("2026-10-31T17:00:00.000Z") },
    });
    expect(res.body).toMatchObject({
      pagination: { total: 51, page: 2, pageSize: 50, totalPages: 2 },
      logs: [
        {
          auditId: "a-1",
          actionType: "USER_VERIFY",
          displayName: "Finance Admin",
          entityType: "User",
          previousStatus: "PENDING",
          newStatus: "VERIFIED",
          createdAt: "2026-10-02T03:00:00.000Z",
        },
      ],
    });
  });
});

describe("exportAuditLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("streams CSV with formula injection neutralised and audits the export", async () => {
    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        auditEventId: "a-1",
        actorId: "SYSTEM",
        action: "ADJUST_CREATE",
        entityType: "Adjustment",
        entityId: "adj-1",
        payload: { reason: "=HYPERLINK(\"x\")", periodMonth: "2026-08" },
        createdAt: new Date("2026-08-02T03:00:00Z"),
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.auditEvent.create.mockResolvedValue({});
    const res = createResponse();
    await exportAuditLogs({ id: "req-3", user: { userId: ADMIN_ID, role: "ADMIN" }, query: {} } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/csv");
    const csv = String(res.body);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"2026-08"');
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "AUDIT_EXPORT", actorId: ADMIN_ID, entityType: "AuditLog" }),
    });
  });

  it("quotes cells", () => {
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell("-1")).toBe("\"'-1\"");
  });
});
