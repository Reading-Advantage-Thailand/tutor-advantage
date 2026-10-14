"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/app";
import type { NetworkTreeNode } from "./network-data";

/**
 * Code-split entry for the network graph: @xyflow/react, its CSS and dagre are
 * only downloaded when this component renders (the page renders it only when
 * the tutor has a downline).
 */
const InteractiveNetwork = dynamic(() => import("./interactive-network").then((m) => m.InteractiveNetwork), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-none md:h-[560px]" />,
});

export function NetworkGraph({ tree }: { tree: NetworkTreeNode }) {
  return <InteractiveNetwork tree={tree} />;
}
