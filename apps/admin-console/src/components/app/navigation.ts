/**
 * Admin navigation = the shared route map (lib/routes.ts) + labels and icons.
 * Never list a route here that is not in ADMIN_ROUTES: the same entries drive
 * the middleware's role checks, so nav and access can't drift apart.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  AudioLines,
  BookOpen,
  Component,
  CreditCard,
  Database,
  FilePenLine,
  History,
  LayoutDashboard,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Ticket,
  Users,
} from "lucide-react";
import { t } from "@/lib/i18n";
import {
  ADMIN_ROUTES,
  findRoute,
  normalizePath,
  routesForRole,
  type AdminRoute,
  type NavGroup,
} from "@/lib/routes";

export interface NavItem extends AdminRoute {
  label: string;
  icon: LucideIcon;
}

const NAV_META: Record<string, { label: string; icon: LucideIcon }> = {
  overview: { label: t("shell.navOverview"), icon: LayoutDashboard },
  reconciliation: { label: t("shell.navReconciliation"), icon: CreditCard },
  settlements: { label: t("shell.navSettlements"), icon: ReceiptText },
  adjustments: { label: t("shell.navAdjustments"), icon: FilePenLine },
  audit: { label: t("shell.navAudit"), icon: History },
  exceptions: { label: t("shell.navExceptions"), icon: AlertTriangle },
  fraud: { label: t("shell.navFraud"), icon: ShieldAlert },
  users: { label: t("shell.navUsers"), icon: Users },
  coupons: { label: t("shell.navCoupons"), icon: Ticket },
  voice: { label: t("shell.navVoice"), icon: AudioLines },
  roles: { label: t("shell.navRoles"), icon: ShieldCheck },
  docs: { label: t("shell.navDocs"), icon: BookOpen },
  dev: { label: t("shell.navDev"), icon: Terminal },
  devDatabase: { label: t("shell.navDatabase"), icon: Database },
  uiKit: { label: t("shell.navUiKit"), icon: Component },
};

export const NAV_ITEMS: readonly NavItem[] = ADMIN_ROUTES.map((route) => ({
  ...route,
  ...(NAV_META[route.id] ?? { label: route.id, icon: LayoutDashboard }),
}));

export const NAV_GROUP_ORDER: readonly NavGroup[] = ["finance", "operations", "users", "settings", "dev"];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  finance: t("shell.navGroupFinance"),
  operations: t("shell.navGroupOperations"),
  users: t("shell.navGroupUsers"),
  settings: t("shell.navGroupSettings"),
  dev: t("shell.navGroupDev"),
};

/** Nav items visible to a role (dev items only when dev routes are on). */
export function navItemsFor(role: string | null | undefined, devRoutes: boolean): NavItem[] {
  const allowed = new Set(routesForRole(role, { devRoutes }).map((route) => route.id));
  return NAV_ITEMS.filter((item) => allowed.has(item.id));
}

/** Bottom-bar items for phones: the `tab` routes the role can open (max 3). */
export function tabItemsFor(role: string | null | undefined, devRoutes: boolean): NavItem[] {
  return navItemsFor(role, devRoutes).filter((item) => item.tab).slice(0, 3);
}

/** The nav item for the current section (the most specific route). */
export function getActiveNavItem(pathname: string): NavItem | null {
  const route = findRoute(pathname);
  return route ? (NAV_ITEMS.find((item) => item.id === route.id) ?? null) : null;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return getActiveNavItem(pathname)?.id === item.id;
}

/** True for a section root (no back button in the mobile app bar). */
export function isSectionRoot(pathname: string): boolean {
  const path = normalizePath(pathname);
  return NAV_ITEMS.some((item) => item.href === path);
}

/** Mobile back target for nested pages (/users/123 → /users), null on section roots. */
export function getBackHref(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (path === "/" || isSectionRoot(path)) return null;
  const item = getActiveNavItem(path);
  // Nested page → its section; unknown path (404) → overview.
  return item && item.href !== "/" ? item.href : "/";
}

/** Default app-bar title (section label) until a PageHeader registers its own. */
export function getDefaultTitle(pathname: string): string {
  return getActiveNavItem(pathname)?.label ?? t("shell.brandName");
}
