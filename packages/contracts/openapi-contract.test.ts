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
