const DEVELOPMENT_JWT_SECRET = "secret-for-dev-only-change-me";

type SecurityEnvironment = Record<string, string | undefined>;

export function getJwtSecret(
  env: SecurityEnvironment = process.env,
): string {
  const value = env.JWT_SECRET?.trim();
  if (env.NODE_ENV === "production") {
    if (!value || value === DEVELOPMENT_JWT_SECRET || value.length < 32) {
      throw new Error(
        "JWT_SECRET must be set to at least 32 characters in production",
      );
    }
  }
  return value || DEVELOPMENT_JWT_SECRET;
}

/**
 * Express "trust proxy" value. Cloud Run's front end is one proxy hop that
 * appends the caller's IP to X-Forwarded-For; without trusting it every
 * request seems to come from the same address and all users share one
 * rate-limit bucket. TRUST_PROXY overrides it ("false", a hop count, or a
 * list of addresses).
 */
export function trustProxySetting(
  env: SecurityEnvironment = process.env,
): boolean | number | string {
  const value = env.TRUST_PROXY?.trim();
  if (!value || value === "true") return 1;
  if (value === "false") return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

export function getAllowedOrigins(
  env: SecurityEnvironment = process.env,
): string[] {
  const configured = env.ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("ALLOWED_ORIGINS must be set in production");
  }
  return [
    "http://localhost:3000",
    "http://localhost:3004",
    "http://localhost:3005",
    "http://localhost:3006",
  ];
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  env: SecurityEnvironment = process.env,
): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (
    env.NODE_ENV !== "production" &&
    env.ALLOW_NGROK_ORIGINS === "true"
  ) {
    return /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.io)$/i.test(
      origin,
    );
  }
  return false;
}

export function areDevRoutesEnabled(
  env: SecurityEnvironment = process.env,
): boolean {
  return (
    env.NODE_ENV !== "production" && env.ENABLE_DEV_ROUTES === "true"
  );
}

export function assertProductionSecurityConfig(
  env: SecurityEnvironment = process.env,
  options: { requireOmiseWebhookSecret?: boolean } = {},
) {
  if (env.NODE_ENV !== "production") return;
  getJwtSecret(env);
  getAllowedOrigins(env);
  if (options.requireOmiseWebhookSecret && !env.OMISE_WEBHOOK_SECRET?.trim()) {
    throw new Error("OMISE_WEBHOOK_SECRET must be set in production");
  }
}
