"use client";

import { useId, useState, type ReactNode } from "react";
import { List, Network } from "lucide-react";
import { Section, Surface } from "@/components/app";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { NetworkGraph } from "./network-graph-lazy";
import type { NetworkTreeNode } from "./network-data";

/**
 * "โครงสร้างเครือข่าย" (patterns.md T7): the indented rows (server-rendered
 * children) by default; the interactive graph (xyflow, lazy chunk) only when
 * the tutor asks for it, so phones never download it unasked.
 */
export function NetworkStructureSection({
  tree,
  children,
  className,
}: {
  tree: NetworkTreeNode;
  children: ReactNode;
  className?: string;
}) {
  const [showGraph, setShowGraph] = useState(false);
  const regionId = useId();
  return (
    <Section
      title={t("dashboardNetwork.networkStructure")}
      description={showGraph ? t("dashboardNetwork.graphHint") : undefined}
      className={className}
      action={
        <Button
          variant="outline"
          size="sm"
          aria-expanded={showGraph}
          aria-controls={regionId}
          onClick={() => setShowGraph((open) => !open)}
        >
          {showGraph ? <List aria-hidden="true" /> : <Network aria-hidden="true" />}
          {showGraph ? t("dashboardNetwork.hideGraph") : t("dashboardNetwork.showGraph")}
        </Button>
      }
    >
      <div id={regionId}>
        {showGraph ? (
          <Surface padding="none" className="overflow-hidden">
            <NetworkGraph tree={tree} />
          </Surface>
        ) : (
          children
        )}
      </div>
    </Section>
  );
}
