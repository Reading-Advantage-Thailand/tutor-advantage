import { describe, expect, it, vi } from "vitest";
import { TERMS_CONSENT_TYPE, postTermsConsent } from "./consent";

describe("postTermsConsent", () => {
  it("POSTs the TERMS_AND_PRIVACY consent to /api/auth/consent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await expect(postTermsConsent(fetchImpl)).resolves.toBe("ok");
    expect(TERMS_CONSENT_TYPE).toBe("TERMS_AND_PRIVACY");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/auth/consent");
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
    expect(JSON.parse(init.body)).toEqual({ consentType: "TERMS_AND_PRIVACY" });
  });

  it("reports a rejected request as failed", async () => {
    await expect(postTermsConsent(vi.fn().mockResolvedValue({ ok: false }))).resolves.toBe("failed");
  });

  it("reports a request that never completed as network", async () => {
    await expect(postTermsConsent(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))).resolves.toBe("network");
  });
});
