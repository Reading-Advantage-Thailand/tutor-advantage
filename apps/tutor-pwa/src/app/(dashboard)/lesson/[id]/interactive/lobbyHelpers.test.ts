import { describe, expect, it } from "vitest";
import { formatLobbyNotificationFailure, getArticleCoverUrl, getArticleSummary, getCefrLabel } from "./lobbyHelpers";

describe("lobby helpers", () => {
  it("prefers the first image url, then the GCS cover for the article id", () => {
    expect(getArticleCoverUrl({ id: "a1", image_urls: ["", "https://x/y.png"] })).toBe("https://x/y.png");
    expect(getArticleCoverUrl({ id: "a1" })).toMatch(/\/images\/a1\.png$/);
    expect(getArticleCoverUrl(null)).toBeNull();
  });

  it("uses the Thai summary before plain text", () => {
    expect(getArticleSummary({ translated_summary: { th: ["สรุป"] }, summary: "en" })).toBe("สรุป");
    expect(getArticleSummary({ summary: { th: ["ไทย"] } })).toBe("ไทย");
    expect(getArticleSummary({ summary: "plain" })).toBe("plain");
    expect(getArticleSummary({ description: "desc" })).toBe("desc");
    expect(getArticleSummary(undefined)).toBe("");
  });

  it("normalises the CEFR label", () => {
    expect(getCefrLabel({ cefr_level: "CEFR A2" })).toBe("A2");
    expect(getCefrLabel({ content_provider: "PRIMARY_ADVANTAGE" })).toBe("Elementary");
    expect(getCefrLabel({})).toBeNull();
  });

  it("explains LINE failures in Thai", () => {
    expect(formatLobbyNotificationFailure({ LINE_NOT_LINKED: 3 })).toContain("3 คน");
    expect(formatLobbyNotificationFailure({ LINE_API_429: 1 })).toContain("HTTP 429");
    expect(formatLobbyNotificationFailure()).toContain("ยังส่ง LINE ไม่ได้");
  });
});
