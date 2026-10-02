import { describe, expect, it } from "vitest";
import { activeDemoClasses, demoInviteUrl, expiryParts } from "./demo";

const NOW = Date.parse("2026-10-02T10:00:00Z");

describe("expiryParts", () => {
  it("splits the remaining time into hours and minutes", () => {
    expect(expiryParts("2026-10-02T12:30:00Z", NOW)).toEqual({ expired: false, hours: 2, minutes: 30 });
    expect(expiryParts("2026-10-02T10:45:00Z", NOW)).toEqual({ expired: false, hours: 0, minutes: 45 });
  });
  it("flags expired rooms", () => {
    expect(expiryParts("2026-10-02T10:00:00Z", NOW).expired).toBe(true);
    expect(expiryParts("2026-10-01T10:00:00Z", NOW).expired).toBe(true);
  });
});

describe("activeDemoClasses", () => {
  it("keeps only rooms that expire in the future", () => {
    const rooms = [
      { id: "a", expiresAt: "2026-10-02T09:59:00Z" },
      { id: "b", expiresAt: "2026-10-02T10:01:00Z" },
    ];
    expect(activeDemoClasses(rooms, NOW).map((r) => r.id)).toEqual(["b"]);
  });
});

it("builds invite URLs", () => {
  expect(demoInviteUrl("https://tutor.example", "abc")).toBe("https://tutor.example/invite/abc");
});
