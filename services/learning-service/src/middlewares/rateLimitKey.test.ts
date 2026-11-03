import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { CLIENT_IP_HEADER, CLIENT_IP_SIGNATURE_HEADER, getJwtSecret, signClientIp } from "@tutor-advantage/shared-config";
import { learningRateLimitKey } from "./rateLimitKey";

// Every request below arrives from the same proxy address, like student-liff's.
const PROXY_IP = "34.87.0.10";
const request = (headers: Record<string, string>) => ({ headers, ip: PROXY_IP }) as never;

describe("learningRateLimitKey", () => {
  it("gives each signed-in student their own bucket, from a Bearer token or the session cookie", () => {
    const first = jwt.sign({ userId: "student-1", role: "STUDENT" }, getJwtSecret());
    const second = jwt.sign({ userId: "student-2", role: "STUDENT" }, getJwtSecret());
    expect(learningRateLimitKey(request({ authorization: `Bearer ${first}` }))).toBe("user:student-1");
    expect(learningRateLimitKey(request({ cookie: `student-session=${second}` }))).toBe("user:student-2");
  });

  it("counts a forged or expired token by IP, not as the user it names", () => {
    const forged = jwt.sign({ userId: "student-1" }, "not-our-secret");
    const expired = jwt.sign({ userId: "student-1", exp: Math.floor(Date.now() / 1000) - 60 }, getJwtSecret());
    expect(learningRateLimitKey(request({ authorization: `Bearer ${forged}` }))).toBe(`ip:${PROXY_IP}`);
    expect(learningRateLimitKey(request({ cookie: `student-session=${expired}` }))).toBe(`ip:${PROXY_IP}`);
  });

  it("uses the client IP an app forwarded only when it is signed", () => {
    const ip = "203.0.113.7";
    expect(learningRateLimitKey(request({
      [CLIENT_IP_HEADER]: ip,
      [CLIENT_IP_SIGNATURE_HEADER]: signClientIp(ip, getJwtSecret()),
    }))).toBe(`ip:${ip}`);
    expect(learningRateLimitKey(request({ [CLIENT_IP_HEADER]: ip }))).toBe(`ip:${PROXY_IP}`);
  });
});
