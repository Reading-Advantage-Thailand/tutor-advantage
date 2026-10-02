"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { useBackNavigation } from "./useBackNavigation";

export type AppBarVariant = "solid" | "brand" | "transparent";

export interface AppBarProps {
  /** Screen title (single line, ellipsis — Thai titles are long). */
  title: ReactNode;
  /** Optional second line under the title (single line, ellipsis). */
  subtitle?: ReactNode;
  /** Show the 44px back button. Implied when `onBack` is given. */
  back?: boolean;
  /** Where back goes when there is no in-app history (deep link). Default "/dashboard". */
  fallbackHref?: string;
  /** Overrides back behaviour (e.g. a multi-step flow going to the previous step). */
  onBack?: () => void;
  /** Right-side slot, usually 1–2 <IconButton>s. */
  actions?: ReactNode;
  /** solid (default, white surface) · brand (green, white text) · transparent (until scrolled). */
  variant?: AppBarVariant;
  /** Slot under the title row inside the sticky bar (SearchField, SegmentedControl…). */
  bottom?: ReactNode;
  className?: string;
}

/**
 * Sticky top app bar for pushed screens: safe-top padding, 56px row, opaque
 * (no backdrop blur), and a hairline that appears only once the page scrolls.
 * Render it as the FIRST child of the screen (not inside a short wrapper) so
 * sticky positioning spans the whole page.
 *
 * @example
 * <AppBar title={t("payment.title")} back fallbackHref="/classes" />
 * <AppBar title="ขั้นตอนที่ 2" onBack={() => setStep(1)} />
 */
export function AppBar({
  title,
  subtitle,
  back,
  fallbackHref = "/dashboard",
  onBack,
  actions,
  variant = "solid",
  bottom,
  className,
}: AppBarProps) {
  const goBack = useBackNavigation(fallbackHref);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const showBack = back ?? Boolean(onBack);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    // The 1px sentinel sits right above the bar; once it leaves the viewport
    // the bar is stuck over content and shows its hairline.
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const onBrand = variant === "brand";

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none -mb-px h-px w-full" />
      <header
        className={cn("appbar", className)}
        data-variant={variant}
        data-scrolled={scrolled ? "" : undefined}
      >
        <div
          className={cn(
            "flex h-[var(--appbar-h)] items-center gap-1",
            showBack ? "pl-1" : "pl-4",
            actions ? "pr-1" : "pr-4",
          )}
        >
          {showBack ? (
            <IconButton
              icon={ChevronLeft}
              label={t("common.back")}
              variant={onBrand ? "onBrand" : "ghost"}
              onClick={onBack ?? goBack}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] leading-[1.5] font-bold">{title}</h1>
            {subtitle ? (
              <p
                className={cn(
                  "-mt-0.5 truncate text-xs leading-[1.5]",
                  onBrand ? "text-hero-fg-muted" : "text-fg-muted",
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center">{actions}</div> : null}
        </div>
        {bottom ? <div className="px-4 pb-2.5">{bottom}</div> : null}
      </header>
    </>
  );
}
