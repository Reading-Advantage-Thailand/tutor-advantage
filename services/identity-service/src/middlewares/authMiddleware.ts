import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@tutor-advantage/database";
import { getJwtSecret } from "@tutor-advantage/shared-config";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;
  if (authHeader !== undefined) {
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
          requestId: req.id,
        },
      });
    }
    token = authHeader.slice("Bearer ".length).trim();
  } else {
    const cookies = req.headers.cookie?.split(";").map((part) => part.trim()) || [];
    const sessionCookie = cookies.find((part) =>
      part.startsWith("student-session=") || part.startsWith("tutor_session="),
    );
    token = sessionCookie?.slice(sessionCookie.indexOf("=") + 1);
  }

  if (!token) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
        requestId: req.id,
      },
    });
  }

  let decoded: { userId: string };
  try {
    const verified = jwt.verify(token, getJwtSecret()) as { userId?: unknown };
    if (typeof verified.userId !== "string" || !verified.userId) throw new Error("INVALID_SUBJECT");
    decoded = { userId: verified.userId };
  } catch {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Token expired or invalid",
        requestId: req.id,
      },
    });
  }

  let currentUser: { userId: string; role: string; isActive: boolean } | null;
  try {
    currentUser = await prisma.user.findUnique({
      where: { userId: decoded.userId },
      select: { userId: true, role: true, isActive: true },
    });
  } catch {
    return res.status(503).json({
      error: {
        code: "AUTHENTICATION_UNAVAILABLE",
        message: "Authentication service is temporarily unavailable",
        requestId: req.id,
      },
    });
  }

  if (!currentUser) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Token expired or invalid",
        requestId: req.id,
      },
    });
  }

  if (!currentUser.isActive) {
    return res.status(403).json({
      error: {
        code: "ACCOUNT_SUSPENDED",
        message: "This account is suspended",
        requestId: req.id,
      },
    });
  }

  // JWT role claims are stale after an admin changes a user's role. Always use
  // the current database role for authorization decisions.
  req.user = { userId: currentUser.userId, role: currentUser.role };
  return next();
}

export function requireRoles(...allowedRoles: string[]) {
  const allowed = new Set(allowedRoles);
  return function roleMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    if (!req.user || !allowed.has(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this resource",
          requestId: req.id,
        },
      });
    }
    next();
  };
}
