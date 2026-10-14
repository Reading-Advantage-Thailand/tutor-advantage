import { describe, expect, it } from "vitest";
import { buildLobbyUrl, buildPlayUrl } from "./lessonRoutes";

describe("buildPlayUrl", () => {
  it("passes only the encoded classId", () => {
    expect(buildPlayUrl("75152a09-faff")).toBe("/interactive/play?classId=75152a09-faff");
    expect(buildPlayUrl("a b&c")).toBe("/interactive/play?classId=a%20b%26c");
  });
});

describe("buildLobbyUrl", () => {
  it("keeps UUID class ids unchanged (same URL as before)", () => {
    expect(buildLobbyUrl("75152a09-faff-47ca-aaa4-e87d6215437a")).toBe("/lesson/75152a09-faff-47ca-aaa4-e87d6215437a");
  });

  it("encodes unsafe characters", () => {
    expect(buildLobbyUrl("a/b")).toBe("/lesson/a%2Fb");
  });
});
