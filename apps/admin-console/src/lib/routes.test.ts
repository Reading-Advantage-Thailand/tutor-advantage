import { describe, expect, it } from "vitest";
import { ADMIN_ROUTES, decideAccess, findRoute, routesForRole } from "./routes";

describe("admin route map", () => {
  it("picks the most specific route", () => {
    expect(findRoute("/dev/database")?.id).toBe("devDatabase");
    expect(findRoute("/dev/ui-kit/")?.id).toBe("uiKit");
    expect(findRoute("/users/5eed")?.id).toBe("users");
    expect(findRoute("/")?.id).toBe("overview");
    expect(findRoute("/settlementsX")).toBeNull();
  });

  it("decides access per role", () => {
    const dev = { devRoutes: true };
    expect(decideAccess("/login", null, dev)).toBe("allow");
    expect(decideAccess("/settlements", null, dev)).toBe("login");
    expect(decideAccess("/settlements", "TUTOR", dev)).toBe("forbidden");
    expect(decideAccess("/settlements", "FINANCE_CHECKER", dev)).toBe("allow");
    expect(decideAccess("/users", "FINANCE_CHECKER", dev)).toBe("forbidden");
    expect(decideAccess("/unknown", "FINANCE_CHECKER", dev)).toBe("forbidden");
    expect(decideAccess("/unknown", "ADMIN", dev)).toBe("allow");
    expect(decideAccess("/dev", "ADMIN", { devRoutes: false })).toBe("not-found");
  });

  it("navigation for a role equals what the middleware allows", () => {
    for (const role of ["ADMIN", "FINANCE_CHECKER"] as const) {
      const nav = routesForRole(role, { devRoutes: true }).map((r) => r.href);
      for (const route of ADMIN_ROUTES) {
        const allowed = decideAccess(route.href, role, { devRoutes: true }) === "allow";
        expect(nav.includes(route.href), `${role} ${route.href}`).toBe(allowed);
      }
    }
    expect(routesForRole("ADMIN", { devRoutes: false }).some((r) => r.devOnly)).toBe(false);
    expect(routesForRole("TUTOR", { devRoutes: true })).toEqual([]);
  });
});
