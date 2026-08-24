import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@tutor-advantage/shared-config";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export function authMiddleware(
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

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Token expired or invalid",
        requestId: req.id,
      },
    });
  }
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
