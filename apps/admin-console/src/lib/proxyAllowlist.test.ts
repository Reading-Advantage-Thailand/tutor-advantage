import { describe, expect, it } from "vitest";
import { matchProxyRequest, sanitizeIdempotencyKey } from "./proxyAllowlist";

const admin = { role: "ADMIN" as const, devRoutes: false };
const checker = { role: "FINANCE_CHECKER" as const, devRoutes: false };
const seg = (path: string) => path.split("/").filter(Boolean);

describe("proxy allowlist", () => {
  it("allows the endpoints the console uses, routed to the right service", () => {
    const cases: [string, string, string][] = [
      ["GET", "/v1/admin/overview", "finance"],
      ["GET", "/v1/audit-logs", "finance"],
      ["GET", "/v1/audit-logs/export", "finance"],
      ["GET", "/v1/settlements", "finance"],
      ["POST", "/v1/settlements/preview", "finance"],
      ["POST", "/v1/settlements/5eed0000-0000-4000-8000-000000000a01/approve", "finance"],
      ["GET", "/v1/settlements/5eed0000-0000-4000-8000-000000000a01/export", "finance"],
      ["POST", "/v1/settlements/abc/lines/def/sync-transfer", "finance"],
      ["POST", "/v1/adjustments/abc/reject", "finance"],
      ["POST", "/v1/operations/exceptions/abc/resolve", "finance"],
      ["POST", "/v1/reconciliation/payments/abc/activate", "finance"],
      ["POST", "/v1/reconciliation/payments/abc/verify", "finance"],
      ["GET", "/v1/reconciliation/orphan-events", "finance"],
      ["GET", "/v1/reconciliation/active-without-payment", "finance"],
      ["POST", "/v1/reconciliation/orphan-events/abc/dismiss", "finance"],
      ["POST", "/v1/fraud-flags/abc/action", "finance"],
      ["PATCH", "/v1/users/abc/omise-recipient", "finance"],
      ["GET", "/v1/admin/roles", "identity"],
      ["POST", "/v1/admin/roles", "identity"],
      ["GET", "/v1/admin/voice-operations", "learning"],
    ];
    for (const [method, path, service] of cases) {
      const match = matchProxyRequest(seg(path), method, admin);
      expect(match.ok, `${method} ${path}`).toBe(true);
      if (match.ok) {
        expect(match.rule.service).toBe(service);
        expect(match.path).toBe(path);
      }
    }
  });

  it("rejects tutor/student/payment endpoints and unknown paths with 403", () => {
    for (const path of [
      "/v1/payments/intent",
      "/v1/tutors/earnings/summary",
      "/v1/classes",
      "/v1/users/me",
      "/v1/auth/login",
      "/v1/internal/settlement/auto-run",
      "/v1/settlements/abc/delete",
      "/v1/operations/exceptions/abc/ANYTHING",
      "/v1/operations/exceptions/abc/FORCE_ACTIVE",
      "/v1/reconciliation/payments/abc/refund",
      "/v1/admin",
      "/health",
    ]) {
      const match = matchProxyRequest(seg(path), "POST", admin);
      expect(match.ok, path).toBe(false);
      if (!match.ok && path !== "/v1/users/me") expect(match.status, path).toBe(403);
    }
  });

  it("rejects disallowed methods with 405", () => {
    const match = matchProxyRequest(seg("/v1/settlements"), "DELETE", admin);
    expect(match).toMatchObject({ ok: false, status: 405, code: "PROXY_METHOD_NOT_ALLOWED" });
    expect(matchProxyRequest(seg("/v1/admin/overview"), "POST", admin)).toMatchObject({ ok: false, status: 405 });
  });

  it("rejects traversal and odd segments", () => {
    for (const segments of [["v1", "..", "payments", "intent"], ["v1", "settlements", "a%2Fb"], ["v1", "settlements", "a.b", "lines"], [], ["v1", ""]]) {
      expect(matchProxyRequest(segments, "GET", admin).ok, segments.join("/")).toBe(false);
    }
  });

  it("enforces ADMIN-only endpoints for checkers", () => {
    expect(matchProxyRequest(seg("/v1/coupons"), "GET", checker)).toMatchObject({ ok: false, code: "PROXY_ROLE_NOT_ALLOWED" });
    expect(matchProxyRequest(seg("/v1/admin/roles"), "POST", checker)).toMatchObject({ ok: false, code: "PROXY_ROLE_NOT_ALLOWED" });
    expect(matchProxyRequest(seg("/v1/users/abc/suspend"), "POST", checker).ok).toBe(false);
    expect(matchProxyRequest(seg("/v1/settlements/abc/approve"), "POST", checker).ok).toBe(true);
  });

  it("allows the coupon endpoints (G5) for ADMIN only", () => {
    expect(matchProxyRequest(seg("/v1/coupons/tutors"), "GET", admin).ok).toBe(true);
    expect(matchProxyRequest(seg("/v1/coupons/5eed0000-0000-4000-8000-000000000c01"), "PATCH", admin).ok).toBe(true);
    expect(matchProxyRequest(seg("/v1/coupons/abc/void"), "POST", admin).ok).toBe(true);
    expect(matchProxyRequest(seg("/v1/coupons/abc"), "DELETE", admin)).toMatchObject({ ok: false, status: 405 });
    expect(matchProxyRequest(seg("/v1/coupons/tutors"), "GET", checker)).toMatchObject({ ok: false, code: "PROXY_ROLE_NOT_ALLOWED" });
    expect(matchProxyRequest(seg("/v1/coupons/abc"), "PATCH", checker)).toMatchObject({ ok: false, code: "PROXY_ROLE_NOT_ALLOWED" });
  });

  it("exposes dev endpoints only when dev routes are enabled", () => {
    expect(matchProxyRequest(seg("/v1/dev/actions/purge"), "POST", admin).ok).toBe(false);
    expect(matchProxyRequest(seg("/v1/dev/actions/purge"), "POST", { ...admin, devRoutes: true }).ok).toBe(true);
    expect(matchProxyRequest(seg("/v1/dev/actions/add-volume"), "POST", { ...admin, devRoutes: true }).ok).toBe(false);
  });

  it("sanitises idempotency keys", () => {
    expect(sanitizeIdempotencyKey("3b241101-e2bb-4255-8caf-4136c566a962")).toBe("3b241101-e2bb-4255-8caf-4136c566a962");
    expect(sanitizeIdempotencyKey("short")).toBeNull();
    expect(sanitizeIdempotencyKey("bad key with spaces!!")).toBeNull();
    expect(sanitizeIdempotencyKey(null)).toBeNull();
  });
});

describe("proxy allowlist: users (G4)", () => {
  it("routes user payments/audit to finance; audit is ADMIN only", () => {
    const payments = matchProxyRequest(seg("/v1/users/abc/payments"), "GET", admin);
    expect(payments.ok && payments.rule.service).toBe("finance");
    expect(matchProxyRequest(seg("/v1/users/abc/audit"), "GET", admin).ok).toBe(true);
    expect(matchProxyRequest(seg("/v1/users/abc/audit"), "GET", checker)).toMatchObject({ ok: false, code: "PROXY_ROLE_NOT_ALLOWED" });
    expect(matchProxyRequest(seg("/v1/users/abc/audit"), "POST", admin).ok).toBe(false);
  });
});
