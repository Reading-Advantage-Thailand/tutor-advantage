"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Ellipsis, HelpCircle, LogOut, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { IconTile, UserAvatar } from "./Atoms";
import {
  MORE_ITEMS,
  TAB_ITEMS,
  getBackHref,
  getDefaultTitle,
  isMoreActive,
  isNavItemActive,
} from "./navigation";
import { CountBadge, NotificationBell } from "./NotificationBell";
import { useNotifications } from "./Notifications";
import { HELP_URL } from "./constants";
import { logout } from "./session";
import { useShell } from "./ShellContext";
import { Sheet } from "./Sheet";
import { BrandMark } from "./BrandMark";
import { ListGroup, ListRow } from "./Surface";
import { ThemeSegmented } from "./ThemeSegmented";

/**
 * Phone top bar (<768px, 60 + safe-top): back button on nested pages (or the
 * TA mark on section roots), the page name in Kodchasan 600 19 (registered by
 * <PageHeader>, else the section name), an optional "+" create action
 * (<PageHeader appBarAction>) and the notification bell. Sticky, opaque,
 * hairline.
 */
export function AppBar() {
  const pathname = usePathname() ?? "";
  const { title, backHref: registeredBack, appBarAction } = useShell();
  const backHref = registeredBack ?? getBackHref(pathname);
  const barTitle = title ?? getDefaultTitle(pathname);
  return (
    <header className="app-appbar">
      <div className="flex h-(--appbar-h) items-center gap-1 pr-1.5 pl-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={t("shell.back")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg hover:bg-press"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </Link>
        ) : (
          <Link
            href="/dashboard"
            aria-label={t("shell.brandName")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl)"
          >
            <BrandMark size={32} />
          </Link>
        )}
        <p className="min-w-0 flex-1 truncate pl-1 type-appbar text-fg">{barTitle}</p>
        {appBarAction ? (
          <Link
            href={appBarAction.href}
            aria-label={appBarAction.label}
            title={appBarAction.label}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius-ctl) text-fg hover:bg-press"
          >
            <Plus aria-hidden="true" className="size-6" />
          </Link>
        ) : null}
        <NotificationBell className="size-11 text-fg [&_svg]:size-6" />
      </div>
    </header>
  );
}

/**
 * Phone bottom tab bar (68 + safe-bottom): ภาพรวม · คลาสเรียน · ตารางสอน ·
 * ข้อความ · เพิ่มเติม. Flat with a top hairline; each tab ≥ 56 tall with the
 * icon in a 56×30 pill (active: --brand-soft pill, --brand-fg icon and label,
 * reading 600 12). Badges from the shared notifications poller. Renders an
 * in-flow spacer so page content never hides behind it.
 */
export function TabBar() {
  const pathname = usePathname() ?? "";
  const counts = useNotifications();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreActive(pathname);
  // Items in the More sheet (e.g. support replies) still need to be noticed on the tab bar.
  const moreCount = MORE_ITEMS.reduce((sum, item) => sum + (item.badge ? counts[item.badge] : 0), 0);

  // Close the sheet after navigating from it.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const tabClass = (active: boolean) => cn("tab-link", active && "text-brand-fg");
  const pillClass = (active: boolean) => cn("tab-pill", active && "bg-brand-soft");

  return (
    <>
      <div className="app-tabbar-spacer" aria-hidden="true" />
      <nav className="app-tabbar" aria-label={t("shell.mainNavigation")}>
        {TAB_ITEMS.map((item) => {
          const active = isNavItemActive(item, pathname);
          const Icon = item.icon;
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
              <span className={pillClass(active)}>
                <Icon aria-hidden="true" className="size-[22px]" strokeWidth={active ? 2.2 : 2} />
                {count > 0 ? <CountBadge count={count} className="absolute -top-1.5 -right-1 h-5 min-w-5 px-1 ring-2 ring-surface-nav" /> : null}
              </span>
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={tabClass(moreActive)}
        >
          <span className={pillClass(moreActive)}>
            <Ellipsis aria-hidden="true" className="size-[22px]" strokeWidth={moreActive ? 2.2 : 2} />
            {moreCount > 0 ? <CountBadge count={moreCount} className="absolute -top-1.5 -right-1 h-5 min-w-5 px-1 ring-2 ring-surface-nav" /> : null}
          </span>
          <span>{t("shell.navMore")}</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} pathname={pathname} />
    </>
  );
}

function MoreSheet({ open, onOpenChange, pathname }: { open: boolean; onOpenChange: (open: boolean) => void; pathname: string }) {
  const { user } = useShell();
  const counts = useNotifications();
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("shell.moreTitle")}>
      <div className="flex flex-col gap-4">
        {user ? (
          <div className="ds-well flex items-center gap-3 px-3 py-3">
            <UserAvatar name={user.displayName} src={user.avatarUrl} toneKey={user.tutorId} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">{user.displayName || t("shell.account")}</p>
              <p className="truncate text-xs text-fg-muted">{user.email || t("shell.brandRole")}</p>
            </div>
          </div>
        ) : null}
        <ListGroup>
          {MORE_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <ListRow
                key={item.id}
                href={item.href}
                onClick={() => onOpenChange(false)}
                leading={<IconTile icon={item.icon} tone={active ? "brand" : "neutral"} size="sm" />}
                title={item.label}
                selected={active}
                trailing={count > 0 ? <CountBadge count={count} /> : undefined}
                lines={1}
              />
            );
          })}
        </ListGroup>
        <div>
          <p className="mb-2 px-1 type-label font-semibold text-fg-muted">{t("shell.theme")}</p>
          <ThemeSegmented fullWidth />
        </div>
        <ListGroup>
          <a
            href={HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="list-row flex min-h-16 items-center gap-3 px-4 py-3 text-base font-semibold text-fg transition-colors hover:bg-row-hover active:bg-press focus-visible:bg-row-hover focus-visible:-outline-offset-3"
            data-leading=""
          >
            <IconTile icon={HelpCircle} tone="teal" size="sm" />
            {t("shell.help")}
          </a>
        </ListGroup>
        {/* Logout sits in its own group, apart from the navigation rows. */}
        <ListGroup>
          <ListRow
            onClick={() => void logout()}
            leading={<IconTile icon={LogOut} tone="red" size="sm" />}
            title={t("shell.logout")}
            destructive
            lines={1}
          />
        </ListGroup>
      </div>
    </Sheet>
  );
}
