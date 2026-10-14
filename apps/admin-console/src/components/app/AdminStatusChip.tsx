import type { LucideIcon } from "lucide-react";
import { statusMeta, type StatusDomain } from "@/lib/status";
import { Chip } from "./Atoms";

export interface AdminStatusChipProps {
  domain: StatusDomain;
  status: string | null | undefined;
  size?: "sm" | "md";
  icon?: LucideIcon;
  className?: string;
}

/**
 * Status chip with the Thai label + tone from lib/status.ts
 * (payment, enrollment, settlementRun, payoutTransfer, adjustment, exception,
 * fraudFlag, verification, coupon, userRole, account…). Server-compatible.
 */
export function AdminStatusChip({ domain, status, size = "sm", icon, className }: AdminStatusChipProps) {
  const meta = statusMeta(domain, status);
  return (
    <Chip tone={meta.tone} size={size} dot={!icon} icon={icon} className={className} title={meta.hint}>
      {meta.label}
    </Chip>
  );
}
