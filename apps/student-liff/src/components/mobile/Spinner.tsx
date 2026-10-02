import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** sm 16px (in buttons/rows, default) · md 20px · lg 28px */
  size?: "sm" | "md" | "lg";
  /** Accessible label; omit (decorative) when visible text already says it is loading. */
  label?: string;
  className?: string;
}

const sizeClass = { sm: "size-4", md: "size-5", lg: "size-7" } as const;

/**
 * Small inline busy indicator for buttons and rows. For page/section loading
 * prefer skeletons (<CardSkeleton>, <ListRowSkeleton>) over spinners.
 */
export function Spinner({ size = "sm", label, className }: SpinnerProps) {
  return (
    <Loader2
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 animate-spin", sizeClass[size], className)}
    />
  );
}
