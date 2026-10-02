import { describe, expect, it } from "vitest";
import {
  MORE_ITEMS,
  NAV_ITEMS,
  TAB_ITEMS,
  getActiveNavItem,
  getBackHref,
  getDefaultTitle,
  isMoreActive,
  isNavItemActive,
  isSectionRoot,
} from "./navigation";

const byId = (id: string) => NAV_ITEMS.find((item) => item.id === id)!;

describe("navigation config", () => {
  it("has 4 tab items (+ more) that include schedule, and the rest in the more sheet", () => {
    expect(TAB_ITEMS.map((item) => item.id)).toEqual(["home", "classes", "schedule", "chat"]);
    expect(MORE_ITEMS.map((item) => item.id)).toEqual(["demo", "earnings", "network", "performance", "settings"]);
    expect(new Set(NAV_ITEMS.map((item) => item.href)).size).toBe(NAV_ITEMS.length);
  });
});

describe("isNavItemActive / getActiveNavItem", () => {
  it("matches home only exactly", () => {
    expect(isNavItemActive(byId("home"), "/dashboard")).toBe(true);
    expect(isNavItemActive(byId("home"), "/dashboard/")).toBe(true);
    expect(isNavItemActive(byId("home"), "/dashboard/classes")).toBe(false);
  });

  it("matches sections by path segment, not string prefix", () => {
    expect(isNavItemActive(byId("chat"), "/dashboard/chat/abc")).toBe(true);
    expect(isNavItemActive(byId("chat"), "/dashboard/chatter")).toBe(false);
    expect(getActiveNavItem("/dashboard/classes/auction?x=1")?.id).toBe("classes");
  });

  it("treats lesson routes as part of classes", () => {
    expect(getActiveNavItem("/lesson/123/select")?.id).toBe("classes");
  });

  it("flags the more tab for secondary sections", () => {
    expect(isMoreActive("/dashboard/earnings")).toBe(true);
    expect(isMoreActive("/dashboard/schedule")).toBe(false);
  });
});

describe("app bar helpers", () => {
  it("knows section roots and back targets", () => {
    expect(isSectionRoot("/dashboard/classes")).toBe(true);
    expect(isSectionRoot("/dashboard/classes/new")).toBe(false);
    expect(getBackHref("/dashboard/classes")).toBeNull();
    expect(getBackHref("/dashboard")).toBeNull();
    expect(getBackHref("/dashboard/classes/123")).toBe("/dashboard/classes");
    expect(getBackHref("/dashboard/chat/abc/")).toBe("/dashboard/chat");
  });

  it("uses the section label as default title", () => {
    expect(getDefaultTitle("/dashboard/classes/123")).toBe(byId("classes").label);
    expect(getDefaultTitle("/somewhere")).toBe("Tutor Advantage");
  });
});
