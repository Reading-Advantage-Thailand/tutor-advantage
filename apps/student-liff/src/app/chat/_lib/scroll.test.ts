import { describe, expect, it } from "vitest";
import { decideAutoScroll, distanceFromBottom, isNearBottom } from "./scroll";

describe("isNearBottom", () => {
  it("measures the distance to the bottom", () => {
    expect(distanceFromBottom({ scrollHeight: 1000, scrollTop: 600, clientHeight: 300 })).toBe(100);
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 600, clientHeight: 300 })).toBe(false);
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 640, clientHeight: 300 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 200, scrollTop: 0, clientHeight: 300 })).toBe(true);
  });
});

describe("decideAutoScroll", () => {
  const base = {
    previousLastId: "1",
    nextLastId: "2",
    nextLastIsOwn: false,
    nearBottom: false,
    hasInitialScroll: true,
  };

  it("jumps (no animation) the first time messages appear", () => {
    expect(decideAutoScroll({ ...base, previousLastId: null, hasInitialScroll: false })).toBe("jump");
  });

  it("does nothing for an empty room or an unchanged last message (no-op poll)", () => {
    expect(decideAutoScroll({ ...base, nextLastId: null, hasInitialScroll: false })).toBe("none");
    expect(decideAutoScroll({ ...base, nextLastId: "1", nearBottom: true })).toBe("none");
  });

  it("follows new messages when the student is at the bottom or sent it", () => {
    expect(decideAutoScroll({ ...base, nearBottom: true })).toBe("smooth");
    expect(decideAutoScroll({ ...base, nextLastIsOwn: true })).toBe("smooth");
  });

  it("only shows the pill when the student is reading older messages", () => {
    expect(decideAutoScroll(base)).toBe("indicate");
  });
});
