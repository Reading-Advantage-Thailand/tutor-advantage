"use client";

import React, { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Position,
  Handle,
  NodeProps,
  ConnectionLineType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { Users, CircleDollarSign, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TutorSummary = {
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

type NetworkTreeNode = TutorSummary & {
  children: NetworkTreeNode[];
};

const nodeWidth = 280;
const nodeHeight = 150;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = "LR") => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: 120, // Vertical gap between nodes
    nodesep: 80,  // Horizontal gap between sibling nodes
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = direction === "LR" ? Position.Left : Position.Top;
    node.sourcePosition = direction === "LR" ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (which is center) to top left
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

function formatTHB(value: number) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: 0 });
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

// Custom Node Component
const TutorNode = ({ data }: NodeProps<{ tutor: TutorSummary; isRoot: boolean; hasChildren: boolean }>) => {
  const { tutor, isRoot, hasChildren } = data as { tutor: TutorSummary; isRoot: boolean; hasChildren: boolean };
  return (
    <div
      className={`
        w-[280px] shadow-lg rounded-xl border-2
        ${
          isRoot
            ? "border-primary bg-primary/5 dark:bg-primary/10 ring-4 ring-primary/10"
            : "border-border bg-card hover:border-primary/50 transition-colors"
        }
      `}
    >
      {/* Connect to parent on top (except root) */}
      {!isRoot && (
        <Handle type="target" position={Position.Top} isConnectable={false} className="!bg-primary !border-background opacity-80" style={{ width: 8, height: 8 }} />
      )}
      
      {/* Connect to children on bottom (only if there are children) */}
      {hasChildren && (
        <Handle type="source" position={Position.Bottom} isConnectable={false} className="!bg-primary !border-background opacity-80" style={{ width: 8, height: 8 }} />
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold text-foreground max-w-[160px]">
            {tutor.displayName}
          </p>
          {isRoot ? <Badge variant="default" className="h-5 px-1 text-[10px]">YOU</Badge> : null}
          <Badge variant="secondary" className="h-5 px-1 text-[10px]">{formatPercent(tutor.currentRate)}</Badge>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {tutor.email || tutor.userId}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Personal Vol</p>
            <p className="font-semibold text-sm text-foreground flex items-center gap-1 mt-0.5">
              <CircleDollarSign className="h-3 w-3 text-muted-foreground" />
              ฿{formatTHB(tutor.personalVolumeTHB)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Group Vol</p>
            <p className="font-semibold text-sm text-foreground mt-0.5">฿{formatTHB(tutor.groupVolumeTHB)}</p>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] bg-muted/30 px-2 py-1.5 rounded-md border border-border/50">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            {(tutor.totalDownlines || 0)} downlines
          </span>
          <span className="font-bold text-primary">
            ฿{formatTHB(tutor.estimatedPayoutTHB)}
          </span>
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  tutorNode: TutorNode,
};

export function InteractiveNetwork({ tree }: { tree: NetworkTreeNode }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const traverse = (current: NetworkTreeNode, isRoot: boolean, parentId?: string) => {
      const nodeId = current.userId;
      const hasChildren = current.children && current.children.length > 0;

      nodes.push({
        id: nodeId,
        type: "tutorNode",
        data: { tutor: current, isRoot, hasChildren },
        position: { x: 0, y: 0 }, // Will be set by dagre
      });

      if (parentId) {
        edges.push({
          id: `e-${parentId}-${nodeId}`,
          source: parentId,
          target: nodeId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#3b82f6", strokeWidth: 2, opacity: 0.6 }, // Explicit blue for cross-browser safety
        });
      }

      current.children.forEach((child) => {
        traverse(child, false, nodeId);
      });
    };

    traverse(tree, true);
    return { initialNodes: nodes, initialEdges: edges };
  }, [tree]);

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    if (!mounted) return { nodes: [], edges: [] };
    // Create deep copies to not mutate inside useMemo
    const clonedNodes = JSON.parse(JSON.stringify(initialNodes));
    const clonedEdges = JSON.parse(JSON.stringify(initialEdges));
    return getLayoutedElements(clonedNodes, clonedEdges, "TB");
  }, [initialNodes, initialEdges, mounted]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync local state when layout state updates after mounting
  React.useEffect(() => {
    if (mounted && layoutedNodes.length > 0) {
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }
  }, [layoutedNodes, layoutedEdges, mounted, setNodes, setEdges]);

  const onFitView = useCallback(() => {
    // reactflow hook can be used if nested, but ReactFlow prop also accepts fitView true
  }, []);

  if (!mounted) {
    return (
      <div style={{ height: "600px", width: "100%" }} className="rounded-xl border bg-muted/20 flex items-center justify-center">
         <div className="text-muted-foreground text-sm animate-pulse">กำลังโหลดเครือข่าย...</div>
      </div>
    );
  }

  return (
    <div style={{ height: "600px", width: "100%" }} className="rounded-xl border bg-background/50 overflow-hidden relative group">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgesFocusable={false}
        nodesConnectable={false} // Disable automatic user linking fully
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--muted-foreground))" variant={"dots" as any} gap={20} size={1} opacity={0.2} />
        <Controls showInteractive={false} className="fill-foreground dark:invert bg-card border-border shadow-md" />
        <Panel position="top-right" className="bg-card/80 backdrop-blur border rounded-lg p-1 shadow-sm">
            <Button size="icon" variant="ghost" onClick={() => {}} className="h-8 w-8 hidden">
                <Maximize className="h-4 w-4" />
            </Button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
