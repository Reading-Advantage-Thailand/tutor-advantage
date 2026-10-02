import { describe, expect, it } from "vitest";
import { DEFAULT_LOGIN_REDIRECT, getSafeRedirect } from "./loginRedirect";

describe("getSafeRedirect", () => {
  it("keeps same-origin paths with their query", () => {
    expect(getSafeRedirect("?redirect=/classes/abc")).toBe("/classes/abc");
    expect(getSafeRedirect("?redirect=%2Fpayment%3FclassId%3D1%26cycleId%3D2")).toBe("/payment?classId=1&cycleId=2");
  });

  it("defaults to /dashboard", () => {
    expect(DEFAULT_LOGIN_REDIRECT).toBe("/dashboard");
    expect(getSafeRedirect("")).toBe("/dashboard");
    expect(getSafeRedirect(null)).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=")).toBe("/dashboard");
    expect(getSafeRedirect("?other=1")).toBe("/dashboard");
  });

  it("rejects open redirects", () => {
    expect(getSafeRedirect("?redirect=//evil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=https://evil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=dashboard")).toBe("/dashboard");
  });

  it("rejects paths that URL parsing turns into another origin", () => {
    // Tab/newline are stripped and "\" means "/", so these become //evil.example.
    expect(getSafeRedirect("?redirect=/%09/evil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=/%0A/evil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=%5C%5Cevil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=/%5C%5Cevil.example")).toBe("/dashboard");
    expect(getSafeRedirect("?redirect=/%5Cevil.example")).toBe("/dashboard");
    // …while ordinary in-app paths (with their query) still pass through unchanged.
    expect(getSafeRedirect("?redirect=%2Fpayment%3FclassId%3Dabc%26referralToken%3Dxyz")).toBe(
      "/payment?classId=abc&referralToken=xyz",
    );
  });
});
