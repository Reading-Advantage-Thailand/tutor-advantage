import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import path from "node:path";
import { createOpenApiMiddleware, openApiValidationErrorHandler } from "@tutor-advantage/shared-config";

// The finance validator rejects unknown query parameters, so every filter the
// admin users list sends must be declared in finance-mlm.v1.yaml.
function app() {
  const server = express();
  server.use(
    createOpenApiMiddleware(
      path.resolve(__dirname, "../../../../packages/contracts/openapi/finance-mlm.v1.yaml"),
    ),
  );
  server.get("/v1/users", (_req, res) => {
    res.json({ users: [] });
  });
  server.use(openApiValidationErrorHandler);
  return server;
}

describe("GET /v1/users contract", () => {
  it.each(["EXPIRING", "EXPIRED"])("accepts documents=%s", async (documents) => {
    await request(app())
      .get("/v1/users")
      .query({ role: "TUTOR", documents })
      .set("Authorization", "Bearer test")
      .expect(200);
  });

  it("rejects an unknown documents value", async () => {
    const res = await request(app())
      .get("/v1/users")
      .query({ documents: "SOON" })
      .set("Authorization", "Bearer test");
    expect(res.status).toBe(400);
  });
});
