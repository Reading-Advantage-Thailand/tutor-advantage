"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { t } from "@/lib/i18n";
import { normalizePath } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useWorkQueues } from "./AdminSummary";
import { CountBadge } from "./CountBadge";
import { Dropdown } from "./Dropdown";
import { NAV_GROUP_LABELS, getActiveNavItem, navItemsFor } from "./navigation";
import { useShell } from "./ShellContext";
import { ThemeToggle } from "./ThemeToggle";

interface Crumb {
  label: string;
  href?: string;
}

/**
 * Breadcrumb for the current route: nav group › section, plus the page title a
 * nested page registered with <PageHeader> ("ผู้ใช้และความเสี่ยง › ผู้ใช้งาน ›
 * Passport Sim Tutor"). The last crumb is the current page.
 */
export function breadcrumbFor(pathname: string, title: string | null): Crumb[] {
  const path = normalizePath(pathname);
  const item = getActiveNavItem(path);
  if (!item) return [{ label: title ?? t("shell.brandName") }];
  const crumbs: Crumb[] = [{ label: NAV_GROUP_LABELS[item.group] }];
  const nested = path !== item.href;
  crumbs.push({ label: item.label, href: nested ? item.href : undefined });
  if (nested && title && title !== item.label) crumbs.push({ label: title });
  return crumbs;
}

export function Breadcrumb({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  return (
    <nav aria-label={t("shell.breadcrumb")} className={cn("min-w-0", className)}>
      <ol className="app-crumb">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              {index > 0 ? (
                <li aria-hidden="true" className="flex shrink-0">
                  <ChevronRight className="size-4 text-fg-subtle" />
                </li>
              ) : null}
              <li className={cn("min-w-0", last ? "truncate" : "shrink-0")}>
                {last ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : crumb.href ? (
                  <Link href={crumb.href} className="rounded-(--radius-ctl-sm) hover:text-fg hover:underline">
                    {crumb.label}
                  </Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Bell (36): the work queues the role can act on, with their counts, as
 * links. A red dot (8px, ringed in the bar colour) when anything is waiting.
 * Data: the shell's one /v1/admin/overview poller (useWorkQueues).
 */
export function NotificationBell({ className, id = "notification-panel" }: { className?: string; id?: string }) {
  const { user, devRoutes } = useShell();
  const queues = useWorkQueues();
  const items = navItemsFor(user?.role, devRoutes).filter((item) => item.badge);
  const waiting = items.filter((item) => item.badge && queues[item.badge] > 0);
  const total = waiting.reduce((sum, item) => sum + (item.badge ? queues[item.badge] : 0), 0);
  const label = total > 0 ? t("shell.notificationsCount", { count: total }) : t("shell.notifications");
  return (
    <Dropdown
      id={id}
      label={t("shell.pendingWork")}
      placement="bottom-end"
      className={className}
      trigger={({ open, triggerProps }) => (
        <button
          type="button"
          aria-label={label}
          title={label}
          {...triggerProps}
          className={cn(
            "relative inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg-muted transition-colors hover:bg-press hover:text-fg pointer-coarse:min-h-11 pointer-coarse:min-w-11",
            open && "bg-press text-fg",
          )}
        >
          <Bell aria-hidden="true" className="size-[18px]" />
          {total > 0 ? (
            <span aria-hidden="true" className="absolute top-[7px] right-2 size-2 rounded-full bg-danger-solid ring-2 ring-(--surface-bg)" />
          ) : null}
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col">
          <p className="border-b border-hairline px-4 py-3 text-sm font-semibold text-fg">{t("shell.pendingWork")}</p>
          {waiting.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-fg-muted">{t("shell.notificationsEmpty")}</p>
          ) : (
            <ul className="flex flex-col p-1.5">
              {waiting.map((item) => {
                const Icon = item.icon;
                const count = item.badge ? queues[item.badge] : 0;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className="flex min-h-10 items-center gap-3 rounded-(--radius-ctl-sm) px-2.5 text-sm text-fg hover:bg-press pointer-coarse:min-h-11"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <CountBadge aria-hidden count={count} />
                      <span className="sr-only">{` ${t("shell.itemsCount", { count })}`}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Dropdown>
  );
}

/**
 * Desktop top bar (≥1024px, components.md §9): 56px, sticky, --surface-bg with
 * a bottom hairline. Breadcrumb on the left; theme toggle and bell (36) on the
 * right. Ctrl-K search is deferred until a search endpoint exists.
 */
export function TopBar() {
  const pathname = usePathname() ?? "/";
  const { title } = useShell();
  const crumbs = breadcrumbFor(pathname, title);
  return (
    <header className="app-topbar">
      <Breadcrumb crumbs={crumbs} className="flex-1" />
      <ThemeToggle />
      <NotificationBell />
    </header>
  );
}
