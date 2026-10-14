/**
 * THE role → route map of the admin console. Pure data + helpers (no React,
 * no icons) so it runs in the Edge middleware, the server layout, the
 * client shell (navigation) and unit tests alike.
 *
 * - Middleware: every non-public page path must match a route here and the
 *   signed-in role must be in `roles`; otherwise → /unauthorized.
 * - Navigation (components/app/navigation.ts) adds labels/icons by `id`;
 *   items whose roles exclude the user are not rendered.
 * - Unknown paths fall back to {@link DEFAULT_ROLES} (ADMIN only): a new page
 *   is invisible to FINANCE_CHECKER until it is added here on purpose.
 *
 * Adding a page? Add (or reuse) an entry here. Longest prefix wins.
 */

export const ADMIN_ROLES = ["ADMIN", "FINANCE_CHECKER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ISSUER = "admin-console";
export const ADMIN_AUDIENCE = "tutor-advantage-admin";

export type NavGroup = "finance" | "operations" | "users" | "settings" | "dev";

/** Keys of `workQueues` in GET /v1/admin/overview used for nav badges. */
export type NavBadgeKey = "settlements" | "adjustments" | "verifications" | "exceptions" | "fraudFlags";

export interface AdminRoute {
  id: string;
  /** Path prefix (exact for "/"). */
  href: string;
  roles: readonly AdminRole[];
  group: NavGroup;
  /** Hidden from navigation (still guarded). */
  hidden?: boolean;
  /** Only exists when dev routes are enabled (ENABLE_DEV_ROUTES=true, non-production). */
  devOnly?: boolean;
  /** Mobile bottom-bar slot (max 3 + "more"). */
  tab?: boolean;
  badge?: NavBadgeKey;
}

const BOTH: readonly AdminRole[] = ["ADMIN", "FINANCE_CHECKER"];
const ADMIN: readonly AdminRole[] = ["ADMIN"];

export const DEFAULT_ROLES: readonly AdminRole[] = ADMIN;

export const ADMIN_ROUTES: readonly AdminRoute[] = [
  { id: "overview", href: "/", roles: BOTH, group: "finance", tab: true },
  { id: "reconciliation", href: "/reconciliation", roles: BOTH, group: "finance" },
  { id: "settlements", href: "/settlements", roles: BOTH, group: "finance", tab: true, badge: "settlements" },
  { id: "adjustments", href: "/adjustments", roles: BOTH, group: "finance", badge: "adjustments" },
  { id: "audit", href: "/audit", roles: BOTH, group: "finance" },
  { id: "exceptions", href: "/operations/exceptions", roles: BOTH, group: "operations", tab: true, badge: "exceptions" },
  { id: "fraud", href: "/fraud", roles: BOTH, group: "operations", badge: "fraudFlags" },
  { id: "users", href: "/users", roles: ADMIN, group: "users", badge: "verifications" },
  { id: "coupons", href: "/coupons", roles: ADMIN, group: "users" },
  { id: "voice", href: "/voice-operations", roles: ADMIN, group: "users" },
  { id: "roles", href: "/settings/roles", roles: ADMIN, group: "settings" },
  { id: "docs", href: "/docs", roles: BOTH, group: "settings" },
  { id: "dev", href: "/dev", roles: ADMIN, group: "dev", devOnly: true },
  { id: "devDatabase", href: "/dev/database", roles: ADMIN, group: "dev", devOnly: true },
  { id: "uiKit", href: "/dev/ui-kit", roles: ADMIN, group: "dev", devOnly: true },
];

/** Pages reachable without a session. */
export const PUBLIC_PATHS = ["/login", "/unauthorized"] as const;

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesPrefix(path: string, prefix: string): boolean {
  if (prefix === "/") return path === "/";
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (PUBLIC_PATHS as readonly string[]).some((p) => matchesPrefix(path, p));
}

/** The most specific route for a path (longest prefix), or null. */
export function findRoute(pathname: string): AdminRoute | null {
  const path = normalizePath(pathname);
  let best: AdminRoute | null = null;
  for (const route of ADMIN_ROUTES) {
    if (!matchesPrefix(path, route.href)) continue;
    if (!best || route.href.length > best.href.length) best = route;
  }
  return best;
}

/** True for paths that only exist when dev routes are enabled. */
export function isDevPath(pathname: string): boolean {
  return Boolean(findRoute(pathname)?.devOnly);
}

export function rolesForPath(pathname: string): readonly AdminRole[] {
  return findRoute(pathname)?.roles ?? DEFAULT_ROLES;
}

export type AccessDecision = "allow" | "login" | "forbidden" | "not-found";

/**
 * Access decision for a page path. `role` is the verified JWT role (or null
 * when there is no valid admin session).
 */
export function decideAccess(
  pathname: string,
  role: string | null | undefined,
  { devRoutes }: { devRoutes: boolean },
): AccessDecision {
  if (isPublicPath(pathname)) return "allow";
  if (isDevPath(pathname) && !devRoutes) return "not-found";
  if (!isAdminRole(role)) return role ? "forbidden" : "login";
  return rolesForPath(pathname).includes(role) ? "allow" : "forbidden";
}

/** Routes the role may see in navigation. */
export function routesForRole(role: string | null | undefined, { devRoutes }: { devRoutes: boolean }): AdminRoute[] {
  if (!isAdminRole(role)) return [];
  return ADMIN_ROUTES.filter((route) => !route.hidden && (!route.devOnly || devRoutes) && route.roles.includes(role));
}
