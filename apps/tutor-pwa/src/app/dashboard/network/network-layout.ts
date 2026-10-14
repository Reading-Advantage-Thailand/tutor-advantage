import { graphlib, layout } from "@dagrejs/dagre";
import type { GraphEdgeSpec, GraphNodeSpec } from "./network-data";

/** Rendered size of a tutor node card (keep in sync with TutorNode). */
export const NODE_WIDTH = 248;
export const NODE_HEIGHT = 124;

export interface PositionedNode extends GraphNodeSpec {
  /** Top-left corner (xyflow convention). */
  x: number;
  y: number;
}

/**
 * Top-to-bottom tree layout with dagre. Only imported by the lazily loaded
 * graph chunk, so dagre never ships with the page bundle.
 */
export function layoutTree(
  nodes: GraphNodeSpec[],
  edges: GraphEdgeSpec[],
  { direction = "TB" }: { direction?: "TB" | "LR" } = {},
): PositionedNode[] {
  const graph = new graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: direction, ranksep: 72, nodesep: 40 });
  for (const node of nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) graph.setEdge(edge.source, edge.target);
  layout(graph);
  return nodes.map((node) => {
    const pos = graph.node(node.id) as { x: number; y: number };
    // dagre positions the centre; xyflow expects the top-left corner.
    return { ...node, x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 };
  });
}
