"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { t } from "@/lib/i18n";
import { roleLabel as labelForRole } from "@/lib/statusRole";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { useWorkQueues } from "./AdminSummary";
import type { SidebarMode } from "./AdminShell";
import { BrandMark } from "./BrandMark";
import { CountBadge } from "./CountBadge";
import { Dropdown } from "./Dropdown";
import { EnvBadge } from "./EnvBadge";
import { NAV_GROUP_LABELS, NAV_GROUP_ORDER, isNavItemActive, navItemsFor, type NavItem } from "./navigation";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { ThemeSegmented } from "./ThemeSegmented";

/** Kept here too so existing `import { BrandMark } from "./SideNav"` keeps working. */
export { BrandMark } from "./BrandMark";

function SideNavLink({ item, pathname, count }: { item: NavItem; pathname: string; count: number }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      id={`nav-${item.id}`}
      aria-current={active ? "page" : undefined}
      data-rail-tip={item.label}
      className="side-nav-item justify-center px-0 @min-[160px]:justify-start @min-[160px]:px-2.5"
    >
      <Icon aria-hidden="true" />
      {count > 0 ? (
        // Rail: the label and count are hidden, so a dot on the icon says "work waiting".
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-2.5 size-2 rounded-full bg-danger-solid ring-2 ring-surface-sidebar @min-[160px]:hidden"
        />
      ) : null}
      <span className="sr-only @min-[160px]:not-sr-only @min-[160px]:min-w-0 @min-[160px]:flex-1 @min-[160px]:truncate">{item.label}</span>
      {count > 0 ? (
        <>
          <CountBadge aria-hidden count={count} className="hidden @min-[160px]:inline-flex" />
          <span className="sr-only">{` ${t("shell.itemsCount", { count })}`}</span>
        </>
      ) : null}
    </Link>
  );
}

function AccountMenu() {
  const { user } = useShell();
  const name = user?.name || user?.email || t("shell.account");
  const roleLabel = user ? labelForRole(user.role) : "";
  return (
    <Dropdown
      id="account-menu-panel"
      label={t("shell.account")}
      placement="right-end"
      panelClassName="w-72"
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          aria-label={`${t("shell.account")}: ${name}`}
          data-rail-tip={name}
          {...triggerProps}
          className={cn(
            "flex w-full items-center justify-center gap-2.5 rounded-(--radius-ctl) p-1.5 text-left transition-colors hover:bg-press pointer-coarse:min-h-11 @min-[160px]:justify-start",
            open && "bg-press",
          )}
        >
          <UserAvatar name={name} seed={user?.userId} src={user?.picture || undefined} size="sm" />
          <span className="hidden min-w-0 flex-1 @min-[160px]:block">
            <span className="block truncate text-sm leading-normal font-semibold text-fg">{name}</span>
            <span className="block truncate text-xs leading-normal text-fg-muted">{roleLabel}</span>
          </span>
        </button>
      )}
    >
      {() => (
        <>
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <UserAvatar name={name} seed={user?.userId} src={user?.picture || undefined} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg" title={name}>{name}</p>
              {user?.email ? <p className="truncate text-xs text-fg-muted" title={user.email}>{user.email}</p> : null}
              <p className="truncate text-xs text-brand-fg">{roleLabel}</p>
            </div>
          </div>
          <div className="border-b border-hairline px-4 py-3">
            <p className="mb-2 text-xs font-medium text-fg-muted">{t("shell.theme")}</p>
            {/* Content-sized segments: three equal thirds of the 288px panel are
                narrower than the selected "ตามระบบ", which would truncate. */}
            <ThemeSegmented fullWidth className="[&_.seg-item]:flex-auto" />
          </div>
          <div className="p-1.5">
            <button
              type="button"
              id="btn-logout"
              onClick={() => void logout()}
              className="flex h-10 w-full items-center gap-3 rounded-(--radius-ctl) px-2.5 text-sm font-medium text-danger-fg hover:bg-danger-bg pointer-coarse:h-11"
            >
              <LogOut aria-hidden="true" className="size-4" />
              {t("shell.logout")}
            </button>
          </div>
        </>
      )}
    </Dropdown>
  );
}

/** Grouped nav list (also used inside the mobile drawer). */
export function NavList({
  pathname,
  onNavigate,
  variant = "sidebar",
}: {
  pathname: string;
  onNavigate?: () => void;
  variant?: "sidebar" | "drawer";
}) {
  const { user, devRoutes } = useShell();
  const queues = useWorkQueues();
  const items = navItemsFor(user?.role, devRoutes);
  return (
    <>
      {NAV_GROUP_ORDER.map((group, index) => {
        const groupItems = items.filter((item) => item.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div
            key={group}
            className={cn(
              index > 0 && (variant === "sidebar" ? "mt-2" : "mt-3"),
              variant === "sidebar" && index > 0 && "border-t border-hairline pt-2 @min-[160px]:border-0 @min-[160px]:pt-0",
            )}
          >
            <p className={cn("side-nav-label", variant === "sidebar" && "hidden @min-[160px]:block")}>{NAV_GROUP_LABELS[group]}</p>
            <ul className="flex flex-col">
              {groupItems.map((item) =>
                variant === "sidebar" ? (
                  <li key={item.id}>
                    <SideNavLink item={item} pathname={pathname} count={item.badge ? queues[item.badge] : 0} />
                  </li>
                ) : (
                  <li key={item.id}>
                    <DrawerLink item={item} pathname={pathname} count={item.badge ? queues[item.badge] : 0} onNavigate={onNavigate} />
                  </li>
                ),
              )}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function DrawerLink({ item, pathname, count, onNavigate }: { item: NavItem; pathname: string; count: number; onNavigate?: () => void }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-variant="drawer"
      className="side-nav-item"
    >
      <Icon aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <CountBadge aria-hidden count={count} />
      {count > 0 ? <span className="sr-only">{` ${t("shell.itemsCount", { count })}`}</span> : null}
    </Link>
  );
}

/**
 * Rail tooltips: in the 72px rail the labels are hidden, so an item that is
 * hovered with a mouse or focused from the keyboard shows its label to the
 * right of the rail. The accessible name is already on the item (sr-only text
 * or aria-label); this is its visual twin, so it is aria-hidden. Nothing is
 * rendered until then, so the server and client markup are the same.
 */
function useRailTooltip(asideRef: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<{ label: string; top: number; left: number } | null>(null);
  useEffect(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const show = (target: HTMLElement | null) => {
      const label = target?.dataset.railTip;
      // Full nav (≥160px): the labels are visible, no tooltip.
      if (!target || !label || aside.clientWidth >= 160) {
        setTip(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setTip({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
    };
    const hide = () => setTip(null);
    const onPointerOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      show((event.target as Element).closest<HTMLElement>("[data-rail-tip]"));
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = (event.target as Element).closest<HTMLElement>("[data-rail-tip]");
      show(target && target.matches(":focus-visible") ? target : null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    aside.addEventListener("pointerover", onPointerOver);
    aside.addEventListener("pointerleave", hide);
    aside.addEventListener("focusin", onFocusIn);
    aside.addEventListener("focusout", hide);
    aside.addEventListener("scroll", hide, true);
    aside.addEventListener("keydown", onKeyDown);
    return () => {
      aside.removeEventListener("pointerover", onPointerOver);
      aside.removeEventListener("pointerleave", hide);
      aside.removeEventListener("focusin", onFocusIn);
      aside.removeEventListener("focusout", hide);
      aside.removeEventListener("scroll", hide, true);
      aside.removeEventListener("keydown", onKeyDown);
    };
  }, [asideRef]);
  return { tip, hideTip: () => setTip(null) };
}

export interface SideNavProps {
  /** Current width choice (AdminShell). In "auto" the width follows the viewport, in CSS. */
  mode?: SidebarMode;
  /** Saves an explicit choice: true = rail, false = full nav. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** @deprecated Pass `mode`. */
  collapsed?: boolean;
  /** @deprecated Pass `onCollapsedChange`. */
  onToggleCollapsed?: () => void;
}

const toggleClass =
  "size-9 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-muted transition-colors hover:bg-press hover:text-fg pointer-coarse:size-11";

/**
 * Desktop side nav (≥1024px): 248px column, or a 72px icon rail (automatic at
 * 1024–1279px until the admin picks one with the toggle; remembered in the
 * admin_sidebar cookie). Brand block (TA mark + name + "คอนโซลผู้ดูแลระบบ" +
 * rail toggle), the environment chip, grouped items (36px, active =
 * brand-soft + a 3px jade bar on the left edge, counts as danger pills) and
 * the account menu at the bottom. Layout switches with a container query on
 * the side nav width, so there is no JS measuring and "auto" reads no
 * viewport during render. The toggle is two buttons ("expand" in the rail,
 * "collapse" in the full nav), each with its own name; the other one is
 * display:none, and focus moves to it after a toggle.
 */
export function SideNav({ mode, onCollapsedChange, collapsed, onToggleCollapsed }: SideNavProps) {
  const pathname = usePathname() ?? "/";
  const { environment } = useShell();
  const asideRef = useRef<HTMLElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const { tip, hideTip } = useRailTooltip(asideRef);
  const currentMode = mode ?? (collapsed ? "rail" : "full");
  // The pressed toggle hides itself: focus moves to its twin once the width changed.
  const focusAfterToggle = useRef<"expand" | "collapse" | null>(null);
  useLayoutEffect(() => {
    const target = focusAfterToggle.current;
    focusAfterToggle.current = null;
    if (target === "expand") expandRef.current?.focus();
    else if (target === "collapse") collapseRef.current?.focus();
  }, [currentMode]);
  const choose = (nextCollapsed: boolean) => {
    hideTip();
    const focused = document.activeElement;
    if (focused === expandRef.current || focused === collapseRef.current) {
      focusAfterToggle.current = nextCollapsed ? "expand" : "collapse";
    }
    if (onCollapsedChange) onCollapsedChange(nextCollapsed);
    else onToggleCollapsed?.();
  };
  return (
    <aside ref={asideRef} className="app-sidebar" aria-label={t("shell.mainNavigation")}>
      <div className="flex flex-col items-center gap-2 px-3 pt-4 pb-3 @min-[160px]:flex-row @min-[160px]:gap-2.5 @min-[160px]:pr-3 @min-[160px]:pl-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 rounded-(--radius-ctl) @min-[160px]:flex-1"
          aria-label={t("shell.brandName")}
          data-rail-tip={t("shell.brandName")}
        >
          <BrandMark />
          <span className="hidden min-w-0 @min-[160px]:block">
            <span className="block truncate text-[0.9375rem] leading-snug font-semibold whitespace-nowrap text-fg">{t("shell.brandName")}</span>
            <span className="block truncate text-xs leading-normal text-fg-muted">{t("shell.brandRole")}</span>
          </span>
        </Link>
        {/* In the rail (automatic at 1024–1279px, or chosen): "expand". */}
        <button
          ref={expandRef}
          type="button"
          onClick={() => choose(false)}
          aria-label={t("shell.expandSidebar")}
          data-rail-tip={t("shell.expandSidebar")}
          className={cn("inline-flex @min-[160px]:hidden", toggleClass)}
        >
          <PanelLeftOpen aria-hidden="true" className="size-[18px]" />
        </button>
        {/* In the full nav: "collapse" (an icon only, so it keeps the native tooltip). */}
        <button
          ref={collapseRef}
          type="button"
          onClick={() => choose(true)}
          aria-label={t("shell.collapseSidebar")}
          title={t("shell.collapseSidebar")}
          className={cn("hidden @min-[160px]:inline-flex", toggleClass)}
        >
          <PanelLeftClose aria-hidden="true" className="size-[18px]" />
        </button>
      </div>
      <div className="px-3 pb-1.5 @min-[160px]:px-4">
        <EnvBadge environment={environment} block />
      </div>

      {/* Scroll padding (and the rail's 6px top) for the focus ring: .app-sidebar > nav in globals.css. */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-hide">
        <NavList pathname={pathname} />
      </nav>

      <div className="mx-3 border-t border-hairline pt-2.5 pb-3">
        <AccountMenu />
      </div>
      {tip
        ? createPortal(
            <div aria-hidden="true" className="rail-tip" style={{ top: tip.top, left: tip.left }}>
              {tip.label}
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
