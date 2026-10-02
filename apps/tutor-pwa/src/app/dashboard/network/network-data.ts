/**
 * Types and pure helpers for the MLM network page (tested in network-data.test.ts).
 * No React / xyflow imports here so the server page can use it without pulling
 * the graph libraries into its bundle.
 */

export type TutorSummary = {
  userId: string;
  displayName: string;
  email: string | null;
  sponsorLockedAt: string | null;
  joinedAt: string;
  personalVolumeTHB: number;
  groupVolumeTHB: number;
  currentRate: number;
  estimatedPayoutTHB: number;
  totalDownlines?: number;
};

export type NetworkTreeNode = TutorSummary & {
  children: NetworkTreeNode[];
};

export type NetworkSummary = {
  directDownlines: number;
  totalDownlines: number;
  activeDownlines: number;
  personalVolumeTHB: number;
  groupVolumeTHB: number;
  currentRate: number;
  estimatedPayoutTHB: number;
  badgeBonusTHB?: number;
  level1Count: number;
  level2PlusCount: number;
};

export type NetworkResponse = {
  periodMonth: string;
  inviteUrl: string;
  sponsor: TutorSummary | null;
  upline: TutorSummary[];
  networkTree: NetworkTreeNode;
  summary: NetworkSummary;
  downlines: TutorSummary[];
};

export const EMPTY_NETWORK_SUMMARY: NetworkSummary = {
  directDownlines: 0,
  totalDownlines: 0,
  activeDownlines: 0,
  personalVolumeTHB: 0,
  groupVolumeTHB: 0,
  currentRate: 0,
  estimatedPayoutTHB: 0,
  badgeBonusTHB: 0,
  level1Count: 0,
  level2PlusCount: 0,
};

/** Withholding tax applied to network payouts (estimate shown to the tutor). */
export const WHT_RATE = 0.03;

/** Estimated 3% withholding and net payout (same rounding as before). */
export function estimatePayoutBreakdown(payoutTHB: number): { wht: number; net: number } {
  const wht = payoutTHB > 0 ? Math.round(payoutTHB * WHT_RATE) : 0;
  return { wht, net: payoutTHB - wht };
}

/** The graph is only worth loading when the tutor has at least one downline. */
export function hasDownline(tree: NetworkTreeNode | null | undefined): tree is NetworkTreeNode {
  return Boolean(tree && (tree.children?.length ?? 0) > 0);
}

/** "2026-10" → "2026-10-01" (a date the Thai formatter can read), or null. */
export function periodMonthToDate(periodMonth: string | null | undefined): string | null {
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) return null;
  return `${periodMonth}-01T12:00:00+07:00`;
}

/** Short, human-friendly form of the invite URL ("tutor.example.com/i/AB12…"). */
export function shortInviteLabel(url: string, max = 36): string {
  let label = url;
  try {
    const parsed = new URL(url);
    label = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;
  } catch {
    label = url.replace(/^https?:\/\//, "");
  }
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/** Flat node/edge lists for the graph (positions are added by the layout step). */
export interface GraphNodeSpec {
  id: string;
  tutor: TutorSummary;
  isRoot: boolean;
  hasChildren: boolean;
}

export interface GraphEdgeSpec {
  id: string;
  source: string;
  target: string;
}

export function flattenTree(tree: NetworkTreeNode): { nodes: GraphNodeSpec[]; edges: GraphEdgeSpec[] } {
  const nodes: GraphNodeSpec[] = [];
  const edges: GraphEdgeSpec[] = [];
  const seen = new Set<string>();
  const visit = (current: NetworkTreeNode, isRoot: boolean, parentId?: string) => {
    if (seen.has(current.userId)) return; // guard against cycles / duplicates
    seen.add(current.userId);
    const children = current.children ?? [];
    const { children: _omit, ...tutor } = current; // eslint-disable-line @typescript-eslint/no-unused-vars
    nodes.push({ id: current.userId, tutor, isRoot, hasChildren: children.length > 0 });
    if (parentId) edges.push({ id: `e-${parentId}-${current.userId}`, source: parentId, target: current.userId });
    for (const child of children) visit(child, false, current.userId);
  };
  visit(tree, true);
  return { nodes, edges };
}
