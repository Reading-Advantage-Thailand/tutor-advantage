import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@tutor-advantage/shared-config";

export interface AuthenticatedRequest extends Request {
  id: string;
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

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
        requestId: req.id,
      },
    });
  }

  const token = authHeader.split(" ")[1];

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
