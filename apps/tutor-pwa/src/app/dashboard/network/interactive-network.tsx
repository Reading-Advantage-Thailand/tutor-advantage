"use client";

/**
 * MLM network graph (@xyflow/react + dagre). Heavy: only ever loaded through
 * `network-graph-lazy.tsx` (next/dynamic, ssr: false) and only when the tutor
 * has at least one downline.
 */

import { useMemo, type CSSProperties } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Users } from "lucide-react";
import { Chip, UserAvatar } from "@/components/app";
import { formatTHB } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fillTemplate } from "../_shared/text";
import { flattenTree, type NetworkTreeNode, type TutorSummary } from "./network-data";
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from "./network-layout";

type TutorNodeData = { tutor: TutorSummary; isRoot: boolean; hasChildren: boolean };
type TutorFlowNode = Node<TutorNodeData, "tutorNode">;

const handleStyle: CSSProperties = {
  width: 6,
  height: 6,
  minWidth: 6,
  minHeight: 6,
  background: "var(--hairline-strong)",
  border: "none",
};

function TutorNode({ data }: NodeProps<TutorFlowNode>) {
  const { tutor, isRoot, hasChildren } = data;
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-3 text-left shadow-card",
        isRoot ? "border-brand-soft-border ring-2 ring-brand-soft" : "border-hairline",
      )}
    >
      {!isRoot ? <Handle type="target" position={Position.Top} isConnectable={false} style={handleStyle} /> : null}
      {hasChildren ? <Handle type="source" position={Position.Bottom} isConnectable={false} style={handleStyle} /> : null}

      <div className="flex min-w-0 items-center gap-2">
        <UserAvatar name={tutor.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{tutor.displayName}</p>
          <p className="truncate text-xs text-fg-muted">
            <Users aria-hidden="true" className="mr-1 inline size-3 align-[-2px]" />
            {fillTemplate(t("dashboardNetwork.downlineCount"), { count: tutor.totalDownlines ?? 0 })}
          </p>
        </div>
        {isRoot ? (
          <Chip tone="brand" size="sm">
            {t("dashboardNetwork.youLabel")}
          </Chip>
        ) : null}
        <Chip tone="neutral" size="sm">
          {Math.round(tutor.currentRate * 100)}%
        </Chip>
      </div>

      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-2">
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">{t("dashboardNetwork.personalVolShort")}</dt>
          <dd className="tabular truncate text-[0.8125rem] font-semibold text-fg">
            {formatTHB(tutor.personalVolumeTHB, { fractionDigits: 0 })}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-fg-muted">{t("dashboardNetwork.groupVolShort")}</dt>
          <dd className="tabular truncate text-[0.8125rem] font-semibold text-fg">
            {formatTHB(tutor.groupVolumeTHB, { fractionDigits: 0 })}
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-xs text-fg-muted">{t("dashboardNetwork.payoutShort")}</dt>
          <dd className="tabular truncate text-[0.8125rem] font-semibold text-brand-fg">
            {formatTHB(tutor.estimatedPayoutTHB, { fractionDigits: 0 })}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const nodeTypes = { tutorNode: TutorNode };

const edgeStyle: CSSProperties = { stroke: "var(--brand-300)", strokeWidth: 1.5 };

const controlsStyle = {
  "--xy-controls-button-background-color": "var(--surface-card)",
  "--xy-controls-button-background-color-hover": "var(--surface-muted)",
  "--xy-controls-button-color": "var(--text-primary)",
  "--xy-controls-button-color-hover": "var(--text-primary)",
  "--xy-controls-button-border-color": "var(--hairline)",
  "--xy-controls-box-shadow": "none",
} as CSSProperties;

export function InteractiveNetwork({ tree }: { tree: NetworkTreeNode }) {
  const { nodes, edges } = useMemo(() => {
    const flat = flattenTree(tree);
    const placed = layoutTree(flat.nodes, flat.edges);
    const flowNodes: TutorFlowNode[] = placed.map((n) => ({
      id: n.id,
      type: "tutorNode",
      position: { x: n.x, y: n.y },
      data: { tutor: n.tutor, isRoot: n.isRoot, hasChildren: n.hasChildren },
      draggable: false,
      connectable: false,
    }));
    const flowEdges: Edge[] = flat.edges.map((e) => ({ ...e, type: "smoothstep", style: edgeStyle }));
    return { nodes: flowNodes, edges: flowEdges };
  }, [tree]);

  return (
    <div
      role="group"
      aria-label={t("dashboardNetwork.graphAria")}
      className="h-[420px] w-full overflow-hidden bg-surface-muted md:h-[560px]"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1, minZoom: 0.7 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
      >
        <Background color="var(--hairline-strong)" variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={controlsStyle}
          className="overflow-hidden rounded-lg border border-hairline shadow-xs"
        />
      </ReactFlow>
    </div>
  );
}
