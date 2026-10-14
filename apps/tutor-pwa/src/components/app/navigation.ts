/**
 * Single source of truth for the tutor app's navigation (SideNav, TabBar,
 * AppBar title/back). Pure data + helpers so it can be unit-tested.
 */
import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  CalendarDays,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Wallet,
} from "lucide-react";
import { t } from "@/lib/i18n";

export type NavItemId =
  | "home"
  | "classes"
  | "schedule"
  | "chat"
  | "earnings"
  | "network"
  | "performance"
  | "demo"
  | "settings";

export type NavGroup = "teaching" | "business" | "account";

export type NavBadgeSource = "unreadChat" | "availableAuctions";

export interface NavItem {
  id: NavItemId;
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Shown in the mobile tab bar (max 4 + "more"). */
  tab?: boolean;
  /** Notification count that badges this item. */
  badge?: NavBadgeSource;
  /** Extra path prefixes that also activate this item (e.g. /lesson for classes). */
  alsoActiveFor?: string[];
}

export const NAV_ITEMS: readonly NavItem[] = [
  { id: "home", href: "/dashboard", label: t("app.navOverview"), icon: LayoutDashboard, group: "teaching", tab: true },
  {
    id: "classes",
    href: "/dashboard/classes",
    label: t("app.navClasses"),
    icon: BookOpen,
    group: "teaching",
    tab: true,
    badge: "availableAuctions",
    alsoActiveFor: ["/lesson"],
  },
  { id: "schedule", href: "/dashboard/schedule", label: t("app.navSchedule"), icon: CalendarDays, group: "teaching", tab: true },
  { id: "chat", href: "/dashboard/chat", label: t("app.navChat"), icon: MessageSquare, group: "teaching", tab: true, badge: "unreadChat" },
  { id: "demo", href: "/dashboard/demo", label: t("app.navDemo"), icon: Sparkles, group: "teaching" },
  { id: "earnings", href: "/dashboard/earnings", label: t("app.navEarnings"), icon: Wallet, group: "business" },
  { id: "network", href: "/dashboard/network", label: t("app.navNetwork"), icon: GitBranch, group: "business" },
  { id: "performance", href: "/dashboard/performance", label: t("app.navPerformance"), icon: Award, group: "business" },
  { id: "settings", href: "/dashboard/settings", label: t("app.navSettings"), icon: Settings, group: "account" },
];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  teaching: t("shell.navGroupTeaching"),
  business: t("shell.navGroupBusiness"),
  account: t("shell.navGroupAccount"),
};

/** Items in the mobile tab bar (the 5th slot is the "more" sheet). */
export const TAB_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => item.tab);

/** Items in the mobile "more" sheet. */
export const MORE_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((item) => !item.tab);

function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] || "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Whether `item` is the current section for `pathname`. "/dashboard" only matches exactly. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const path = normalize(pathname);
  if (item.href === "/dashboard") return path === "/dashboard";
  if (matchesPrefix(path, item.href)) return true;
  return (item.alsoActiveFor ?? []).some((prefix) => matchesPrefix(path, prefix));
}

/** The nav item whose section contains `pathname` (longest match), or null. */
export function getActiveNavItem(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    if (!isNavItemActive(item, pathname)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

/** True when a "more" sheet item is the current section (highlights the More tab). */
export function isMoreActive(pathname: string): boolean {
  return MORE_ITEMS.some((item) => isNavItemActive(item, pathname));
}

/** True for a section root (no back button in the mobile app bar). */
export function isSectionRoot(pathname: string): boolean {
  const path = normalize(pathname);
  return NAV_ITEMS.some((item) => item.href === path);
}

/**
 * Where the mobile back button goes: the parent path for nested pages
 * (/dashboard/classes/123 → /dashboard/classes, /dashboard/classes/auction →
 * /dashboard/classes), or null on section roots.
 */
export function getBackHref(pathname: string): string | null {
  const path = normalize(pathname);
  if (isSectionRoot(path) || !path.startsWith("/dashboard/")) return null;
  const parent = path.slice(0, path.lastIndexOf("/"));
  return parent.length >= "/dashboard".length ? parent : "/dashboard";
}

/** Default app-bar title for a path (section label), used until a PageHeader registers its own. */
export function getDefaultTitle(pathname: string): string {
  return getActiveNavItem(pathname)?.label ?? t("shell.brandName");
}
