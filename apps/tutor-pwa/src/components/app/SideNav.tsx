"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./Atoms";
import { BrandMark } from "./BrandMark";
import { Dropdown } from "./Dropdown";
import { NAV_GROUP_LABELS, NAV_ITEMS, isNavItemActive, type NavGroup, type NavItem } from "./navigation";
import { CountBadge, NotificationBell } from "./NotificationBell";
import { useNotifications } from "./Notifications";
import { HELP_URL } from "./constants";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { ThemeSegmented } from "./ThemeSegmented";

/** TA mark (outlined SVG, constant in both themes). Re-exported for existing imports. */
export { BrandMark } from "./BrandMark";

/** Label beside the icon in the full 256px column (sidebar container ≥160px): one line. */
const fullLabelClass = "max-w-full break-words @min-[160px]:line-clamp-1 @min-[160px]:flex-1";

/**
 * One side-nav link. In the 88px rail (container <160px) the label is always
 * one 12px line under the icon: a label that does not fit the 67px column
 * needs a `railLabel` in navigation.ts (otherwise it is cut with an ellipsis,
 * never wrapped: two 12px lines are too tight for Thai and make the item taller
 * than its neighbours).
 */
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
        "nav-link group/nav flex-col gap-1 px-1 py-2 text-center text-xs leading-tight",
        "@min-[160px]:flex-row @min-[160px]:gap-3 @min-[160px]:px-2.5 @min-[160px]:py-0 @min-[160px]:text-left @min-[160px]:text-[0.9375rem] @min-[160px]:leading-[1.4]",
      )}
    >
      <span className="relative flex">
        <Icon aria-hidden="true" className="nav-icon size-5 shrink-0" strokeWidth={2} />
        {count > 0 ? (
          <CountBadge count={count} className="absolute -top-2 -right-3 h-5 min-w-5 ring-2 ring-surface-sidebar @min-[160px]:hidden" />
        ) : null}
      </span>
      {item.railLabel ? (
        <>
          {/* Rail: the short label shows; the full label stays the link's name (visually hidden) and is the label from 160px. */}
          <span aria-hidden="true" className="max-w-full truncate @min-[160px]:hidden">
            {item.railLabel}
          </span>
          <span className={cn(fullLabelClass, "@max-[160px]:sr-only")}>{item.label}</span>
        </>
      ) : (
        <span className={cn(fullLabelClass, "@max-[160px]:truncate")}>{item.label}</span>
      )}
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
            "flex min-h-11 w-full items-center justify-center gap-2.5 rounded-(--radius-ctl) p-1.5 text-left transition-colors hover:bg-press @min-[160px]:justify-start",
            open && "bg-press",
          )}
        >
          <UserAvatar name={user?.displayName} src={user?.avatarUrl} toneKey={user?.tutorId} size="nav" />
          <span className="hidden min-w-0 flex-1 @min-[160px]:block">
            <span className="block truncate text-sm font-semibold text-fg">{name}</span>
            <span className="block truncate text-xs text-fg-muted">{t("shell.brandRole")}</span>
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <UserAvatar name={user?.displayName} src={user?.avatarUrl} toneKey={user?.tutorId} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{name}</p>
              {user?.email ? <p className="truncate text-xs text-fg-muted">{user.email}</p> : null}
            </div>
          </div>
          <div className="border-b border-hairline px-4 py-3">
            <p className="mb-2 text-xs font-semibold text-fg-muted">{t("shell.theme")}</p>
            <ThemeSegmented fullWidth />
          </div>
          <div className="p-1.5">
            <Link
              href="/dashboard/settings"
              onClick={close}
              className="flex min-h-10 items-center gap-3 rounded-(--radius-ctl-sm) px-2.5 py-2 text-sm text-fg hover:bg-press pointer-coarse:min-h-11"
            >
              <Settings aria-hidden="true" className="size-4 text-fg-muted" />
              {t("app.navSettings")}
            </Link>
            <a
              href={HELP_URL}
              target="_blank"
              rel="noopener noreferrer"
              id="nav-help"
              className="flex min-h-10 items-center gap-3 rounded-(--radius-ctl-sm) px-2.5 py-2 text-sm text-fg hover:bg-press pointer-coarse:min-h-11"
            >
              <HelpCircle aria-hidden="true" className="size-4 text-fg-muted" />
              {t("shell.help")}
            </a>
          </div>
          {/* Logout is set apart from the navigation links. */}
          <div className="border-t border-hairline p-1.5">
            <button
              type="button"
              id="btn-logout"
              onClick={() => void logout()}
              className="flex min-h-10 w-full items-center gap-3 rounded-(--radius-ctl-sm) px-2.5 py-2 text-sm text-danger-fg hover:bg-danger-bg pointer-coarse:min-h-11"
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
 * Desktop/tablet side nav (components.md §9): an 88px icon rail with labels
 * (768–1279px or when collapsed) and a full 256px column (≥1280px). Brand
 * block (TA mark 36 + "Tutor Advantage" + "ครูผู้สอน"), group labels 600 12,
 * items 42 tall (radius 12, label 500 15), active --brand-soft with a
 * --brand-fg icon, counts as danger pills. Layout switches with a container
 * query on the sidebar width, so there is no JS measuring.
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
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 rounded-(--radius-ctl) @min-[160px]:flex-1"
          aria-label={t("shell.brandName")}
        >
          <BrandMark size={36} />
          <span className="hidden min-w-0 @min-[160px]:block">
            <span className="block truncate text-[0.9375rem] leading-[1.35] font-semibold whitespace-nowrap text-fg">{t("shell.brandName")}</span>
            <span className="block truncate text-xs leading-[1.4] text-fg-muted">{t("shell.brandRole")}</span>
          </span>
        </Link>
        <NotificationBell placement="right-start" />
      </div>

      <nav className="flex-1 overflow-y-auto px-1.5 pb-3 scrollbar-hide @min-[160px]:px-3">
        {GROUP_ORDER.map((group, index) => {
          const items = NAV_ITEMS.filter((item) => item.group === group);
          return (
            <div key={group} className={cn(index > 0 && "mt-3 border-t border-hairline pt-3 @min-[160px]:mt-2 @min-[160px]:border-0 @min-[160px]:pt-0")}>
              <p className="hidden px-2.5 pt-1.5 pb-1 text-xs leading-normal font-semibold text-fg-subtle @min-[160px]:block">{NAV_GROUP_LABELS[group]}</p>
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
          // From 1280px in px: the width the sidebar goes full at (globals.css), so the toggle is there whenever it can be collapsed.
          className="nav-link hidden justify-center min-[1280px]:flex @min-[160px]:justify-start"
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" className="size-5" /> : <PanelLeftClose aria-hidden="true" className="size-5" />}
          <span className="hidden @min-[160px]:inline">{t("shell.collapseSidebar")}</span>
        </button>
        <AccountMenu />
      </div>
    </aside>
  );
}
