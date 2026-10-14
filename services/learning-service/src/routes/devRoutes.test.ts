import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tutor-advantage/database", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { registerDevRoutes, requireDevRoutesEnabled, requireSelf, type DevRouteHandlers } from "./devRoutes";

const DEV_ENV = { NODE_ENV: "development", ENABLE_DEV_ROUTES: "true" };

function handlers(): DevRouteHandlers {
  return {
    seedLessonHistory: vi.fn(),
    purgeLessonHistory: vi.fn(),
    seedFullProgress: vi.fn(),
    activateEnrollments: vi.fn(),
    seedClassAllProgress: vi.fn(),
  };
}

function fakeApp() {
  const routes = new Map<string, RequestHandler[]>();
  return {
    routes,
    post: (path: string, ...chain: RequestHandler[]) => routes.set(`POST ${path}`, chain),
    delete: (path: string, ...chain: RequestHandler[]) => routes.set(`DELETE ${path}`, chain),
  };
}

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
}

/** Runs a route's middleware chain (sync) with a pre-authenticated user; returns the last handler reached. */
function run(chain: RequestHandler[], user: { userId: string; role: string } | undefined) {
  const req = { id: "req-1", user } as never;
  const res = response();
  let reached = -1;
  for (let i = 0; i < chain.length; i++) {
    let advanced = false;
    chain[i](req, res as never, () => {
      advanced = true;
    });
    reached = i;
    if (!advanced) break;
  }
  return { reached, res };
}

const passAuth: RequestHandler = (_req, _res, next) => next();

describe("registerDevRoutes", () => {
  it("does not mount anything in production, even with ENABLE_DEV_ROUTES=true", () => {
    const app = fakeApp();
    expect(registerDevRoutes(app, passAuth, handlers(), { NODE_ENV: "production", ENABLE_DEV_ROUTES: "true" })).toBe(false);
    expect(app.routes.size).toBe(0);
  });

  it("does not mount anything when ENABLE_DEV_ROUTES is not 'true'", () => {
    const app = fakeApp();
    expect(registerDevRoutes(app, passAuth, handlers(), { NODE_ENV: "development" })).toBe(false);
    expect(app.routes.size).toBe(0);
  });

  it("lets a STUDENT reach the self-scoped seed routes in dev", () => {
    const app = fakeApp();
    const h = handlers();
    registerDevRoutes(app, passAuth, h, DEV_ENV);
    const student = { userId: "student-1", role: "STUDENT" };
    for (const key of [
      "POST /v1/dev/seed/lesson-history",
      "DELETE /v1/dev/seed/lesson-history",
      "POST /v1/dev/seed/full-progress",
      "POST /v1/dev/seed/enrollments/activate",
    ]) {
      const chain = app.routes.get(key)!;
      expect(chain, key).toBeDefined();
      const { reached } = run(chain, student);
      expect(reached, key).toBe(chain.length - 1);
    }
    expect(h.seedLessonHistory).toHaveBeenCalled();
    expect(h.purgeLessonHistory).toHaveBeenCalled();
    expect(h.seedFullProgress).toHaveBeenCalled();
    expect(h.activateEnrollments).toHaveBeenCalled();
  });

  it("keeps the class-wide seed ADMIN-only", () => {
    const app = fakeApp();
    const h = handlers();
    registerDevRoutes(app, passAuth, h, DEV_ENV);
    const chain = app.routes.get("POST /v1/dev/seed/class-all-progress")!;
    const { res } = run(chain, { userId: "student-1", role: "STUDENT" });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(h.seedClassAllProgress).not.toHaveBeenCalled();
    run(chain, { userId: "admin-1", role: "ADMIN" });
    expect(h.seedClassAllProgress).toHaveBeenCalled();
  });
});

describe("requireDevRoutesEnabled", () => {
  it("404s per request outside dev", () => {
    const res = response();
    const next = vi.fn();
    requireDevRoutesEnabled({ NODE_ENV: "production", ENABLE_DEV_ROUTES: "true" })({} as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("passes in dev", () => {
    const next = vi.fn();
    requireDevRoutesEnabled(DEV_ENV)({} as never, response() as never, next);
    expect(next).toHaveBeenCalled();
  });
});

describe("requireSelf", () => {
  it("rejects requests without an authenticated user", () => {
    const res = response();
    const next = vi.fn();
    requireSelf({ id: "r" } as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
