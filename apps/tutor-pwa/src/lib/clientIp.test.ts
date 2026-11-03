import { describe, expect, it } from "vitest";
import { forwardedClientIp, signClientIp as serviceSignClientIp } from "../../../../packages/shared-config/src/clientIp";
import { requestClientIp, signClientIp, signedClientIpHeaders } from "./clientIp";

const SECRET = "test-jwt-secret-at-least-32-characters";

describe("signedClientIpHeaders", () => {
  it("forwards the last X-Forwarded-For entry, which Cloud Run appends", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" });
    expect(requestClientIp(headers)).toBe("203.0.113.7");
  });

  it("signs exactly as identity-service verifies", () => {
    expect(signClientIp("203.0.113.7", SECRET)).toBe(serviceSignClientIp("203.0.113.7", SECRET));
    const forwarded = signedClientIpHeaders(new Headers({ "x-forwarded-for": "203.0.113.7" }), SECRET);
    expect(forwardedClientIp(forwarded, SECRET)).toBe("203.0.113.7");
  });

  it("sends nothing without a client IP or a secret", () => {
    expect(signedClientIpHeaders(new Headers(), SECRET)).toEqual({});
    expect(signedClientIpHeaders(new Headers({ "x-forwarded-for": "203.0.113.7" }), "")).toEqual({});
  });
});
