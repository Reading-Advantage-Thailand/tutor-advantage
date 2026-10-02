import { describe, expect, it } from "vitest";
import { buildConsentSummary } from "./consentSummary";

describe("buildConsentSummary", () => {
  it("reads the accepted TERMS_AND_PRIVACY record and its date", () => {
    const summary = buildConsentSummary(
      {
        user: {
          userConsents: [
            { consentType: "TERMS_AND_PRIVACY", status: "ACCEPTED", effectiveAt: "2026-05-10T03:00:00.000Z", createdAt: "2026-05-10T03:00:01.000Z" },
          ],
          requiresGuardian: false,
        },
      },
      { hasConsent: false },
    );
    expect(summary.terms).toEqual({ accepted: true, acceptedAt: "2026-05-10T03:00:00.000Z" });
  });

  it("falls back to createdAt, then null, for the date", () => {
    expect(
      buildConsentSummary({ user: { userConsents: [{ consentType: "TERMS_AND_PRIVACY", status: "ACCEPTED", createdAt: "2026-01-01" }] } }, null)
        .terms.acceptedAt,
    ).toBe("2026-01-01");
    expect(
      buildConsentSummary({ user: { userConsents: [{ consentType: "TERMS_AND_PRIVACY", status: "ACCEPTED" }] } }, null).terms,
    ).toEqual({ accepted: true, acceptedAt: null });
  });

  it("is not accepted without a matching ACCEPTED record", () => {
    expect(buildConsentSummary({ user: { userConsents: [] } }, null).terms.accepted).toBe(false);
    expect(
      buildConsentSummary({ user: { userConsents: [{ consentType: "TERMS_AND_PRIVACY", status: "REVOKED" }] } }, null).terms.accepted,
    ).toBe(false);
    expect(
      buildConsentSummary({ user: { userConsents: [{ consentType: "MARKETING", status: "ACCEPTED" }] } }, null).terms.accepted,
    ).toBe(false);
    expect(buildConsentSummary(null, null).terms).toEqual({ accepted: false, acceptedAt: null });
  });

  it("derives the guardian state", () => {
    expect(buildConsentSummary({ user: { requiresGuardian: true } }, { hasConsent: true }).guardian).toBe("granted");
    expect(buildConsentSummary({ user: { requiresGuardian: false } }, { hasConsent: true }).guardian).toBe("granted");
    expect(buildConsentSummary({ user: { requiresGuardian: true } }, { hasConsent: false }).guardian).toBe("required");
    expect(buildConsentSummary({ user: { requiresGuardian: false } }, { hasConsent: false }).guardian).toBe("notNeeded");
    expect(buildConsentSummary({ user: {} }, null).guardian).toBe("notNeeded");
  });
});
