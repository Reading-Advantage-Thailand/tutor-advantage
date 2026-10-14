/**
 * Session + environment security helpers shared by the middleware (Edge),
 * route handlers and the server layout. Edge-safe: `jose` only, no Node APIs,
 * relative imports only (also loaded by vitest).
 *
 * Admin session = JWT in the httpOnly `admin_token` cookie, HS256 with the
 * shared JWT_SECRET, issued ONLY by this app (dev-login / Google callback) with
 * `iss = "admin-console"`, `aud = "tutor-advantage-admin"` and an ADMIN or
 * FINANCE_CHECKER role. Tutor/student session tokens are signed with the same
 * secret, so the issuer + audience + role checks are what keep them out.
 * The backend still re-reads the user's role from the DB on every call.
 */
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";
import { ADMIN_AUDIENCE, ADMIN_ISSUER, isAdminRole, type AdminRole } from "./routes";

const DEV_SECRET = "secret-for-dev-only-change-me";

/** Session lifetime (seconds). */
export const ADMIN_SESSION_TTL = 60 * 60 * 12;

export const ADMIN_TOKEN_COOKIE = "admin_token";

/**
 * Every cookie the admin console sets. Logout and invalid-session handling
 * clear all of them (S-3).
 */
export const ADMIN_COOKIES = [
  "admin_token",
  "admin_role",
  "admin_email",
  "admin_name",
  "admin_picture",
  "admin_user_id",
  "oauth_state",
  "pkce_verifier",
] as const;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    (!secret || secret === DEV_SECRET || secret.length < 32)
  ) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  return secret || DEV_SECRET;
}

/**
 * Dev-only tooling (dev login, /dev pages, /api/dev/*, DevToolbar, /dev/ui-kit)
 * is OPT-IN: it requires ENABLE_DEV_ROUTES=true AND a non-production NODE_ENV.
 * A staging deploy that forgets the variable gets no dev tools.
 */
export function devRoutesEnabled(env: Record<string, string | undefined> = process.env) {
  if (env.NODE_ENV === "production") return false;
  return env.ENABLE_DEV_ROUTES === "true";
}

/** Deployment label for the shell's environment pill. */
export type AppEnvironment = "development" | "staging" | "production";

export function getAppEnvironment(env: Record<string, string | undefined> = process.env): AppEnvironment {
  const explicit = (env.APP_ENV || env.NEXT_PUBLIC_APP_ENV || "").toLowerCase();
  if (explicit === "production" || explicit === "prod") return "production";
  if (explicit === "staging" || explicit === "preview" || explicit === "test") return "staging";
  if (explicit === "development" || explicit === "dev" || explicit === "local") return "development";
  return env.NODE_ENV === "production" ? "production" : "development";
}

export interface AdminSession {
  userId: string;
  role: AdminRole;
  email: string | null;
  name: string | null;
}

const secretKey = () => new TextEncoder().encode(getJwtSecret());

/** Sign an admin-console session token (dev login + Google callback). */
export async function signAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({
    userId: session.userId,
    role: session.role,
    email: session.email ?? undefined,
    name: session.name ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.userId)
    .setIssuer(ADMIN_ISSUER)
    .setAudience(ADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL}s`)
    .sign(secretKey());
}

/**
 * Verify signature (HS256 only), expiry, issuer, audience and role.
 * Returns null for anything that is not a valid admin-console session.
 */
export async function verifyAdminToken(token: string | null | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ADMIN_ISSUER,
      audience: ADMIN_AUDIENCE,
      requiredClaims: ["exp", "iat"],
    });
    const userId = typeof payload.userId === "string" ? payload.userId : payload.sub;
    if (!userId || !isAdminRole(payload.role)) return null;
    return {
      userId,
      role: payload.role,
      email: typeof payload.email === "string" ? payload.email : null,
      name: typeof payload.name === "string" ? payload.name : null,
    };
  } catch {
    return null;
  }
}

/** Cookie options for admin cookies. httpOnly only for the token. */
export function adminCookieOptions(httpOnly: boolean, maxAge = ADMIN_SESSION_TTL) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

type CookieWriter = { cookies: { set: (name: string, value: string, options: ReturnType<typeof adminCookieOptions>) => unknown } };

/** Expire every admin cookie on a response. */
export function clearAdminCookies(response: CookieWriter) {
  for (const name of ADMIN_COOKIES) {
    response.cookies.set(name, "", adminCookieOptions(name === "admin_token" || name === "oauth_state" || name === "pkce_verifier", 0));
  }
}

/** Set the session token + the non-secret display cookies after login. */
export async function setAdminSessionCookies(
  response: CookieWriter,
  session: AdminSession & { picture?: string | null },
) {
  const token = await signAdminToken(session);
  response.cookies.set("admin_token", token, adminCookieOptions(true));
  // Display-only hints for client code (never trusted for authorization).
  response.cookies.set("admin_role", session.role, adminCookieOptions(false));
  response.cookies.set("admin_user_id", session.userId, adminCookieOptions(false));
  if (session.email) response.cookies.set("admin_email", session.email, adminCookieOptions(false));
  if (session.name) response.cookies.set("admin_name", session.name, adminCookieOptions(false));
  response.cookies.set("admin_picture", session.picture ?? "", adminCookieOptions(false));
}
