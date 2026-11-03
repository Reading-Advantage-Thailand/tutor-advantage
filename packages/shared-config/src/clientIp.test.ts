import { describe, expect, it } from "vitest";
import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  forwardedClientIp,
  sessionTokenFromHeaders,
  signClientIp,
} from "./clientIp";

const SECRET = "test-jwt-secret-at-least-32-characters";

describe("forwardedClientIp", () => {
  it("accepts an IP signed with the shared secret", () => {
    for (const ip of ["203.0.113.7", "2001:db8::1"]) {
      const headers = { [CLIENT_IP_HEADER]: ip, [CLIENT_IP_SIGNATURE_HEADER]: signClientIp(ip, SECRET) };
      expect(forwardedClientIp(headers, SECRET)).toBe(ip);
    }
  });

  it("ignores an unsigned, mis-signed or replayed-for-another-IP header", () => {
    const signature = signClientIp("203.0.113.7", SECRET);
    expect(forwardedClientIp({ [CLIENT_IP_HEADER]: "203.0.113.7" }, SECRET)).toBeNull();
    expect(forwardedClientIp({ [CLIENT_IP_HEADER]: "203.0.113.7", [CLIENT_IP_SIGNATURE_HEADER]: "forged" }, SECRET)).toBeNull();
    expect(forwardedClientIp({ [CLIENT_IP_HEADER]: "198.51.100.9", [CLIENT_IP_SIGNATURE_HEADER]: signature }, SECRET)).toBeNull();
    expect(forwardedClientIp({ [CLIENT_IP_HEADER]: "203.0.113.7", [CLIENT_IP_SIGNATURE_HEADER]: signature }, "another-secret")).toBeNull();
  });

  it("ignores a signed value that is not an IP address", () => {
    const value = "user-123";
    expect(forwardedClientIp({ [CLIENT_IP_HEADER]: value, [CLIENT_IP_SIGNATURE_HEADER]: signClientIp(value, SECRET) }, SECRET)).toBeNull();
  });
});

describe("sessionTokenFromHeaders", () => {
  it("reads a Bearer token or either app session cookie", () => {
    expect(sessionTokenFromHeaders({ authorization: "Bearer abc" })).toBe("abc");
    expect(sessionTokenFromHeaders({ cookie: "theme=dark; student-session=s1" })).toBe("s1");
    expect(sessionTokenFromHeaders({ cookie: "tutor_session=t1" })).toBe("t1");
  });

  it("returns null when there is no usable token", () => {
    expect(sessionTokenFromHeaders({})).toBeNull();
    expect(sessionTokenFromHeaders({ authorization: "Basic abc" })).toBeNull();
    expect(sessionTokenFromHeaders({ cookie: "theme=dark" })).toBeNull();
  });
});
