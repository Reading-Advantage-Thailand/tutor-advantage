import { describe, expect, it } from "vitest";
import { safeMeetingUrl } from "./meetingLink";

describe("safeMeetingUrl", () => {
  it("keeps http(s) meeting links", () => {
    expect(safeMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(safeMeetingUrl("  https://zoom.us/j/123  ")).toBe("https://zoom.us/j/123");
  });

  it("ignores empty, malformed and non-web links", () => {
    expect(safeMeetingUrl("")).toBeNull();
    expect(safeMeetingUrl(undefined)).toBeNull();
    expect(safeMeetingUrl("meet.google.com/abc")).toBeNull();
    expect(safeMeetingUrl("javascript:alert(1)")).toBeNull();
  });
});
