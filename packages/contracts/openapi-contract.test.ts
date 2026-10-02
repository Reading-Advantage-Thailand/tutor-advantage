import path from "node:path";
import express, { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createOpenApiMiddleware,
  openApiValidationErrorHandler,
} from "../shared-config/src/middlewares/openapi";

function contractApp(
  spec: "identity.v1.yaml" | "learning.v1.yaml" | "finance-mlm.v1.yaml",
  register: (app: Express) => void,
) {
  const app = express();
  app.use(express.json());
  app.use(
    createOpenApiMiddleware(
      path.resolve(process.cwd(), "packages/contracts/openapi", spec),
    ),
  );
  register(app);
  app.use(openApiValidationErrorHandler);
  return app;
}

describe("identity OpenAPI contract", () => {
  const app = contractApp("identity.v1.yaml", (server) => {
    server.patch("/v1/users/me/profile", (_req, res) => {
      res.status(200).json({ user: { dateOfBirth: "2008-01-01" } });
    });
    server.get("/v1/session", (_req, res) => {
      res.status(200).json({
        id: "user-1",
        name: "Student",
        role: "STUDENT",
        dateOfBirth: "2008-01-01",
        requiresGuardian: true,
      });
    });
    server.get("/v1/users/me/settings", (_req, res) => {
      res.status(200).json({
        settings: { notifications: { notifyClassReminders: false } },
        lineConnected: true,
      });
    });
    server.patch("/v1/users/me/settings", (req, res) => {
      res.status(200).json({ settings: req.body });
    });
  });

  it("rejects malformed dates before the profile handler", async () => {
    const response = await request(app)
      .patch("/v1/users/me/profile")
      .send({ dateOfBirth: "01/01/2008" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("OPENAPI_REQUEST_VALIDATION_FAILED");
  });

  it("accepts the current-user response shape", async () => {
    await request(app).get("/v1/session").expect(200);
  });

  it("accepts notification settings and the linked LINE status", async () => {
    await request(app).get("/v1/users/me/settings").expect(200);
    await request(app)
      .patch("/v1/users/me/settings")
      .send({ notifications: { notifyLineMessages: false } })
      .expect(200);
  });

  it("rejects non-boolean notification preferences", async () => {
    const response = await request(app)
      .patch("/v1/users/me/settings")
      .send({ notifications: { notifyClassReminders: "false" } });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("OPENAPI_REQUEST_VALIDATION_FAILED");
  });
});

describe("enrollment OpenAPI contract", () => {
  it("rejects a response with an unknown placement", async () => {
    const app = contractApp("learning.v1.yaml", (server) => {
      server.post("/v1/enroll/:referralToken", (_req, res) => {
        res.status(200).json({
          message: "ok",
          enrollmentId: "enrollment-1",
          classId: "class-1",
          placement: "UNKNOWN",
        });
      });
    });

    const response = await request(app).post("/v1/enroll/token-1").send({});
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("OPENAPI_RESPONSE_VALIDATION_FAILED");
  });
});

describe("finance OpenAPI contracts", () => {
  const app = contractApp("finance-mlm.v1.yaml", (server) => {
    server.post("/v1/payments/intent", (_req, res) => {
      res.status(201).json({ message: "created" });
    });
    server.post("/v1/payments/webhook", (_req, res) => {
      res.status(200).send("processed");
    });
    server.post("/v1/settlements/preview", (_req, res) => {
      res.status(200).json({
        message: "generated",
        preview: {
          snapshotId: "run-1",
          periodMonth: "2026-06",
          totalPayoutSatang: 1000.5,
          totalNetPayoutSatang: 970,
          payoutLineCount: 1,
          status: "DRAFT",
        },
      });
    });
  });

  it.each([100.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects non-Satang-safe payment amount %s",
    async (amountSatang) => {
      const response = await request(app).post("/v1/payments/intent").send({
        enrollmentId: "enrollment-1",
        amountSatang,
      });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("OPENAPI_REQUEST_VALIDATION_FAILED");
    },
  );

  it("rejects an empty webhook payload", async () => {
    await request(app).post("/v1/payments/webhook").send({}).expect(400);
  });

  it("catches decimal currency in settlement responses", async () => {
    const response = await request(app)
      .post("/v1/settlements/preview")
      .send({ periodMonth: "2026-06" });
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("OPENAPI_RESPONSE_VALIDATION_FAILED");
  });
});

describe("finance audit-log OpenAPI contract (admin G1)", () => {
  const app = contractApp("finance-mlm.v1.yaml", (server) => {
    server.get("/v1/audit-logs", (_req, res) => {
      res.status(200).json({
        logs: [
          {
            auditId: "a-1",
            actionType: "USER_VERIFY",
            actorUserId: "SYSTEM",
            displayName: "SYSTEM",
            actorEmail: null,
            actorRole: null,
            entityType: "User",
            targetId: "u-1",
            periodMonth: "",
            createdAt: "2026-10-02T03:00:00.000Z",
            metadata: { field: "idCard" },
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 50, totalPages: 1 },
      });
    });
    server.get("/v1/audit-logs/export", (_req, res) => {
      res.status(200).type("text/csv").send("a,b\n");
    });
  });

  it("accepts the documented filters and pagination", async () => {
    await request(app)
      .get("/v1/audit-logs")
      .query({
        periodMonth: "2026-10",
        page: 2,
        pageSize: 50,
        order: "desc",
        sort: "createdAt",
        from: "2026-10-01",
        to: "2026-10-31",
        actionType: "APPROVE,APPROVE_SETTLEMENT",
        entityType: "SettlementRun",
        entityId: "run-1",
        actor: "admin@example.com",
      })
      .expect(200);
    await request(app).get("/v1/audit-logs/export").query({ periodMonth: "2026-10" }).expect(200);
  });

  it.each([
    [{ periodMonth: "2026-13" }],
    [{ pageSize: 1000 }],
    [{ actionType: "approve" }],
    [{ unknownParam: "x" }],
  ])("rejects %o", async (query) => {
    const response = await request(app).get("/v1/audit-logs").query(query);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("OPENAPI_REQUEST_VALIDATION_FAILED");
  });
});

describe("finance admin endpoints OpenAPI contract (admin G2–G5)", () => {
  const ok = (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(200).json({ ok: true });
  };
  const app = contractApp("finance-mlm.v1.yaml", (server) => {
    server.get("/v1/settlements", ok);
    server.get("/v1/operations/exceptions", ok);
    server.post("/v1/operations/exceptions/:id/:action", ok);
    server.get("/v1/fraud-flags", ok);
    server.post("/v1/fraud-flags/:id/action", ok);
    server.post("/v1/reconciliation/payments/:id/activate", ok);
    server.post("/v1/reconciliation/payments/:id/verify", ok);
    server.get("/v1/reconciliation/orphan-events", ok);
    server.post("/v1/reconciliation/orphan-events/:id/link", ok);
    server.post("/v1/reconciliation/orphan-events/:id/dismiss", ok);
    server.get("/v1/reconciliation/active-without-payment", ok);
    server.get("/v1/users", ok);
    server.get("/v1/users/:id", ok);
    server.get("/v1/users/:id/payments", ok);
    server.get("/v1/users/:id/audit", ok);
    server.get("/v1/coupons", ok);
    server.get("/v1/coupons/tutors", ok);
    server.patch("/v1/coupons/:couponId", ok);
    server.post("/v1/coupons/:couponId/void", ok);
  });
  const id = "11111111-2222-4333-8444-555555555555";

  it("accepts the queries the admin console sends", async () => {
    const cases: Array<[string, Record<string, string | number>]> = [
      ["/v1/settlements", { page: 1, pageSize: 20, status: "SUBMITTED", periodMonth: "2026-09" }],
      ["/v1/operations/exceptions", { status: "UNRESOLVED", type: "PAYMENT", q: "x", page: 1, pageSize: 20, order: "asc" }],
      ["/v1/fraud-flags", { status: "ACTIVE", severity: "HIGH", q: "x", page: 2, pageSize: 50, order: "desc" }],
      ["/v1/reconciliation/orphan-events", { state: "DISMISSED", page: 1, pageSize: 20, q: "chrg", order: "asc" }],
      ["/v1/reconciliation/active-without-payment", { days: 30, page: 1, pageSize: 20, q: "x", order: "desc" }],
      ["/v1/users", { page: 1, pageSize: 20, sort: "name", order: "asc", q: "a", role: "TUTOR", status: "ACTIVE", verification: "REVIEW" }],
      ["/v1/users", { role: "TUTOR", q: "a", pageSize: 8 }],
      ["/v1/users", { limit: 50 }],
      [`/v1/users/${id}/payments`, {}],
      [`/v1/users/${id}/audit`, { page: 1, pageSize: 20 }],
      ["/v1/coupons", { page: 1, pageSize: 50, sort: "expiresAt", order: "asc", q: "TA-", status: "VOID" }],
      ["/v1/coupons/tutors", { q: "ann" }],
    ];
    for (const [url, query] of cases) {
      const response = await request(app).get(url).query(query);
      expect(response.status, `${url} ${JSON.stringify(query)} ${JSON.stringify(response.body)}`).toBe(200);
    }
    // Undocumented routes stay unvalidated.
    await request(app).get(`/v1/users/${id}`).query({ anything: 1 }).expect(200);
  });

  it("accepts the bodies the admin console sends", async () => {
    await request(app).post(`/v1/operations/exceptions/${id}/resolve`).send({ resolution: "MARK_RESOLVED", note: "fixed it" }).expect(200);
    await request(app).post(`/v1/fraud-flags/${id}/action`).send({ action: "FREEZE", reason: "suspicious" }).expect(200);
    await request(app).post(`/v1/reconciliation/payments/${id}/activate`).send({ reason: "paid ok" }).expect(200);
    await request(app).post(`/v1/reconciliation/payments/${id}/verify`).send({}).expect(200);
    await request(app).post(`/v1/reconciliation/orphan-events/${id}/link`).send({ paymentIntentId: id, reason: "same charge" }).expect(200);
    await request(app).post(`/v1/reconciliation/orphan-events/${id}/dismiss`).send({ reason: "test event" }).expect(200);
    await request(app).patch(`/v1/coupons/${id}`).send({ note: null, expiresAt: null, assignedTutorId: id }).expect(200);
    await request(app).post(`/v1/coupons/${id}/void`).send({ reason: "issued by mistake" }).expect(200);
    await request(app).post(`/v1/coupons/${id}/void`).send({}).expect(200);
  });

  it.each([
    ["/v1/users", { verification: "pending-ish" }],
    ["/v1/users", { pageSize: 500 }],
    ["/v1/users", { filter: "pending" }],
    ["/v1/coupons", { status: "DELETED" }],
    ["/v1/coupons", { sort: "amount" }],
    ["/v1/settlements", { periodMonth: "2026-13" }],
    ["/v1/fraud-flags", { severity: "EXTREME" }],
    ["/v1/reconciliation/orphan-events", { state: "LINKED" }],
    [`/v1/users/${"x".repeat(5)}/audit`, { page: 0 }],
  ])("rejects GET %s %o", async (url, query) => {
    const response = await request(app).get(url).query(query);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("OPENAPI_REQUEST_VALIDATION_FAILED");
  });

  it("rejects malformed bodies", async () => {
    for (const [url, body] of [
      [`/v1/coupons/${id}`, {}],
      [`/v1/coupons/${id}`, { hours: 5 }],
      [`/v1/coupons/${id}/void`, { reason: 42 }],
      [`/v1/fraud-flags/${id}/action`, { reason: "no action" }],
      [`/v1/reconciliation/orphan-events/${id}/link`, { reason: "missing intent" }],
    ] as const) {
      const method = url.endsWith(id) ? "patch" : "post";
      const response = await request(app)[method](url).send(body);
      expect(response.status, `${url} ${JSON.stringify(body)}`).toBe(400);
    }
  });
});
