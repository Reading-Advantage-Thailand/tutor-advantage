/**
 * DEV-ONLY seed routes (/v1/dev/*), used by the student LIFF dev toolbar.
 *
 * Mounted only when `areDevRoutesEnabled()` (NODE_ENV !== "production" AND
 * ENABLE_DEV_ROUTES === "true"), and every request re-checks the same flag, so
 * they stay unreachable in production even if mounted by mistake.
 *
 * Self-scoped routes (seed / purge the caller's own lesson history, seed the
 * caller's own progress, activate the caller's own pending enrollments) only
 * touch rows of `req.user.userId`, so any authenticated user may call them for
 * themselves — this is what lets the dev student's own token work. The
 * class-wide seed touches other students' data and stays ADMIN-only.
 */
import type { NextFunction, RequestHandler, Response } from "express";
import { areDevRoutesEnabled } from "@tutor-advantage/shared-config";
import { requireRoles, type AuthenticatedRequest } from "../middlewares/authMiddleware";

type Env = Parameters<typeof areDevRoutesEnabled>[0];

export interface DevRouteHandlers {
  seedLessonHistory: RequestHandler;
  purgeLessonHistory: RequestHandler;
  seedFullProgress: RequestHandler;
  activateEnrollments: RequestHandler;
  seedClassAllProgress: RequestHandler;
}

export interface DevRouteApp {
  post(path: string, ...handlers: RequestHandler[]): unknown;
  delete(path: string, ...handlers: RequestHandler[]): unknown;
}

/** 404 unless dev routes are enabled for this environment (checked per request). */
export function requireDevRoutesEnabled(env: Env = process.env): RequestHandler {
  return function devRoutesGuard(_req, res: Response, next: NextFunction) {
    if (!areDevRoutesEnabled(env)) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    }
    next();
  };
}

/** The caller must be authenticated; the handler then acts only on req.user.userId. */
export function requireSelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Unauthorized", requestId: req.id } });
  }
  next();
}

/**
 * Registers the dev routes when enabled. Returns whether they were mounted.
 * `auth` is the service's authMiddleware (injected so this is unit-testable).
 */
export function registerDevRoutes(
  app: DevRouteApp,
  auth: RequestHandler,
  handlers: DevRouteHandlers,
  env: Env = process.env,
): boolean {
  if (!areDevRoutesEnabled(env)) return false;
  const enabled = requireDevRoutesEnabled(env);
  const self = requireSelf as RequestHandler;
  const adminOnly = requireRoles("ADMIN") as RequestHandler;

  app.post("/v1/dev/seed/lesson-history", enabled, auth, self, handlers.seedLessonHistory);
  app.delete("/v1/dev/seed/lesson-history", enabled, auth, self, handlers.purgeLessonHistory);
  app.post("/v1/dev/seed/full-progress", enabled, auth, self, handlers.seedFullProgress);
  app.post("/v1/dev/seed/enrollments/activate", enabled, auth, self, handlers.activateEnrollments);
  app.post("/v1/dev/seed/class-all-progress", enabled, auth, adminOnly, handlers.seedClassAllProgress);
  return true;
}
