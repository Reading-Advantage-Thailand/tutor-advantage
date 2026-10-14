"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { t } from "@/lib/i18n";
import { roleLabel as labelForRole } from "@/lib/statusRole";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Avatar";
import { useWorkQueues } from "./AdminSummary";
import { CountBadge } from "./CountBadge";
import { Dropdown } from "./Dropdown";
import { EnvBadge } from "./EnvBadge";
import { NAV_GROUP_LABELS, NAV_GROUP_ORDER, isNavItemActive, navItemsFor, type NavItem } from "./navigation";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { ThemeSegmented } from "./ThemeSegmented";

/** Brand mark: calm green tile with the TA monogram. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-solid text-[0.8125rem] font-bold tracking-tight text-white",
        className,
      )}
    >
      TA
    </span>
  );
}

function SideNavLink({ item, pathname, count }: { item: NavItem; pathname: string; count: number }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      id={`nav-${item.id}`}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group/nav relative flex h-10 items-center justify-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
        "@min-[160px]:h-8 @min-[160px]:justify-start @min-[160px]:px-2.5",
        active ? "bg-brand-soft text-brand-fg" : "text-fg-muted hover:bg-press hover:text-fg",
      )}
    >
      <span className="relative flex">
        <Icon aria-hidden="true" className={cn("size-[18px] shrink-0", active ? "text-brand-fg" : "text-fg-subtle group-hover/nav:text-fg-muted")} />
        {count > 0 ? (
          <span aria-hidden="true" className="absolute -top-1 -right-1 size-2 rounded-full bg-danger-solid ring-2 ring-surface-sidebar @min-[160px]:hidden" />
        ) : null}
      </span>
      <span className="sr-only @min-[160px]:not-sr-only @min-[160px]:flex-1 @min-[160px]:truncate">{item.label}</span>
      {count > 0 ? (
        <CountBadge count={count} className="hidden @min-[160px]:inline-flex" />
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
      label={t("shell.account")}
      placement="right-end"
      panelClassName="w-72"
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          aria-label={`${t("shell.account")}: ${name}`}
          {...triggerProps}
          className={cn(
            "flex w-full items-center justify-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-press @min-[160px]:justify-start",
            open && "bg-press",
          )}
        >
          <UserAvatar name={name} src={user?.picture || undefined} size="sm" />
          <span className="hidden min-w-0 flex-1 @min-[160px]:block">
            <span className="block truncate text-sm font-medium text-fg">{name}</span>
            <span className="block truncate text-xs text-fg-muted">{roleLabel}</span>
          </span>
        </button>
      )}
    >
      {() => (
        <>
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <UserAvatar name={name} src={user?.picture || undefined} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              {user?.email ? <p className="truncate text-xs text-fg-muted">{user.email}</p> : null}
              <p className="truncate text-xs text-brand-fg">{roleLabel}</p>
            </div>
          </div>
          <div className="border-b border-hairline px-4 py-3">
            <p className="mb-2 text-xs font-medium text-fg-muted">{t("shell.theme")}</p>
            <ThemeSegmented fullWidth />
          </div>
          <div className="p-1.5">
            <button
              type="button"
              id="btn-logout"
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-danger-fg hover:bg-danger-bg"
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
              index > 0 && (variant === "sidebar" ? "mt-2.5" : "mt-3"),
              variant === "sidebar" && index > 0 && "border-t border-hairline pt-3 @min-[160px]:border-0 @min-[160px]:pt-0",
            )}
          >
            <p
              className={cn(
                "px-2.5 pb-0.5 text-xs font-medium text-fg-subtle",
                variant === "sidebar" && "hidden @min-[160px]:block",
              )}
            >
              {NAV_GROUP_LABELS[group]}
            </p>
            <ul className="flex flex-col gap-0.5">
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
      className={cn(
        "flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-medium transition-colors",
        active ? "bg-brand-soft text-brand-fg" : "text-fg hover:bg-press",
      )}
    >
      <Icon aria-hidden="true" className={cn("size-5 shrink-0", active ? "text-brand-fg" : "text-fg-subtle")} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <CountBadge count={count} />
    </Link>
  );
}

/**
 * Desktop sidebar (≥1024px): 248px column, or a 72px icon rail when
 * collapsed (remembered in the admin_sidebar cookie). Layout switches with a
 * container query on the sidebar width, so there is no JS measuring.
 */
export function SideNav({ collapsed, onToggleCollapsed }: { collapsed: boolean; onToggleCollapsed: () => void }) {
  const pathname = usePathname() ?? "/";
  const { environment } = useShell();
  return (
    <aside className="app-sidebar" aria-label={t("shell.mainNavigation")}>
      <div className="flex flex-col items-center gap-2 px-3 pt-3.5 pb-2.5 @min-[160px]:items-start @min-[160px]:px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg" aria-label={t("shell.brandName")}>
          <BrandMark />
          <span className="hidden min-w-0 @min-[160px]:block">
            <span className="block truncate text-sm leading-tight font-semibold text-fg">{t("shell.brandName")}</span>
            <span className="flex items-center gap-1.5 text-xs leading-tight text-fg-muted">
              <span className="truncate">{t("shell.brandRole")}</span>
              <EnvBadge environment={environment} className="h-[18px] px-1.5" />
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-hide @min-[160px]:px-3">
        <NavList pathname={pathname} />
      </nav>

      <div className="flex flex-col gap-1 border-t border-hairline p-2 @min-[160px]:px-3 @min-[160px]:py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          title={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          className="flex h-8 items-center justify-center gap-3 rounded-lg px-1.5 text-sm text-fg-muted hover:bg-press hover:text-fg @min-[160px]:justify-start @min-[160px]:px-2.5"
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-[18px]" /> : <PanelLeftClose aria-hidden="true" className="size-[18px]" />}
          <span className="hidden @min-[160px]:inline">{t("shell.collapseSidebar")}</span>
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}
