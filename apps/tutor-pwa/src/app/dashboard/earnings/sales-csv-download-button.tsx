"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SalesCsvDownloadButton({
  periodMonth,
  label,
  className,
  variant = "outline",
  size = "default"
}: {
  periodMonth: string;
  label: string;
  className?: string;
  variant?: "outline" | "ghost" | "default" | "secondary" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
}) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        window.open(
          `/api/earnings/sales-csv?periodMonth=${encodeURIComponent(periodMonth)}`,
          "_blank"
        );
      }}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
