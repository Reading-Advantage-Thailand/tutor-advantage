import Link from "next/link";
import { BrandMark } from "@/components/app/BrandMark";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface BrandLockupProps {
  /** "md" for the sign-in hero, "sm" for slim headers (legal, 404). */
  size?: "sm" | "md";
  /** Wrap in a link (e.g. back to the entry from legal pages). */
  href?: string;
  /** Text colour family: hero block (mint) or regular surface. */
  tone?: "hero" | "default";
  className?: string;
}

/**
 * TA mark + "Tutor Advantage" (Noto 600) + role line (components.md §12:
 * the mark is aria-hidden next to the visible name). Logged-out screens only
 * (the signed-in shell shows the same BrandMark in its bars). As a link it
 * keeps a 44px hit area. Server-compatible.
 */
export function BrandLockup({
  size = "md",
  href,
  tone = "default",
  className,
}: BrandLockupProps) {
  const icon = size === "md" ? 44 : 32;
  const content = (
    <>
      <BrandMark size={icon} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate font-semibold whitespace-nowrap",
            size === "md" ? "text-lg leading-6" : "text-[0.9375rem] leading-5",
          )}
        >
          {t("shell.brandName")}
        </span>
        <span
          className={cn(
            "truncate font-medium",
            size === "md" ? "text-[0.8125rem] leading-5" : "text-xs leading-4",
            tone === "hero" ? "text-hero-fg-muted" : "text-fg-muted",
          )}
        >
          {t("app.instructorPortal")}
        </span>
      </span>
    </>
  );

  const classes = cn(
    "flex min-w-0 items-center gap-3",
    tone === "hero" ? "text-hero-fg" : "text-fg",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cn(classes, "min-h-11 rounded-(--radius-ctl) pr-2 outline-offset-4")}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
