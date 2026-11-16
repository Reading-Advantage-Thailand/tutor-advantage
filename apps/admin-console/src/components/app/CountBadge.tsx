import { cn } from "@/lib/utils";

/**
 * Count pill, 22px, Noto 600 12 tabular. `danger` (default) is the alert count
 * in the nav (--danger-solid / --on-danger); `neutral` is a plain count
 * (--neutral-bg / --neutral-fg); `brand` a jade one. Renders nothing for 0.
 * A bare number means little to a screen reader: pass `aria-hidden` and put the
 * count in words ("3 รายการ", shell.itemsCount) inside the link or button instead.
 */
export function CountBadge({
  count,
  className,
  tone = "danger",
  "aria-hidden": ariaHidden,
}: {
  count: number;
  className?: string;
  tone?: "danger" | "brand" | "neutral";
  "aria-hidden"?: boolean;
}) {
  if (!count || count <= 0) return null;
  return (
    <span
      aria-hidden={ariaHidden || undefined}
      className={cn(
        "inline-flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full px-[7px] text-xs leading-none font-semibold tabular",
        tone === "danger" && "bg-danger-solid text-on-danger",
        tone === "brand" && "bg-brand-solid text-on-brand",
        tone === "neutral" && "bg-neutral-bg text-neutral-fg",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
