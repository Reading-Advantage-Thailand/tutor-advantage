"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SalesCsvDownloadButton({
  periodMonth,
  label,
  className,
  variant = "outline",
  size = "default",
}: {
  periodMonth: string;
  label: string;
  className?: string;
  variant?: "outline" | "ghost" | "default" | "secondary" | "soft" | "link";
  size?: "default" | "sm" | "lg" | "xs";
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        window.open(`/api/earnings/sales-csv?periodMonth=${encodeURIComponent(periodMonth)}`, "_blank");
      }}
    >
      <Download aria-hidden="true" />
      {label}
    </Button>
  );
}
