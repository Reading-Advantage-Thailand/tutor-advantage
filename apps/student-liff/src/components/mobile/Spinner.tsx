import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** sm 16px (in buttons/rows, default) · md 20px · lg 24px */
  size?: "sm" | "md" | "lg";
  /** Accessible label; omit (decorative) when visible text already says it is loading. */
  label?: string;
  className?: string;
}

const sizeClass = { sm: "size-4", md: "size-5", lg: "size-6" } as const;

/**
 * Small inline busy indicator (components.md §5): a 25% currentColor track and
 * a full-strength arc, 800ms linear spin. Under reduced motion it pulses its
 * opacity instead (data-motion="full" lets that one animation through the
 * global reduced-motion rule). Never Reedy. For page/section loading prefer
 * skeletons (<CardSkeleton>, <ListRowSkeleton>) over spinners.
 */
export function Spinner({ size = "sm", label, className }: SpinnerProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-motion="full"
      className={cn(
        "shrink-0 motion-safe:animate-[spin_800ms_linear_infinite] motion-reduce:animate-pulse",
        sizeClass[size],
        className,
      )}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
