"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Atoms";
import { Dropdown } from "./Dropdown";
import { NAV_GROUP_LABELS, NAV_ITEMS, isNavItemActive, type NavGroup, type NavItem } from "./navigation";
import { CountBadge, NotificationBell } from "./NotificationBell";
import { useNotifications } from "./Notifications";
import { HELP_URL } from "./constants";
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

function NavLink({ item, pathname, count }: { item: NavItem; pathname: string; count: number }) {
  const active = isNavItemActive(item, pathname);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      id={`nav-${item.id}`}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group/nav relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[0.6875rem] leading-tight font-medium transition-colors",
        "@min-[160px]:flex-row @min-[160px]:gap-3 @min-[160px]:px-3 @min-[160px]:py-2 @min-[160px]:text-sm",
        active ? "bg-brand-soft text-brand-fg" : "text-fg-muted hover:bg-press hover:text-fg",
      )}
    >
      <span className="relative flex">
        <Icon aria-hidden="true" className={cn("size-5 shrink-0", active ? "text-brand-fg" : "text-fg-subtle group-hover/nav:text-fg-muted")} />
        {count > 0 ? (
          <CountBadge count={count} className="absolute -top-1.5 -right-2 h-4 min-w-4 text-[0.625rem] ring-2 ring-surface-sidebar @min-[160px]:hidden" />
        ) : null}
      </span>
      <span className="line-clamp-2 max-w-full text-center break-words @min-[160px]:line-clamp-1 @min-[160px]:flex-1 @min-[160px]:text-left">{item.label}</span>
      {count > 0 ? <CountBadge count={count} className="hidden @min-[160px]:inline-flex" /> : null}
    </Link>
  );
}

function AccountMenu() {
  const { user } = useShell();
  const name = user?.displayName || t("shell.account");
  return (
    <Dropdown
      label={t("shell.account")}
      placement="right-end"
      panelClassName="w-72"
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          aria-label={t("shell.account")}
          {...triggerProps}
          className={cn(
            "flex w-full items-center justify-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-press @min-[160px]:justify-start",
            open && "bg-press",
          )}
        >
          <UserAvatar name={user?.displayName} src={user?.avatarUrl} size="sm" />
          <span className="hidden min-w-0 flex-1 @min-[160px]:block">
            <span className="block truncate text-sm font-medium text-fg">{name}</span>
            <span className="block truncate text-xs text-fg-muted">{t("shell.brandRole")}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <UserAvatar name={user?.displayName} src={user?.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              {user?.email ? <p className="truncate text-xs text-fg-muted">{user.email}</p> : null}
            </div>
          </div>
          <div className="border-b border-hairline px-4 py-3">
            <p className="mb-2 text-xs font-medium text-fg-muted">{t("shell.theme")}</p>
            <ThemeSegmented fullWidth />
          </div>
          <div className="p-1.5">
            <Link
              href="/dashboard/settings"
              onClick={close}
              className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-press"
            >
              <Settings aria-hidden="true" className="size-4 text-fg-muted" />
              {t("app.navSettings")}
            </Link>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="nav-help"
              className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-fg hover:bg-press"
            >
              <HelpCircle aria-hidden="true" className="size-4 text-fg-muted" />
              {t("shell.help")}
            </a>
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

const GROUP_ORDER: NavGroup[] = ["teaching", "business", "account"];

/**
 * Desktop/tablet sidebar: icon rail with small labels (768–1279px or when
 * collapsed) and a full 248px column (≥1280px). Layout switches with a
 * container query on the sidebar width, so there is no JS measuring.
 */
export function SideNav({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname() ?? "";
  const counts = useNotifications();
  return (
    <aside className="app-sidebar" aria-label={t("shell.mainNavigation")}>
      <div className="flex flex-col items-center gap-2 px-3 pt-4 pb-3 @min-[160px]:flex-row @min-[160px]:gap-1 @min-[160px]:pr-2 @min-[160px]:pl-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg @min-[160px]:flex-1" aria-label={t("shell.brandName")}>
          <BrandMark />
          <span className="hidden min-w-0 @min-[160px]:block">
            <span className="block truncate text-sm leading-tight font-semibold text-fg">{t("shell.brandName")}</span>
            <span className="block truncate text-xs leading-tight text-fg-muted">{t("shell.brandRole")}</span>
          </span>
        </Link>
        <NotificationBell placement="right-start" />
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 pb-3 scrollbar-hide @min-[160px]:px-3">
        {GROUP_ORDER.map((group, index) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group} className={cn(index > 0 && "mt-3 border-t border-hairline pt-3 @min-[160px]:mt-4 @min-[160px]:border-0 @min-[160px]:pt-0")}>
              <p className="hidden px-3 pb-1.5 text-xs font-medium text-fg-subtle @min-[160px]:block">{NAV_GROUP_LABELS[group]}</p>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => (
                  <li key={item.id}>
                    <NavLink item={item} pathname={pathname} count={item.badge ? counts[item.badge] : 0} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-hairline p-2.5 @min-[160px]:p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          title={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          className="hidden h-9 items-center justify-center gap-3 rounded-lg px-1.5 text-sm text-fg-muted hover:bg-press hover:text-fg xl:flex @min-[160px]:justify-start @min-[160px]:px-2.5"
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <PanelLeftClose aria-hidden="true" className="size-5" />}
          <span className="hidden @min-[160px]:inline">{t("shell.collapseSidebar")}</span>
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}
