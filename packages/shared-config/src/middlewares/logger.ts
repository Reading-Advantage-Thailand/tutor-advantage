import { createHash } from "crypto";
import winston from "winston";
import { Request, Response, NextFunction } from "express";

const DATABASE_URL_PATTERN = /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const COOKIE_TOKEN_PATTERN = /\b((?:student-session|tutor_session|session|token)=)[^;\s]+/gi;
const SENSITIVE_QUERY_PARAMETER_PATTERN = /([?&](?:access_token|authorization|code|id_token|password|referralToken|secret|signature|state|token)=)[^&#\s]*/gi;

const SENSITIVE_KEY_PATTERN = /(?:access|api|auth|cookie|database|password|private|refresh|secret|token)/i;
const IDENTIFIER_KEYS = new Set([
  "articleid",
  "bookid",
  "classid",
  "conversationid",
  "enrollmentid",
  "lineuserid",
  "paymentid",
  "paymentintentid",
  "payoutlineid",
  "providerid",
  "providersubject",
  "referralid",
  "sessionid",
  "studentid",
  "tutorid",
  "transferid",
  "userid",
]);

const SENSITIVE_ROUTE_PARENTS = new Set([
  "articles",
  "auth",
  "code",
  "enroll",
  "enrollment",
  "invite",
  "invitation",
  "payments",
  "referral",
  "referrals",
  "sessions",
  "share-link",
  "token",
  "users",
]);

function normalizeKey(key: string) {
  return key.replace(/[-_]/g, "").toLowerCase();
}

/** Hashes identifiers so logs can still be correlated without exposing them. */
export function hashIdentifier(value: unknown): string {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

/** Removes credentials and secret-bearing URL values from log messages. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(DATABASE_URL_PATTERN, "[REDACTED_DATABASE_URL]")
    .replace(BEARER_TOKEN_PATTERN, "Bearer [REDACTED]")
    .replace(COOKIE_TOKEN_PATTERN, "$1[REDACTED]")
    .replace(SENSITIVE_QUERY_PARAMETER_PATTERN, "$1[REDACTED]");
}

/** Recursively redacts structured log metadata using the same policy as messages. */
export function redactLogValue(value: unknown, key?: string): unknown {
  const normalizedKey = key ? normalizeKey(key) : undefined;

  if (normalizedKey && SENSITIVE_KEY_PATTERN.test(normalizedKey)) {
    return "[REDACTED]";
  }

  if (normalizedKey && IDENTIFIER_KEYS.has(normalizedKey)) {
    return hashIdentifier(value);
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveText(value.message),
      stack: value.stack ? redactSensitiveText(value.stack) : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactLogValue(entryValue, entryKey),
      ]),
    );
  }

  return value;
}

const redactFormat = winston.format((info) => {
  const mutableInfo = info as unknown as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(mutableInfo)) {
    mutableInfo[key] = redactLogValue(mutableInfo[key], typeof key === "string" ? key : undefined);
  }
  return info;
});

function joinRoutePath(baseUrl: string | undefined, routePath: string) {
  const joined = `${baseUrl || ""}/${routePath}`.replace(/\/+/g, "/");
  return joined === "" ? "/" : joined.startsWith("/") ? joined : `/${joined}`;
}

function looksLikeDynamicPathSegment(segment: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
    (segment.length >= 20 && /^[A-Za-z0-9._~-]+$/.test(segment))
  );
}

function redactPathname(pathname: string) {
  const segments = pathname.split("/");
  return segments
    .map((segment, index) => {
      if (!segment) return segment;
      const parent = segments[index - 1]?.toLowerCase();
      if (parent && SENSITIVE_ROUTE_PARENTS.has(parent)) return ":redacted";
      return looksLikeDynamicPathSegment(segment) ? ":redacted" : segment;
    })
    .join("/");
}

/** Returns an Express route template and never includes the query string. */
export function getSafeRequestPath(req: Request): string {
  const routePath = req.route?.path;
  if (typeof routePath === "string") {
    return joinRoutePath(req.baseUrl, routePath);
  }

  if (Array.isArray(routePath)) {
    const stringRoutePath = routePath.find((path): path is string => typeof path === "string");
    if (stringRoutePath) return joinRoutePath(req.baseUrl, stringRoutePath);
  }

  const rawUrl = req.originalUrl || req.url || "/";
  try {
    return redactPathname(new URL(rawUrl, "http://localhost").pathname);
  } catch {
    return redactPathname(rawUrl.split("?", 1)[0] || "/");
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    const ms = Date.now() - start;
    logger.info("HTTP Access", {
      method: req.method,
      url: getSafeRequestPath(req),
      status: res.statusCode,
      duration_ms: ms,
      requestId: req.id,
      ip: req.ip,
    });
  });

  next();
};

export { logger };
