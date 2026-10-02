/**
 * Allowlist for `/api/proxy/*` (S-5): the ONLY backend endpoints the admin
 * console may reach with the admin bearer token. Anything else → 403, so the
 * admin cookie can never drive tutor/student endpoints through this app.
 *
 * Pure module (no Next imports) so it is unit-tested.
 *
 * Template syntax:
 *  - `:name` matches one path segment of [A-Za-z0-9_-] (ids, uuids)
 *  - `(a|b)` matches exactly one of the listed literal segments
 *
 * Page groups: need a new endpoint? Append it to YOUR section below (same
 * shape, smallest method set, `roles` = what the backend enforces) and
 * mention it in your report. Never add wildcards.
 */
import type { AdminRole } from "./routes";

export type ProxyService = "finance" | "identity" | "learning";
export type ProxyMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ProxyRule {
  methods: readonly ProxyMethod[];
  path: string;
  service: ProxyService;
  /** Roles the backend allows (defence in depth; checked before forwarding). */
  roles?: readonly AdminRole[];
  /** Only when dev routes are enabled. */
  devOnly?: boolean;
}

const ADMIN: readonly AdminRole[] = ["ADMIN"];

export const PROXY_RULES: readonly ProxyRule[] = [
  // ── Shell / overview (G0, G1) ──
  { methods: ["GET"], path: "/v1/admin/overview", service: "finance" },
  { methods: ["GET"], path: "/v1/audit-logs", service: "finance" },
  { methods: ["GET"], path: "/v1/audit-logs/export", service: "finance" }, // G1: CSV export (audited)
  { methods: ["GET"], path: "/v1/admin/voice-operations", service: "learning", roles: ADMIN },

  // ── Settlements & adjustments (G2) ──
  { methods: ["GET"], path: "/v1/settlements", service: "finance" },
  { methods: ["GET"], path: "/v1/settlements/summary", service: "finance" },
  { methods: ["POST"], path: "/v1/settlements/preview", service: "finance" },
  { methods: ["POST"], path: "/v1/settlements/:id/(refresh|submit|approve|reject)", service: "finance" },
  { methods: ["GET"], path: "/v1/settlements/:id/(lines|export)", service: "finance" },
  { methods: ["POST"], path: "/v1/settlements/:id/lines/:lineId/(transfer|sync-transfer)", service: "finance" },
  { methods: ["GET", "POST"], path: "/v1/adjustments", service: "finance" },
  { methods: ["POST"], path: "/v1/adjustments/:id/(approve|reject)", service: "finance" },

  // ── Payment operations (G3) ──
  { methods: ["GET"], path: "/v1/reconciliation/payments", service: "finance" },
  { methods: ["GET"], path: "/v1/operations/exceptions", service: "finance" },
  // Exceptions: typed resolutions only (FORCE_ACTIVE/VOID_CANCEL retired, F-8).
  { methods: ["POST"], path: "/v1/operations/exceptions/:id/resolve", service: "finance" },
  { methods: ["GET"], path: "/v1/fraud-flags", service: "finance" },
  { methods: ["POST"], path: "/v1/fraud-flags/:id/action", service: "finance" },
  { methods: ["POST"], path: "/v1/reconciliation/payments/:id/(activate|verify)", service: "finance" },
  { methods: ["GET"], path: "/v1/reconciliation/(orphan-events|active-without-payment)", service: "finance" },
  { methods: ["POST"], path: "/v1/reconciliation/orphan-events/:id/(link|dismiss)", service: "finance" },

  // ── Users & roles (G4) ──
  { methods: ["GET"], path: "/v1/users", service: "finance" },
  { methods: ["GET"], path: "/v1/users/:id", service: "finance" },
  { methods: ["POST"], path: "/v1/users/:id/verify", service: "finance", roles: ADMIN },
  { methods: ["POST"], path: "/v1/users/:id/(suspend|anonymize)", service: "finance", roles: ADMIN },
  { methods: ["PATCH"], path: "/v1/users/:id/omise-recipient", service: "finance", roles: ADMIN },
  { methods: ["GET", "POST"], path: "/v1/admin/roles", service: "identity", roles: ADMIN },
  { methods: ["GET"], path: "/v1/users/:id/payments", service: "finance" },
  { methods: ["GET"], path: "/v1/users/:id/audit", service: "finance", roles: ADMIN },

  // ── Coupons (G5) ──
  { methods: ["GET", "POST"], path: "/v1/coupons", service: "finance", roles: ADMIN },
  { methods: ["POST"], path: "/v1/coupons/:id/void", service: "finance", roles: ADMIN },
  { methods: ["GET"], path: "/v1/coupons/tutors", service: "finance", roles: ADMIN },
  { methods: ["PATCH"], path: "/v1/coupons/:id", service: "finance", roles: ADMIN },

  // ── Dev tools (G5 / DevToolbar), only with ENABLE_DEV_ROUTES=true ──
  { methods: ["GET", "POST"], path: "/v1/dev/users", service: "finance", roles: ADMIN, devOnly: true },
  { methods: ["PATCH", "DELETE"], path: "/v1/dev/users/:id", service: "finance", roles: ADMIN, devOnly: true },
  { methods: ["GET"], path: "/v1/dev/state", service: "finance", roles: ADMIN, devOnly: true },
  {
    methods: ["POST"],
    path: "/v1/dev/actions/(settlement|adjustment|fraud-flag|purge)",
    service: "finance",
    roles: ADMIN,
    devOnly: true,
  },
];

const SEGMENT = "[A-Za-z0-9_-]{1,128}";

function compile(template: string): RegExp {
  const parts = template
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(":")) return SEGMENT;
      const alternatives = segment.match(/^\(([^)]+)\)$/);
      if (alternatives) {
        return `(?:${alternatives[1]
          .split("|")
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})`;
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    });
  return new RegExp(`^/${parts.join("/")}$`);
}

const COMPILED = PROXY_RULES.map((rule) => ({ rule, regex: compile(rule.path) }));

export type ProxyMatch =
  | { ok: true; rule: ProxyRule; path: string }
  | { ok: false; status: 403 | 404 | 405; code: "PROXY_PATH_NOT_ALLOWED" | "PROXY_METHOD_NOT_ALLOWED" | "PROXY_ROLE_NOT_ALLOWED" };

/**
 * Resolve proxied path segments + method against the allowlist.
 * Segments come from the catch-all route (already URL-decoded by Next).
 */
export function matchProxyRequest(
  segments: readonly string[],
  method: string,
  { role, devRoutes }: { role: AdminRole; devRoutes: boolean },
): ProxyMatch {
  // Reject anything that is not a plain segment (no "..", encoded slashes, dots, empties).
  if (segments.length === 0 || segments.some((s) => !/^[A-Za-z0-9_-]{1,128}$/.test(s))) {
    return { ok: false, status: 403, code: "PROXY_PATH_NOT_ALLOWED" };
  }
  const path = `/${segments.join("/")}`;
  const candidates = COMPILED.filter(({ rule, regex }) => regex.test(path) && (!rule.devOnly || devRoutes));
  if (candidates.length === 0) return { ok: false, status: 403, code: "PROXY_PATH_NOT_ALLOWED" };
  const upper = method.toUpperCase();
  const byMethod = candidates.find(({ rule }) => (rule.methods as readonly string[]).includes(upper));
  if (!byMethod) return { ok: false, status: 405, code: "PROXY_METHOD_NOT_ALLOWED" };
  if (byMethod.rule.roles && !byMethod.rule.roles.includes(role)) {
    return { ok: false, status: 403, code: "PROXY_ROLE_NOT_ALLOWED" };
  }
  return { ok: true, rule: byMethod.rule, path };
}

/** Idempotency keys we forward: 8–128 chars of [A-Za-z0-9_-]. */
export function sanitizeIdempotencyKey(value: string | null): string | null {
  if (!value) return null;
  return /^[A-Za-z0-9_-]{8,128}$/.test(value) ? value : null;
}
