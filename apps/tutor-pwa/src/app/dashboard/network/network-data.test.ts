import { describe, expect, it } from "vitest";
import {
  estimatePayoutBreakdown,
  flattenTree,
  hasDownline,
  periodMonthToDate,
  shortInviteLabel,
  type NetworkTreeNode,
} from "./network-data";
import { layoutTree, NODE_HEIGHT } from "./network-layout";

function node(id: string, children: NetworkTreeNode[] = []): NetworkTreeNode {
  return {
    userId: id,
    displayName: id,
    email: null,
    sponsorLockedAt: null,
    joinedAt: "2026-01-01",
    personalVolumeTHB: 0,
    groupVolumeTHB: 0,
    currentRate: 0.4,
    estimatedPayoutTHB: 0,
    children,
  };
}

describe("estimatePayoutBreakdown", () => {
  it("withholds 3% (rounded) from positive payouts", () => {
    expect(estimatePayoutBreakdown(1000)).toEqual({ wht: 30, net: 970 });
    expect(estimatePayoutBreakdown(1234)).toEqual({ wht: 37, net: 1197 });
  });
  it("withholds nothing from zero", () => {
    expect(estimatePayoutBreakdown(0)).toEqual({ wht: 0, net: 0 });
  });
});

describe("hasDownline", () => {
  it("needs at least one child", () => {
    expect(hasDownline(null)).toBe(false);
    expect(hasDownline(node("me"))).toBe(false);
    expect(hasDownline(node("me", [node("a")]))).toBe(true);
  });
});

describe("periodMonthToDate", () => {
  it("accepts YYYY-MM only", () => {
    expect(periodMonthToDate("2026-10")).toBe("2026-10-01T12:00:00+07:00");
    expect(periodMonthToDate("")).toBeNull();
    expect(periodMonthToDate("October")).toBeNull();
  });
});

describe("shortInviteLabel", () => {
  it("drops the scheme and truncates", () => {
    expect(shortInviteLabel("https://tutor.example.com/join?ref=abc")).toBe("tutor.example.com/join?ref=abc");
    const long = shortInviteLabel("https://tutor.example.com/join?ref=abcdefghijklmnopqrstuvwxyz", 20);
    expect(long).toHaveLength(20);
    expect(long.endsWith("…")).toBe(true);
  });
});

describe("flattenTree + layoutTree", () => {
  const tree = node("me", [node("a", [node("a1")]), node("b")]);

  it("flattens nodes and parent → child edges", () => {
    const { nodes, edges } = flattenTree(tree);
    expect(nodes.map((n) => n.id)).toEqual(["me", "a", "a1", "b"]);
    expect(nodes[0]).toMatchObject({ isRoot: true, hasChildren: true });
    expect(nodes.find((n) => n.id === "b")).toMatchObject({ isRoot: false, hasChildren: false });
    expect(edges).toEqual([
      { id: "e-me-a", source: "me", target: "a" },
      { id: "e-a-a1", source: "a", target: "a1" },
      { id: "e-me-b", source: "me", target: "b" },
    ]);
    expect("children" in nodes[0].tutor).toBe(false);
  });

  it("ignores repeated ids", () => {
    const dup = node("me", [node("a"), node("a")]);
    expect(flattenTree(dup).nodes).toHaveLength(2);
  });

  it("lays children out below their parent", () => {
    const { nodes, edges } = flattenTree(tree);
    const placed = layoutTree(nodes, edges);
    const y = Object.fromEntries(placed.map((p) => [p.id, p.y]));
    expect(y.a).toBeGreaterThanOrEqual(y.me + NODE_HEIGHT);
    expect(y.a1).toBeGreaterThan(y.a);
    expect(y.a).toBe(y.b);
  });
});
