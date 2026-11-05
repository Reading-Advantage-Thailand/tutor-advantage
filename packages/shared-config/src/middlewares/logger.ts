import winston from "winston";
import { Request, Response, NextFunction } from "express";
import { DiscordAlertTransport } from "./discordAlertTransport";
import { hashIdentifier, redactSensitiveText } from "./redact";

export { hashIdentifier, redactExternalText, redactSensitiveText } from "./redact";

const SENSITIVE_KEY_PATTERN = /(?:access|api|auth|cookie|database|password|private|refresh|secret|token|passport|nationalid|workpermit)/i;
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

// Cloud Logging reads "severity" from structured stdout; without it every
// entry lands as DEFAULT and nothing reaches Error Reporting.
const SEVERITY_BY_LEVEL: Record<string, string> = {
  error: "ERROR",
  warn: "WARNING",
  info: "INFO",
  http: "DEBUG",
  verbose: "DEBUG",
  debug: "DEBUG",
  silly: "DEBUG",
};

export const ERROR_REPORTING_EVENT_TYPE =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

let configuredServiceName: string | undefined;

/** Names the service in Error Reporting / alerts when K_SERVICE is not set (local runs). */
export function setLogServiceName(serviceName: string) {
  configuredServiceName = serviceName;
}

export function getLogServiceContext(): { service: string; version: string } {
  return {
    service:
      process.env.K_SERVICE ||
      configuredServiceName ||
      process.env.npm_package_name ||
      "tutor-advantage",
    version: process.env.K_REVISION || "local",
  };
}

function stackOf(value: unknown): string | undefined {
  if (value instanceof Error) return value.stack;
  if (value && typeof value === "object") {
    const candidate = value as { name?: unknown; message?: unknown; stack?: unknown };
    if (
      typeof candidate.stack === "string" &&
      candidate.stack &&
      (typeof candidate.message === "string" || typeof candidate.name === "string")
    ) {
      return candidate.stack;
    }
  }
  return undefined;
}

/** Finds a stack trace on a log entry: winston's own `stack`, or any Error-like metadata value. */
function findStackTrace(info: Record<string, unknown>): string | undefined {
  if (typeof info.stack === "string" && info.stack) return info.stack;
  for (const value of Object.values(info)) {
    const stack = stackOf(value);
    if (stack) return stack;
  }
  return undefined;
}

/**
 * Adds Cloud Logging severity and, for errors, the fields Error Reporting
 * needs. Runs after redaction so stack traces are already scrubbed.
 */
export const cloudLoggingFormat = winston.format((info) => {
  const entry = info as unknown as Record<string, unknown>;
  entry.severity = SEVERITY_BY_LEVEL[info.level] ?? "DEFAULT";
  if (info.level === "error") {
    entry["@type"] = ERROR_REPORTING_EVENT_TYPE;
    entry.serviceContext = getLogServiceContext();
    const stack = findStackTrace(entry);
    if (stack) entry.stack_trace = stack;
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    cloudLoggingFormat(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

let discordAlertTransport: DiscordAlertTransport | undefined;

/**
 * Mirrors error logs to Discord when DISCORD_WEBHOOK_URL is set (never under
 * tests). Idempotent; call again after dotenv has loaded a local .env.
 */
export function enableDiscordAlerts(): boolean {
  if (discordAlertTransport) return true;
  if (!process.env.DISCORD_WEBHOOK_URL || process.env.NODE_ENV === "test") return false;
  discordAlertTransport = new DiscordAlertTransport();
  logger.add(discordAlertTransport);
  return true;
}

enableDiscordAlerts();

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
