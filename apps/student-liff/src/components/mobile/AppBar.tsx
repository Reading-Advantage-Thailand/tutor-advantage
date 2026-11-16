"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { levelToneClass, type CefrTone } from "@/lib/cefr";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { useBackNavigation } from "./useBackNavigation";

export type AppBarVariant = "solid" | "brand" | "transparent";

export interface AppBarProps {
  /** Screen title (single line, ellipsis — Thai titles are long). */
  title: ReactNode;
  /** Title element: h1 (default), or p when the page already has its own h1 (e.g. a hero title below). */
  titleAs?: "h1" | "p";
  /** Hide the title until the page scrolls (a hero right below already shows it). Pairs with variant="transparent". */
  titleOnScroll?: boolean;
  /** Optional second line under the title (single line, ellipsis). */
  subtitle?: ReactNode;
  /** Show the 44px back button. Implied when `onBack` or `backHref` is given. */
  back?: boolean;
  /**
   * A real link back to a fixed destination instead of history back. For
   * pages that are often opened directly (the public catalogue), where there
   * is no in-app history to go back to.
   */
  backHref?: string;
  /** Accessible name of the back control, e.g. the destination ("คลาสเรียนทั้งหมด"). Default t("common.back"). */
  backLabel?: string;
  /** Where back goes when there is no in-app history (deep link). Default "/dashboard". */
  fallbackHref?: string;
  /** Overrides back behaviour (e.g. a multi-step flow going to the previous step). */
  onBack?: () => void;
  /** Right-side slot, usually 1–2 <IconButton>s. */
  actions?: ReactNode;
  /** solid (default, card surface) · brand (flat hero colour, hero text) · transparent (until scrolled). */
  variant?: AppBarVariant;
  /**
   * CEFR band background (the `soft` level colour), so a pushed screen's bar
   * continues a <ToneHero tone> right below it (class detail, lobby). Text
   * and icons keep the normal tokens. Not combined with variant="brand".
   */
  tone?: CefrTone;
  /** Slot under the title row inside the sticky bar (SearchField, SegmentedControl…). */
  bottom?: ReactNode;
  className?: string;
}

/**
 * Sticky top app bar for pushed screens (components.md §9): safe-top padding,
 * 56px row, opaque (no backdrop blur), title in Kodchasan 600 17 (centred when
 * there is a back button), and a hairline that appears only once the page scrolls.
 * Render it as the FIRST child of the screen (not inside a short wrapper) so
 * sticky positioning spans the whole page.
 *
 * @example
 * <AppBar title={t("payment.title")} back fallbackHref="/classes" />
 * <AppBar title="ขั้นตอนที่ 2" onBack={() => setStep(1)} />
 * <AppBar title="คลาสเรียนที่เปิดขาย" backHref="/" backLabel="Tutor Advantage" />
 * <AppBar title={t("classes.detail.title")} back fallbackHref="/classes" tone="teal" />
 */
export function AppBar({
  title,
  titleAs: Title = "h1",
  titleOnScroll = false,
  subtitle,
  back,
  backHref,
  backLabel,
  fallbackHref = "/dashboard",
  onBack,
  actions,
  variant = "solid",
  tone,
  bottom,
  className,
}: AppBarProps) {
  const goBack = useBackNavigation(fallbackHref);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const showBack = back ?? Boolean(onBack || backHref);

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
  const backVariant = onBrand ? "onBrand" : "ghost";

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none -mb-px h-px w-full" />
      <header
        // The tone colour is a utility, so it beats the `.appbar` component background; className still wins.
        className={cn("appbar", tone && !onBrand && levelToneClass[tone].soft, className)}
        data-variant={variant}
        data-scrolled={scrolled ? "" : undefined}
      >
        <div
          className={cn(
            "h-[var(--appbar-h)] items-center gap-1",
            showBack
              ? "grid grid-cols-[minmax(max-content,1fr)_minmax(0,auto)_minmax(max-content,1fr)] px-1"
              : cn("flex", "pl-4", actions ? "pr-1" : "pr-4"),
          )}
        >
          {showBack ? (
            <div className="flex items-center">
              {backHref ? (
                <IconButton icon={ChevronLeft} label={backLabel ?? t("common.back")} variant={backVariant} href={backHref} />
              ) : (
                <IconButton
                  icon={ChevronLeft}
                  label={backLabel ?? t("common.back")}
                  variant={backVariant}
                  onClick={onBack ?? goBack}
                />
              )}
            </div>
          ) : null}
          <div className={cn("min-w-0", showBack ? "text-center" : "flex-1")}>
            <Title
              className={cn(
                "truncate font-heading text-[17px] leading-[1.35] font-semibold",
                titleOnScroll && !scrolled && "invisible",
              )}
            >
              {title}
            </Title>
            {subtitle ? (
              <p
                className={cn(
                  "truncate text-[13px] leading-[1.4]",
                  onBrand ? "text-hero-fg-muted" : "text-fg-muted",
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center justify-end">{actions}</div>
          ) : showBack ? (
            <div aria-hidden="true" className="w-11" />
          ) : null}
        </div>
        {bottom ? <div className="px-4 pb-2.5">{bottom}</div> : null}
      </header>
    </>
  );
}
