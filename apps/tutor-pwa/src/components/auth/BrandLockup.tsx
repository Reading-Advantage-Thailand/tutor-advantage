import Image from "next/image";
import Link from "next/link";
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
 * App icon + "Tutor Advantage" + role line. Logged-out screens only (the
 * signed-in shell has its own BrandMark). Server-compatible.
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
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center overflow-hidden bg-surface shadow-xs ring-1",
          tone === "hero" ? "ring-hero-ring" : "ring-hairline",
          size === "md" ? "size-11 rounded-xl" : "size-8 rounded-lg",
        )}
      >
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={icon}
          height={icon}
          priority={size === "md"}
        />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate font-bold tracking-tight",
            size === "md" ? "text-lg leading-6" : "text-sm leading-5",
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
      <Link href={href} className={cn(classes, "rounded-lg outline-offset-4")}>
        {content}
      </Link>
    );
  }
  return <div className={classes}>{content}</div>;
}
