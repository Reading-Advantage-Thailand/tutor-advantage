import { cn } from "@/lib/utils";

/** Small red count pill (nav badges). Renders nothing for 0. */
export function CountBadge({ count, className, tone = "danger" }: { count: number; className?: string; tone?: "danger" | "brand" | "neutral" }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[0.6875rem] leading-none font-semibold tabular",
        tone === "danger" && "bg-danger-solid text-white",
        tone === "brand" && "bg-brand-solid text-on-brand",
        tone === "neutral" && "bg-neutral-bg text-neutral-fg",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
